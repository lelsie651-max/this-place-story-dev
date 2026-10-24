import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  validateHomeConfig, elementStyle, renderHomePreview,
  renderHomeWxml, renderHomeWxss, renderHomeGuide
} from './shared/home-layout.js';
import generator from '../scripts/home-generator.js';

const { generateHome } = generator;
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(projectRoot, 'design/home-index-elements.json'), 'utf8'));
const clone = () => structuredClone(config);
const element = (value, id) => value.elements.find((e) => e.designId === `index-${id}`);
const owned = [
  'miniprogram/pages/index/index.wxml',
  'miniprogram/pages/index/index.wxss',
  'docs/home-layout-controls-guide.md'
];

function tag(markup, id) {
  const marker = markup.indexOf(`data-design-id="index-${id}"`);
  assert.ok(marker >= 0, `Missing ${id}`);
  const start = markup.lastIndexOf('<', marker);
  return markup.slice(start).match(/^<(?:[^"'>]|"[^"]*"|'[^']*')*>/)[0];
}

function rule(css, id) {
  const found = css.match(new RegExp(`\\.home-layout \\.index-${id} \\{ ([^}]+) \\}`));
  assert.ok(found, `Missing rule ${id}`);
  return found[1];
}

// Parse just the generated tag structure, including anonymous business wrappers.
function designParents(markup) {
  const stack = [];
  const parents = new Map();
  const tokens = markup.match(/<!--[^]*?-->|<\/?[a-z][a-z-]*(?:[^"'>]|"[^"]*"|'[^']*')*>/g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    const id = token.match(/data-design-id="([^"]+)"/)?.[1];
    if (id) {
      assert.equal(parents.has(id), false, `Duplicate design node ${id}`);
      parents.set(id, [...stack].reverse().find(Boolean) || null);
    }
    if (!token.endsWith('/>') && !token.startsWith('<img ')) stack.push(id);
  }
  assert.equal(stack.length, 0, 'Generated tree must be balanced');
  return parents;
}

test('source validates; bad trees, geometry and bindings fail before rendering', () => {
  assert.deepEqual(validateHomeConfig(config), { valid: true, errors: [] });
  assert.equal(config.elements.length, 25);
  for (const mutate of [
    (c) => c.elements.push({ ...c.elements[0] }),
    (c) => c.elements.pop(),
    (c) => { element(c, 'primary-region').parentId = 'index-primary-region'; },
    (c) => { element(c, 'primary-label').parentId = 'missing'; },
    (c) => { element(c, 'primary-region').parentId = 'index-primary-label'; },
    (c) => { element(c, 'primary-region').scale = 0; },
    (c) => { element(c, 'primary-button').x = Infinity; },
    (c) => { element(c, 'primary-button').width = -1; },
    (c) => { element(c, 'primary-icon').imageCropX = 101; },
    (c) => { element(c, 'primary-icon').imageCleared = 'true'; },
    (c) => { element(c, 'recommendation-title').textBinding = 'storyId'; },
    (c) => { element(c, 'recommendation-title').parentId = 'index-page'; },
    (c) => { element(c, 'recommendation-cover').imagePath = 'miniprogram/../secret'; },
    (c) => { element(c, 'recommendation-title').color = 'red;display:none'; },
    (c) => { element(c, 'primary-button').parentId = 'index-recommendation-content'; },
    (c) => { c.unit = 'px'; }
  ]) {
    const invalid = clone();
    mutate(invalid);
    assert.equal(validateHomeConfig(invalid).valid, false);
    assert.throws(() => renderHomeWxml(invalid), /首页配置无效/);
  }
  for (const invalid of [null, [], {}, { ...config, elements: [null] }]) {
    assert.equal(validateHomeConfig(invalid).valid, false);
  }
});

test('local geometry stays unchanged in real nested HTML and WXML', () => {
  const c = clone();
  const label = element(c, 'primary-label');
  const region = element(c, 'primary-region');
  label.visible = true;
  assert.match(elementStyle(label), /left:220rpx;top:93rpx;width:240rpx;height:48rpx/);
  region.x = 100;
  region.y = 200;
  region.scale = 2;
  const css = renderHomeWxss(c);
  assert.match(rule(css, 'primary-region'), /left:100rpx;top:200rpx/);
  assert.match(rule(css, 'primary-region'), /transform:scale\(2\)/);
  assert.match(rule(css, 'primary-label'), /left:220rpx;top:93rpx/);
  assert.match(rule(css, 'primary-label'), /transform:scale\(1\)/);
  assert.match(tag(renderHomePreview(c), 'primary-label'), /left:220px;top:93px/);
  element(c, 'recommendation-section').scale = 2;
  element(c, 'recommendation-tag-group').scale = 1.5;
  assert.match(rule(renderHomeWxss(c), 'recommendation-tag-text'), /left:0rpx;top:5rpx/);
  assert.match(rule(renderHomeWxss(c), 'recommendation-tag-text'), /transform:scale\(1\)/);
  for (const render of [renderHomePreview, renderHomeWxml]) {
    const parents = designParents(render(c));
    assert.equal(parents.size, c.elements.length);
    for (const e of c.elements) assert.equal(parents.get(e.designId), e.parentId, e.designId);
  }
  label.followParent = false;
  assert.equal(validateHomeConfig(c).valid, false);
  assert.throws(() => renderHomePreview(c), /followParent 必须固定为 true/);
  assert.throws(() => elementStyle(label, 'em'), /unit/);
});

test('required fields cannot be omitted and validation errors are Chinese', () => {
  for (const key of ['version', 'pageName', 'unit', 'referenceWidth', 'notes', 'defaultImages', 'elements']) {
    const c = clone();
    delete c[key];
    const result = validateHomeConfig(c);
    assert.equal(result.valid, false, key);
    assert.ok(result.errors.every((error) => /[\u4e00-\u9fff]/.test(error)), key);
  }
  const keys = ['designId', 'name', 'note', 'parentId', 'type', 'visible', 'x', 'y',
    'width', 'height', 'scale', 'imagePath', 'imageMode', 'imageCropX', 'imageCropY',
    'text', 'textBinding', 'fontSize', 'fontWeight', 'color', 'lineHeight', 'textAlign', 'followParent'];
  for (const key of keys) {
    const c = clone();
    delete element(c, 'primary-label')[key];
    assert.equal(validateHomeConfig(c).valid, false, key);
  }
  for (const key of ['imageCleared', 'imageBinding', 'imageCropX', 'imageMode']) {
    const c = clone();
    delete element(c, 'recommendation-cover')[key];
    assert.equal(validateHomeConfig(c).valid, false, key);
  }
  const c = clone();
  delete c.defaultImages['index-primary-icon'];
  assert.equal(validateHomeConfig(c).valid, false);
});

test('hiding groups and hit markers does not hide descendants or disable the native button', () => {
  const c = clone();
  for (const e of c.elements) if (e.type === 'group' || e.type === 'hit') e.visible = false;
  const wxml = renderHomeWxml(c);
  const css = renderHomeWxss(c);
  const preview = renderHomePreview(c, { displayTitle: 'Still visible' });
  assert.match(preview, /Still visible/);
  for (const e of c.elements.filter((item) => item.type === 'group' || item.type === 'hit')) {
    assert.doesNotMatch(rule(css, e.designId.slice(6)), /display:none/);
    assert.doesNotMatch(tag(preview, e.designId.slice(6)), /display:none/);
  }
  assert.match(tag(wxml, 'primary-button'), /^<button.*bindtap="goToExplore"/);
  assert.doesNotMatch(tag(wxml, 'primary-button'), /disabled|hidden|wx:if/);
  assert.match(tag(wxml, 'primary-button'), /z-index:10;pointer-events:auto/);
  assert.match(rule(css, 'recommendation-title'), /width:320rpx;height:76rpx/);
  assert.match(rule(css, 'primary-region'), /z-index:10/);
  assert.match(rule(css, 'recommendation-section'), /z-index:1/);
  for (const id of ['primary-region', 'recommendation-section', 'recommendation-content', 'recommendation-outer-frame']) {
    assert.match(rule(css, id), /pointer-events:none/);
    assert.match(tag(preview, id), /pointer-events:none/);
  }
  assert.match(css, /\.home-swiper, \.home-slide \{ pointer-events:auto; \}/);
  assert.match(preview, /class="home-swiper" style="[^"]*pointer-events:auto/);
});

test('image hide, clear, default restore and replacement are distinct', () => {
  const c = clone();
  const cover = element(c, 'recommendation-cover');
  const original = JSON.stringify(c);
  cover.visible = false;
  assert.match(renderHomeWxml(c), /item.coverImage/);
  assert.match(rule(renderHomeWxss(c), 'recommendation-cover'), /display:none/);
  cover.visible = true;
  cover.imageCleared = true;
  assert.doesNotMatch(renderHomeWxml(c), /item.coverImage|home-recommendation-cover-placeholder/);
  assert.doesNotMatch(renderHomePreview(c, { coverImage: 'https://example.test/dynamic.png' }), /dynamic.png|home-recommendation-cover-placeholder/);
  cover.imageCleared = false;
  cover.imagePath = '';
  assert.match(renderHomeWxml(c), /\/assets\/banners\/home-recommendation-cover-placeholder.png/);
  cover.imagePath = 'miniprogram/assets/banners/custom.png';
  assert.match(renderHomeWxml(c), /\/assets\/banners\/custom.png/);
  assert.ok(renderHomePreview(c).includes(`/__design_editor/home-asset?path=${encodeURIComponent(cover.imagePath)}`));
  assert.ok(renderHomePreview(c, { coverImage: 'https://example.test/dynamic.png' }).includes(`src="/__design_editor/home-asset?path=${encodeURIComponent('https://example.test/dynamic.png')}"`));
  cover.imagePath = '/assets/banners/custom.png';
  assert.ok(renderHomePreview(c).includes(`/__design_editor/home-asset?path=${encodeURIComponent('miniprogram/assets/banners/custom.png')}`));
  const sources = [...renderHomePreview(c).matchAll(/<img src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(sources.every((src) => src.startsWith('/__design_editor/home-asset?path=')));
  cover.visible = false;
  cover.imageCleared = false;
  cover.imagePath = c.defaultImages[cover.designId];
  assert.match(rule(renderHomeWxss(c), 'recommendation-cover'), /display:none/);
  assert.equal(JSON.stringify(config), original);
});

test('temporary icon and tag fills yield to images and stay cleared until explicitly restored', () => {
  const c = clone();
  const icon = element(c, 'primary-icon');
  const background = element(c, 'recommendation-tag-background');
  icon.visible = true;
  icon.text = 'TEMP_ICON';
  assert.match(renderHomeWxml(c), /TEMP_ICON/);
  assert.match(renderHomeWxml(c), /background:rgba\(140,94,52,0.12\)/);
  icon.imagePath = 'miniprogram/assets/icon.png';
  background.imagePath = 'https://example.test/tag.png';
  let output = renderHomeWxml(c);
  assert.match(output, /src="\/assets\/icon.png"/);
  assert.match(output, /src="https:\/\/example.test\/tag.png"/);
  assert.doesNotMatch(output, /TEMP_ICON|background:rgba\(140,94,52,0.12\)/);
  icon.imageCleared = background.imageCleared = true;
  output = renderHomeWxml(c);
  assert.doesNotMatch(output, /TEMP_ICON|\/assets\/icon.png|example.test\/tag.png|background:rgba\(140,94,52,0.12\)/);
});

test('crop overscan uses native images, keeps geometry and avoids unsupported local backgrounds', () => {
  const c = clone();
  const cover = element(c, 'recommendation-cover');
  cover.imageCropX = 100;
  cover.imageCropY = 0;
  const wxml = renderHomeWxml(c);
  const preview = renderHomePreview(c);
  assert.match(wxml, /mode="aspectFill" style="[^"]*width:200%;height:200%;left:-100%;top:0%/);
  assert.match(preview, /width:200%;height:200%;left:-100%;top:0%;pointer-events:none;object-fit:cover/);
  assert.doesNotMatch(wxml, /background-image/);
  assert.match(rule(renderHomeWxss(c), 'recommendation-cover'), /width:260rpx;height:260rpx/);
  cover.imageMode = 'aspectFit';
  assert.match(renderHomePreview(c), /width:100%;height:100%;left:0%;top:0%;pointer-events:none;object-fit:contain/);
});

test('single swiper preserves business bindings, load/empty gates and custom indicator state', () => {
  const output = renderHomeWxml(config);
  assert.equal((output.match(/<swiper /g) || []).length, 1);
  assert.match(output, /current="\{\{currentRecommendationIndex\}\}" bindchange="onRecommendationChange"/);
  assert.doesNotMatch(output, /&quot;|&#39;|&amp;&amp;/);
  assert.match(output, /indicator-dots="\{\{false\}\}"/);
  assert.match(output, /wx:for="\{\{recommendationCards\}\}" wx:key="storyId"/);
  assert.match(output, /bindtap="goToRecommendation" data-story-id="\{\{item.storyId\}\}"/);
  assert.match(output, /wx:if="\{\{recommendationLoading\}\}"/);
  assert.match(output, />推荐加载中<\/view>/);
  assert.match(output, /wx:elif="\{\{recommendationCards.length > 0\}\}"/);
  assert.match(output, /\{\{recommendationEmptyText\}\}/);
  assert.match(renderHomePreview(config, { previewLoading: true }, 0, 0), />推荐加载中<\/div>/);
  assert.match(renderHomePreview(config, {}, 0, 0), />推荐内容正在整理中<\/div>/);
  for (const name of ['label', 'displayTitle', 'locationName', 'displaySummary', 'actionText']) {
    assert.ok(output.includes(`{{item.${name}}}`));
  }
  assert.equal((output.match(/data-design-id="index-recommendation-outer-frame"/g) || []).length, 1);
  for (let count = 0; count <= 3; count++) {
    const preview = renderHomePreview(config, {}, Math.max(0, count - 1), count);
    for (let i = 0; i < 3; i++) {
      assert.equal(tag(preview, `recommendation-dot-${i + 1}`).includes('display:none'), i >= count);
      assert.ok(tag(output, `recommendation-dot-${i + 1}`).includes(`recommendationCards.length > ${i}`));
    }
    if (count) assert.match(tag(preview, `recommendation-dot-${count}`), /background:#8b5e34/);
  }
});

test('nonempty text overrides presentation while empty text uses dynamic bindings', () => {
  const c = clone();
  const title = element(c, 'recommendation-title');
  title.text = 'Manual <title> {{literal}}';
  for (const render of [renderHomeWxml, renderHomePreview]) {
    const markup = render(c, { displayTitle: 'Dynamic title' });
    assert.match(markup, /Manual &lt;title&gt; &#123;&#123;literal&#125;&#125;/);
    assert.doesNotMatch(markup, /\{\{item.displayTitle\}\}|Dynamic title/);
  }
  title.text = '';
  assert.match(renderHomeWxml(c), /\{\{item.displayTitle\}\}/);
  assert.match(renderHomePreview(c, { displayTitle: 'Dynamic title' }), /Dynamic title/);
  assert.equal(title.textBinding, 'displayTitle');
});

test('rendering is deterministic, escapes text, uses only configured geometry and stays single-screen', () => {
  const c = clone();
  const before = JSON.stringify(c);
  const record = { displayTitle: '<script>&" {{notAnExpression}}' };
  assert.match(renderHomePreview(c, record), /&lt;script&gt;&amp;&quot; &#123;&#123;notAnExpression&#125;&#125;/);
  assert.doesNotMatch(renderHomePreview(c, record), /<script>/);
  for (const render of [renderHomePreview, renderHomeWxml, renderHomeWxss, renderHomeGuide]) {
    assert.equal(render(c), render(c));
  }
  assert.equal(JSON.stringify(c), before);
  const all = renderHomeWxml(c) + renderHomeWxss(c);
  assert.doesNotMatch(all, /company|scroll-view|overflow:auto|overflow:scroll|recommendationCards\[0\]/);
  assert.match(renderHomeWxss(c), /page \{ height:100%; min-height:0; overflow:hidden; \}/);
  assert.match(renderHomePreview(c), /--home-preview-height/);
  const guide = renderHomeGuide(c);
  for (const e of c.elements) assert.ok(guide.includes(`| ${e.designId} |`));
  for (const key of ['imageCleared', 'defaultImages', 'followParent', 'onRecommendationChange', '--check']) assert.ok(guide.includes(key));
  for (const note of config.notes) assert.ok(guide.includes(note));
  for (const image of Object.values(config.defaultImages).filter(Boolean)) assert.ok(guide.includes(image));
  assert.match(guide, /恢复默认图：[^\n]*保留 visible 原值/);
  assert.doesNotMatch(guide, /恢复默认图：[^\n]*visible=true|公司|需后续实现|UI-1A 不修改 JS|\/@fs\//);
  assert.match(guide, /放大取景的临时控件限制，不是标准焦点裁切/);
  element(c, 'recommendation-title').x = 301;
  assert.match(rule(renderHomeWxss(c), 'recommendation-title'), /left:301rpx/);
  assert.match(tag(renderHomePreview(c), 'recommendation-title'), /left:301px/);
});

test('generator checks without creating files and writes only owned artifacts in an isolated sandbox', async (t) => {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'home-layout-test-'));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  const root = path.join(sandbox, 'project');
  const untouched = [...owned, 'miniprogram/pages/index/index.js', 'design/home-index-elements.json'];
  const before = await Promise.all(untouched.map((file) => fs.readFile(path.join(projectRoot, file), 'utf8')));
  // All writes and cleanup remain inside the temporary sandbox.
  const missing = await generateHome(config, { projectRoot: root, check: true });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.differences, owned);
  assert.deepEqual(missing.written, []);
  await assert.rejects(fs.stat(root), { code: 'ENOENT' });
  const written = await generateHome(config, { projectRoot: root });
  assert.equal(written.ok, true);
  assert.deepEqual(written.written, owned);
  const expected = [renderHomeWxml(config), renderHomeWxss(config), renderHomeGuide(config)];
  assert.deepEqual(await Promise.all(owned.map((file) => fs.readFile(path.join(root, file), 'utf8'))), expected);
  const stats = await Promise.all(owned.map((file) => fs.stat(path.join(root, file))));
  assert.equal((await generateHome(config, { projectRoot: root, check: true })).ok, true);
  assert.deepEqual((await generateHome(config, { projectRoot: root })).written, []);
  assert.deepEqual((await Promise.all(owned.map((file) => fs.stat(path.join(root, file))))).map((s) => s.mtimeMs), stats.map((s) => s.mtimeMs));
  await fs.writeFile(path.join(root, owned[0]), 'deliberate drift');
  const drift = await generateHome(config, { projectRoot: root, check: true });
  assert.deepEqual(drift.differences, [owned[0]]);
  assert.equal(await fs.readFile(path.join(root, owned[0]), 'utf8'), 'deliberate drift');
  const invalid = clone();
  element(invalid, 'primary-button').width = -1;
  await assert.rejects(generateHome(invalid, { projectRoot: root }), /首页配置无效/);
  assert.equal(await fs.readFile(path.join(root, owned[0]), 'utf8'), 'deliberate drift');
  await assert.rejects(generateHome(config, { projectRoot: '.' }), /绝对路径/);
  assert.deepEqual(await Promise.all(untouched.map((file) => fs.readFile(path.join(projectRoot, file), 'utf8'))), before);
});

test('CLI check exit codes reflect artifact drift and reject unknown options without writing', async () => {
  const script = path.join(projectRoot, 'scripts/home-generator.js');
  const before = await Promise.all(owned.map((file) => fs.readFile(path.join(projectRoot, file), 'utf8')));
  const result = await generateHome(config, { projectRoot, check: true });
  const run = spawnSync(process.execPath, [script, '--check'], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(run.error, undefined);
  assert.equal(run.status, result.ok ? 0 : 1, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), result);
  const unknown = spawnSync(process.execPath, [script, '--unexpected'], { encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /用法/);
  assert.deepEqual(await Promise.all(owned.map((file) => fs.readFile(path.join(projectRoot, file), 'utf8'))), before);
});
