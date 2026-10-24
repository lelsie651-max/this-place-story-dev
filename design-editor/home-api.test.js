import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import generator from './scripts/home-generator-core.js';
import { readHomeConfig, saveHomeConfig, uploadHomeAsset, readHomeAsset } from './scripts/editor-api.js';
import { validateHomeConfig } from './shared/home-layout.js';
import { getAvailableRect, fitHome, resolveHomeElements } from './shared/home-adaptation.js';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const configFile = 'design/home-index-elements.json';
const outputs = [
  'miniprogram/pages/index/index.wxml',
  'miniprogram/pages/index/index.wxss',
  'docs/home-layout-controls-guide.md',
  'miniprogram/pages/index/home-adaptation.generated.js'
];
const runtimeScript = outputs[3];
const owned = [configFile, ...outputs];
const pageScript = 'miniprogram/pages/index/index.js';
const expectedStoryIds = [
  'story_nantou_folk_01',
  'story_1792508501250_ea2612736d0e',
  'story_1792510928050_769fcbcc41dc'
];
const clone = (value) => structuredClone(value);
const element = (config, id) => {
  const found = config.elements.find((item) => item.designId === `index-${id}`);
  assert.ok(found, `Missing element: ${id}`);
  return found;
};
const revisionOf = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function snapshot(root, prefix = '') {
  const files = {};
  for (const entry of (await fs.readdir(path.join(root, prefix), { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, await snapshot(root, relative));
    else files[relative] = (await fs.readFile(path.join(root, relative))).toString('base64');
  }
  return files;
}

function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((file) => before[file] !== after[file]).sort();
}

async function sandbox(t) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'home-api-test-'));
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));
  const config = JSON.parse(await fs.readFile(path.join(sourceRoot, configFile), 'utf8'));
  const images = [...new Set([
    ...Object.values(config.defaultImages), ...Object.values(config.defaultRuntimeImages),
    ...Object.values(config.defaultEditorImages),
    ...config.elements.flatMap((item) => [item.imagePath, item.runtimeImagePath, item.editorDebugImagePath])
  ].filter(Boolean).map((value) => value.startsWith('/assets/') ? `miniprogram${value}` : value)
    .filter((value) => value.startsWith('miniprogram/assets/')))];
  for (const relative of [configFile, pageScript, ...images]) {
    const destination = path.join(projectRoot, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(sourceRoot, relative), destination);
  }
  await generator.generateHome(config, { projectRoot });
  // Other-page sentinels detect accidental writes without copying the whole app.
  for (const relative of ['miniprogram/pages/discovery/discovery.wxss', 'miniprogram/pages/story/story.wxml']) {
    await fs.mkdir(path.dirname(path.join(projectRoot, relative)), { recursive: true });
    await fs.writeFile(path.join(projectRoot, relative), `untouched: ${relative}\n`);
  }
  assert.ok(images.length > 0, 'Copy actual local images, not remote fixtures');
  return { projectRoot, images };
}

async function assertBackups(root, result, before) {
  assert.match(result.backupRoot, /^design-editor\/resources\/backups\/home-/);
  const backup = await snapshot(path.join(root, result.backupRoot));
  assert.deepEqual(Object.keys(backup).sort(), [...owned].sort());
  for (const file of owned) assert.equal(backup[file], before[file], file);
}

test('home API reads raw-byte revisions and saves only config plus four generated artifacts', async (t) => {
  const options = await sandbox(t);
  const before = await snapshot(options.projectRoot);
  const current = await readHomeConfig(options);
  assert.equal(current.revision, revisionOf(Buffer.from(before[configFile], 'base64')));
  assert.deepEqual(current.config, JSON.parse(Buffer.from(before[configFile], 'base64').toString('utf8')));
  assert.deepEqual(await readHomeConfig(options), current);
  assert.deepEqual(await snapshot(options.projectRoot), before, 'Reads must not write');

  const next = clone(current.config);
  Object.assign(element(next, 'primary-label'), { text: 'API saved label', visible: true, x: 221,
    fontSize: 33, fontWeight: 500, lineHeight: 1.75, color: '#123456', textAlign: 'right',
    letterSpacing: 1.25, textShadow: '1px 2px 3px #123456', opacity: 0.6, fontFamily: '', fontAssetId: '' });
  const saved = await saveHomeConfig({ revision: current.revision, config: next }, options);
  assert.deepEqual(saved.config, next);
  assert.notEqual(saved.revision, current.revision);
  assert.deepEqual(saved.filesModified, owned);
  assert.deepEqual(await readHomeConfig(options), { config: next, revision: saved.revision });
  const after = await snapshot(options.projectRoot);
  assert.equal(saved.revision, revisionOf(Buffer.from(after[configFile], 'base64')));
  assert.deepEqual(changedFiles(before, after).filter((file) => !file.startsWith('design-editor/resources/')),
    owned.filter((file) => file !== runtimeScript).sort());
  assert.match(await fs.readFile(path.join(options.projectRoot, outputs[0]), 'utf8'), /API saved label/);
  const css = await fs.readFile(path.join(options.projectRoot, outputs[1]), 'utf8');
  assert.match(css, /left:221px/);
  for (const part of ['font-size:33px;', 'font-weight:500;', 'line-height:1.75;', 'color:#123456;',
    'text-align:right;', 'letter-spacing:1.25px;', 'text-shadow:1px 2px 3px #123456;', 'opacity:0.6;']) {
    assert.ok(css.includes(part), part);
  }
  assert.equal(after[runtimeScript], before[runtimeScript], 'Font edits do not change the adaptation module');
  assert.equal((await generator.generateHome(next, { projectRoot: options.projectRoot, check: true })).ok, true);
  await assertBackups(options.projectRoot, saved, before);
});

test('stale, missing and simultaneous revisions reject with 409 without overwriting the winner', async (t) => {
  const options = await sandbox(t);
  const current = await readHomeConfig(options);
  const first = clone(current.config);
  const second = clone(current.config);
  element(first, 'primary-label').text = 'First writer';
  element(second, 'primary-label').text = 'Second writer';
  const results = await Promise.allSettled([
    saveHomeConfig({ revision: current.revision, config: first }, options),
    saveHomeConfig({ revision: current.revision, config: second }, options)
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[1].reason.statusCode, 409);
  const winner = results[0].value;
  const before = await snapshot(options.projectRoot);
  for (const revision of [current.revision, undefined, 'not-a-revision']) {
    await assert.rejects(saveHomeConfig({ revision, config: second }, options), { statusCode: 409 });
    assert.deepEqual(await snapshot(options.projectRoot), before);
  }
  assert.deepEqual(await readHomeConfig(options), { config: first, revision: winner.revision });
  const saved = await saveHomeConfig({ revision: winner.revision, config: second }, options);
  assert.deepEqual(saved.config, second, 'A rejected write must not poison the write queue');
});

test('API saves runtime/debug images separately and derives hit geometry from visual edits', async (t) => {
  const options = await sandbox(t);
  let current = await readHomeConfig(options);
  const upload = await stageImage(options);
  for (const resolvedDraft of [false, true]) {
    const next = clone(current.config);
    const visual = element(next, 'primary-background');
    const hit = element(next, 'primary-button');
    const debugPath = visual.editorDebugImagePath;
    Object.assign(visual, { runtimeImagePath: upload.imagePath, editorDebugVisible: !resolvedDraft,
      x: visual.x + 17, y: visual.y - 9, width: 280, height: 90, scale: resolvedDraft ? 0.75 : 1.5,
      visible: !resolvedDraft });
    Object.assign(element(next, 'primary-region'), { x: 47, y: 330, scale: 0.8 });
    hit.hitPadding = { top: 3, right: 7, bottom: 5, left: 11 };
    const expected = clone(next);
    Object.assign(element(expected, 'primary-button'), {
      x: visual.x - 11 * visual.scale, y: visual.y - 3 * visual.scale,
      width: visual.width + 18, height: visual.height + 8, scale: visual.scale
    });
    if (resolvedDraft) next.elements = resolveHomeElements(next);
    const draftBefore = clone(next);
    const before = await snapshot(options.projectRoot);
    const saved = await saveHomeConfig({ revision: current.revision, config: next }, options);
    assert.deepEqual(next, draftBefore, 'Save must not normalize the caller draft in place');
    assert.deepEqual(saved.config, expected);
    assert.deepEqual((await readHomeConfig(options)).config, expected);
    await assertBackups(options.projectRoot, saved, before);
    const wxml = await fs.readFile(path.join(options.projectRoot, outputs[0]), 'utf8');
    assert.ok(wxml.includes(upload.imagePath.replace(/^miniprogram\//, '/')));
    assert.equal(wxml.includes(debugPath.replace(/^miniprogram\//, '/')), false);
    assert.match(wxml, /bindtap="goToExplore"/);
    assert.deepEqual(await fs.readFile(path.join(options.projectRoot, upload.imagePath)), upload.bytes);
    const after = await snapshot(options.projectRoot);
    assert.deepEqual(changedFiles(before, after).filter((file) =>
      !owned.includes(file) && file !== upload.imagePath && !file.startsWith('design-editor/resources/backups/')), []);
    assert.equal(after[pageScript], before[pageScript]);
    assert.equal((await generator.generateHome(expected, { projectRoot: options.projectRoot, check: true })).ok, true);
    current = { config: saved.config, revision: saved.revision };
  }
  const next = clone(current.config);
  element(next, 'primary-button').x += 1;
  assert.equal(validateHomeConfig(next).valid, true);
  const before = await snapshot(options.projectRoot);
  await assert.rejects(saveHomeConfig({ revision: current.revision, config: next }, options), /点击区域几何/);
  assert.deepEqual(await snapshot(options.projectRoot), before);
});

test('API rejects schema-valid parentage, order, layer and binding edits as immutable', async (t) => {
  const options = await sandbox(t);
  const current = await readHomeConfig(options);
  const before = await snapshot(options.projectRoot);
  const mutations = [
    ['parentId', (c) => { element(c, 'primary-label').parentId = 'index-page'; }],
    ['draw order', (c) => { [c.elements[5], c.elements[6]] = [c.elements[6], c.elements[5]]; }],
    ['fixedLayers', (c) => { c.fixedLayers['index-primary-region'] = 11; }],
    ['fixed design height', (c) => { c.designHeight += 1; element(c, 'page').height = c.designHeight; }],
    ['element layer', (c) => { element(c, 'primary-label').layer = 99; }],
    ['textBinding', (c) => { element(c, 'recommendation-title').textBinding = 'displaySummary'; }],
    ['new event binding', (c) => { element(c, 'primary-button').bindtap = 'otherRoute'; }]
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, async () => {
      const next = clone(current.config);
      mutate(next);
      assert.equal(validateHomeConfig(next).valid, true, 'Exercise API immutability, not schema rejection');
      await assert.rejects(saveHomeConfig({ revision: current.revision, config: next }, options),
        (error) => error.statusCode !== 409 && /关系|顺序|绑定/.test(error.message));
      assert.deepEqual(await snapshot(options.projectRoot), before);
      assert.deepEqual(await readHomeConfig(options), current);
    });
  }
});

test('invalid hierarchy, membership, image binding and missing assets leave all files unchanged', async (t) => {
  const options = await sandbox(t);
  const current = await readHomeConfig(options);
  const before = await snapshot(options.projectRoot);
  const mutations = [
    ['cycle', (c) => { element(c, 'primary-region').parentId = 'index-primary-region'; }],
    ['membership', (c) => { c.elements.pop(); }],
    ['imageBinding', (c) => { element(c, 'recommendation-cover').imageBinding = 'storyId'; }],
    ['followParent', (c) => { element(c, 'primary-label').followParent = false; }],
    ['geometry', (c) => { element(c, 'primary-button').width = -1; }],
    ['missing image', (c) => { element(c, 'primary-icon').imagePath = 'miniprogram/assets/missing.png'; }],
    ['path traversal', (c) => { element(c, 'primary-icon').imagePath = 'miniprogram/assets/../missing.png'; }],
    ['runtime fallback', (c) => { element(c, 'primary-background').runtimeImagePath = c.defaultEditorImages['index-primary-background']; }],
    ['missing debug image', (c) => { element(c, 'primary-background').editorDebugImagePath = 'miniprogram/assets/missing-debug.png'; }],
    ['font asset reservation', (c) => { element(c, 'primary-label').fontAssetId = 'custom-font'; }],
    ['font family reservation', (c) => { element(c, 'primary-label').fontFamily = 'Custom'; }],
    ['text shadow injection', (c) => { element(c, 'primary-label').textShadow = '1px 2px 3px red;display:none'; }],
    ['opacity range', (c) => { element(c, 'primary-label').opacity = 1.1; }]
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, async () => {
      const next = clone(current.config);
      mutate(next);
      await assert.rejects(saveHomeConfig({ revision: current.revision, config: next }, options));
      assert.deepEqual(await snapshot(options.projectRoot), before);
      assert.deepEqual(await readHomeConfig(options), current);
    });
  }
});

async function stageImage(options) {
  const bytes = await fs.readFile(path.join(options.projectRoot, options.images[0]));
  const uploaded = await uploadHomeAsset({ fileName: 'fixture.png', base64: bytes.toString('base64') }, options);
  const staged = `design-editor/resources/home-uploads/${path.basename(uploaded.imagePath)}`;
  return { ...uploaded, staged, bytes };
}

test('uploads stay staged until save, then copy byte-for-byte without touching other pages', async (t) => {
  const options = await sandbox(t);
  const current = await readHomeConfig(options);
  const before = await snapshot(options.projectRoot);
  await assert.rejects(uploadHomeAsset({ base64: Buffer.from('not an image').toString('base64') }, options));
  assert.deepEqual(await snapshot(options.projectRoot), before);
  const upload = await stageImage(options);
  assert.match(upload.imagePath, /^miniprogram\/assets\/home-uploads\/[\da-f-]+\.(png|jpg|webp)$/);
  assert.deepEqual(changedFiles(before, await snapshot(options.projectRoot)), [upload.staged]);
  await assert.rejects(fs.stat(path.join(options.projectRoot, upload.imagePath)), { code: 'ENOENT' });
  assert.deepEqual((await readHomeAsset(upload.imagePath, options)).bytes, upload.bytes);
  assert.deepEqual(await readHomeConfig(options), current);

  const next = clone(current.config);
  Object.assign(element(next, 'primary-icon'), { imagePath: upload.imagePath, imageCleared: false, visible: true });
  const stagedBefore = await snapshot(options.projectRoot);
  await assert.rejects(saveHomeConfig({ revision: 'stale', config: next }, options), { statusCode: 409 });
  assert.deepEqual(await snapshot(options.projectRoot), stagedBefore);
  const saved = await saveHomeConfig({ revision: current.revision, config: next }, options);
  assert.deepEqual(await fs.readFile(path.join(options.projectRoot, upload.imagePath)), upload.bytes);
  assert.deepEqual(await fs.readFile(path.join(options.projectRoot, upload.staged)), upload.bytes, 'Save copies rather than moves');
  assert.deepEqual((await readHomeAsset(upload.imagePath, options)).bytes, upload.bytes);
  assert.deepEqual(saved.config, next);
  const changes = changedFiles(stagedBefore, await snapshot(options.projectRoot));
  assert.deepEqual(changes.filter((file) => !file.startsWith('design-editor/resources/')),
    [...owned.filter((file) => file !== runtimeScript), upload.imagePath].sort());
  await assertBackups(options.projectRoot, saved, stagedBefore);
});

test('generation failure rolls back config, all artifacts and promoted image; retry succeeds', async (t) => {
  const options = await sandbox(t);
  const current = await readHomeConfig(options);
  const upload = await stageImage(options);
  const next = clone(current.config);
  Object.assign(element(next, 'primary-icon'), { imagePath: upload.imagePath, visible: true });
  await fs.appendFile(path.join(options.projectRoot, runtimeScript), '\n// Pre-existing runtime drift to restore on failure.\n');
  const before = await snapshot(options.projectRoot);
  const generate = generator.generateHome;
  const failure = new Error('Injected failure after generated artifacts were written');
  let generated = false;
  // Fail after real sandbox writes so rollback, not only preflight rejection, is tested.
  const mocked = t.mock.method(generator, 'generateHome', async (config, args) => {
    assert.equal(args.projectRoot, options.projectRoot);
    await generate(config, args);
    assert.notEqual((await fs.readFile(path.join(options.projectRoot, runtimeScript))).toString('base64'), before[runtimeScript]);
    assert.deepEqual((await readHomeConfig(options)).config, next);
    assert.deepEqual(await fs.readFile(path.join(options.projectRoot, upload.imagePath)), upload.bytes);
    generated = true;
    throw failure;
  });
  try {
    await assert.rejects(saveHomeConfig({ revision: current.revision, config: next }, options), (error) => error === failure);
  } finally {
    mocked.mock.restore();
  }
  assert.equal(generated, true);
  assert.deepEqual(await readHomeConfig(options), current);
  const after = await snapshot(options.projectRoot);
  assert.deepEqual(changedFiles(before, after).filter((file) => !file.startsWith('design-editor/resources/backups/')), []);
  await assert.rejects(fs.stat(path.join(options.projectRoot, upload.imagePath)), { code: 'ENOENT' });
  assert.deepEqual(await fs.readFile(path.join(options.projectRoot, upload.staged)), upload.bytes);
  const saved = await saveHomeConfig({ revision: current.revision, config: next }, options);
  assert.deepEqual(saved.config, next);
  assert.deepEqual(await fs.readFile(path.join(options.projectRoot, upload.imagePath)), upload.bytes);
});

async function loadPage(t, windowInfo) {
  const { projectRoot } = await sandbox(t);
  const calls = { stories: [], locations: [], routes: [], patches: [] };
  let definition;
  const runtimeContext = vm.createContext({ module: { exports: {} } });
  vm.runInContext(await fs.readFile(path.join(projectRoot, runtimeScript), 'utf8'), runtimeContext,
    { filename: runtimeScript, timeout: 1000 });
  const services = {
    './home-adaptation.generated': runtimeContext.module.exports,
    '../../services/storyService': {
      async getStoryById(storyId) {
        calls.stories.push(storyId);
        return { storyId: 'different-service-id', locationId: `location:${storyId}`, title: 'Stub title', summary: 'Stub summary' };
      }
    },
    '../../services/locationService': {
      async getLocationById(locationId) {
        calls.locations.push(locationId);
        return { city: 'Stub city', name: 'Stub place' };
      }
    }
  };
  const context = vm.createContext({
    module: { exports: {} },
    Page(value) { assert.equal(definition, undefined); definition = value; },
    require(id) {
      assert.ok(Object.hasOwn(services, id), `Unexpected dependency: ${id}`);
      return services[id];
    },
    wx: new Proxy({ navigateTo({ url }) { calls.routes.push(url); },
      getWindowInfo() { assert.ok(windowInfo, 'Unexpected viewport read'); return clone(windowInfo); } }, {
      get(target, key) {
        assert.ok(Object.hasOwn(target, key), `Unexpected wx API: ${String(key)}`);
        return target[key];
      }
    })
  });
  vm.runInContext(await fs.readFile(path.join(projectRoot, pageScript), 'utf8'), context, { filename: pageScript, timeout: 1000 });
  assert.ok(definition);
  const page = { ...definition, data: clone(definition.data), setData(patch) {
    calls.patches.push(clone(patch));
    Object.assign(this.data, clone(patch));
  } };
  return { page, calls, exports: context.module.exports };
}

test('VM homepage preserves configured storyIds and carousel changes only its index', async (t) => {
  const { page, calls, exports } = await loadPage(t);
  assert.deepEqual(Array.from(exports.RECOMMENDATION_STORIES, (item) => item.storyId), expectedStoryIds);
  await page.loadRecommendations();
  assert.deepEqual(calls.stories, expectedStoryIds);
  assert.deepEqual(calls.locations, expectedStoryIds.map((id) => `location:${id}`));
  assert.deepEqual(page.data.recommendationCards.map((item) => item.storyId), expectedStoryIds);
  assert.equal(page.data.recommendationLoading, false);
  const cards = page.data.recommendationCards;
  const before = clone(page.data);
  const cases = [[{ detail: { current: 1 } }, 1], [{ detail: { current: '2' } }, 2],
    [{ detail: { current: 99 } }, 2], [{ detail: { current: -1 } }, 0],
    [{ detail: { current: 'invalid' } }, 0], [{}, 0], [undefined, 0]];
  calls.patches.length = 0;
  for (const [event, expected] of cases) {
    page.onRecommendationChange(event);
    assert.deepEqual(calls.patches.at(-1), { currentRecommendationIndex: expected });
    assert.deepEqual(page.data, { ...before, currentRecommendationIndex: expected });
    assert.equal(page.data.recommendationCards, cards);
  }
  assert.equal(calls.patches.length, cases.length);
  page.data.recommendationCards = [];
  page.onRecommendationChange({ detail: { current: 2 } });
  assert.deepEqual(calls.patches.at(-1), { currentRecommendationIndex: 0 });
  assert.deepEqual(calls.stories, expectedStoryIds, 'Swiper must not reload services');
  assert.deepEqual(calls.locations, expectedStoryIds.map((id) => `location:${id}`));
  assert.deepEqual(calls.routes, []);
});

test('VM click handlers keep discovery/story routes and use dataset storyId rather than swiper index', async (t) => {
  const { page, calls } = await loadPage(t);
  page.data.currentRecommendationIndex = 2;
  const before = clone(page.data);
  page.goToExplore();
  for (const storyId of [...expectedStoryIds, 'story /?&=#']) {
    page.goToRecommendation({ currentTarget: { dataset: { storyId: ` ${storyId} ` } }, target: { dataset: { storyId: 'wrong-target' } } });
  }
  for (const event of [undefined, {}, { currentTarget: {} }, { currentTarget: { dataset: {} } },
    { currentTarget: { dataset: { storyId: '   ' } } }]) page.goToRecommendation(event);
  assert.deepEqual(calls.routes, ['/pages/discovery/discovery',
    ...[...expectedStoryIds, 'story /?&=#'].map((id) => `/pages/story/story?storyId=${encodeURIComponent(id)}&entry=recommendation`)]);
  assert.deepEqual(page.data, before);
  assert.deepEqual(calls.patches, []);
  assert.deepEqual(calls.stories, []);
  assert.deepEqual(calls.locations, []);
});

test('VM viewport lifecycle uses the generated adaptation at four widths without changing business data', async (t) => {
  const config = JSON.parse(await fs.readFile(path.join(sourceRoot, configFile), 'utf8'));
  for (const width of [360, 375, 390, 414]) {
    const info = { windowWidth: width, windowHeight: 500, screenTop: 64, statusBarHeight: 20,
      safeArea: { left: 0, top: 20, right: width, bottom: 633 } };
    const { page, calls } = await loadPage(t, info);
    const before = clone(page.data);
    const available = getAvailableRect(info);
    const fitted = fitHome(config, available);
    const patch = { homeLayoutReady: true, homeWindowWidth: width, homeWindowHeight: 500,
      homeScale: fitted.scale, homeOffsetX: fitted.offsetX, homeOffsetY: fitted.offsetY };
    for (const lifecycle of ['onReady', 'onShow', 'onResize']) {
      page[lifecycle]();
      assert.deepEqual(calls.patches.at(-1), patch);
      assert.deepEqual(page.data, { ...before, ...patch });
      assert.deepEqual(clone(page._homeViewport), { windowInfo: info, available, fitted });
    }
    assert.deepEqual(calls.stories, []);
    assert.deepEqual(calls.locations, []);
    assert.deepEqual(calls.routes, []);
  }
});

test('viewport fallback matches the editor when screenTop is absent', async (t) => {
  const config = JSON.parse(await fs.readFile(path.join(sourceRoot, configFile), 'utf8'));
  const info = { windowWidth: 390, windowHeight: 500, statusBarHeight: 24,
    safeArea: { left: 0, top: 24, right: 390, bottom: 760 } };
  const { page } = await loadPage(t, info);
  page.updateHomeViewport();
  assert.equal(page._homeViewport.available.fallback, true);
  assert.equal(page._homeViewport.windowInfo.screenTop, undefined);
  assert.deepEqual(clone(page._homeViewport.fitted), fitHome(config, getAvailableRect(info)));
});

test('page background saves while incompatible background assets fail before writing', async (t) => {
  const options = await sandbox(t);
  const current = await readHomeConfig(options);
  const next = clone(current.config);
  next.pageBackground = '#e8dfcd';
  const saved = await saveHomeConfig({ config: next, revision: current.revision }, options);
  assert.equal(saved.config.pageBackground, '#e8dfcd');
  assert.match(await fs.readFile(path.join(options.projectRoot, outputs[1]), 'utf8'), /background:#e8dfcd/);
  const before = await snapshot(options.projectRoot);
  const remote = clone(saved.config);
  element(remote, 'background-image').imagePath = 'https://example.test/background.png';
  await assert.rejects(saveHomeConfig({ config: remote, revision: saved.revision }, options), /本地图片/);
  assert.deepEqual(await snapshot(options.projectRoot), before);
  const mismatch = clone(saved.config);
  element(mismatch, 'background-image').imagePath = current.config.defaultEditorImages['index-primary-background'];
  await assert.rejects(saveHomeConfig({ config: mismatch, revision: saved.revision }, options), /比例/);
  assert.deepEqual(await snapshot(options.projectRoot), before);
  const cleared = clone(saved.config);
  Object.assign(element(cleared, 'background-image'), { imagePath: '', imageCleared: true });
  const clearedResult = await saveHomeConfig({ config: cleared, revision: saved.revision }, options);
  assert.equal(clearedResult.config.designHeight, saved.config.designHeight);
  assert.doesNotMatch(await fs.readFile(path.join(options.projectRoot, outputs[0]), 'utf8'), /home-background-placeholder\.png/);
});
