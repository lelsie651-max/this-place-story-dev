import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { getAvailableRect, fitHome, resolveHomeElements } from './shared/home-adaptation.js';
import generator, { inspectHomeBackground, renderHomeRuntime } from './scripts/home-generator-core.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(projectRoot, 'design/home-index-elements.json'), 'utf8'));
const design = { designWidth: 750, designHeight: 1200 };
const geometry = ({ x, y, width, height }) => ({ x, y, width, height });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

for (const width of [360, 375, 390, 414]) {
  test(`contain centers a fixed design at window width ${width}`, () => {
    const rect = getAvailableRect({
      windowWidth: width, windowHeight: 720, screenTop: 88, statusBarHeight: 44,
      safeArea: { left: 0, top: 44, right: width, bottom: 844 }
    });
    assert.deepEqual(geometry(rect), { x: 0, y: 0, width, height: 720 });
    assert.equal(rect.fallback, false);
    const fit = fitHome(design, rect);
    close(fit.scale, width / 750);
    close(fit.offsetX, 0);
    close(fit.offsetY, (720 - 1200 * width / 750) / 2);

    const shortRect = { x: 8, y: 12, width: width - 16, height: 400 };
    const shortFit = fitHome(design, shortRect);
    close(shortFit.scale, 1 / 3);
    close(shortFit.offsetX, 8 + (width - 16 - 250) / 2);
    close(shortFit.offsetY, 12);
  });
}

test('short native-tabbar window does not subtract status or bottom UI twice', () => {
  const info = {
    windowWidth: 375, windowHeight: 500, screenHeight: 667, screenTop: 64,
    statusBarHeight: 20, tabBarHeight: 49,
    safeArea: { left: 0, top: 20, right: 375, bottom: 633 }
  };
  const before = structuredClone(info);
  const rect = getAvailableRect(info);
  assert.deepEqual(geometry(rect), { x: 0, y: 0, width: 375, height: 500 });
  assert.equal(rect.diagnostics.statusBarHeight, 20);
  assert.deepEqual(geometry(getAvailableRect({ ...info, statusBarHeight: 99, tabBarHeight: 90 })), geometry(rect));
  assert.deepEqual(info, before);
});

test('safe area intersects screen-space window and translates to window coordinates', () => {
  const info = {
    windowWidth: 390, windowHeight: 600, screenTop: 30,
    safeArea: { left: 10, top: 50, right: 380, bottom: 610 }
  };
  assert.deepEqual(geometry(getAvailableRect(info)), { x: 10, y: 20, width: 370, height: 560 });
  assert.deepEqual(geometry(getAvailableRect({ ...info, screenTop: 0 })), { x: 10, y: 50, width: 370, height: 550 });
  assert.equal(getAvailableRect({ ...info, screenTop: 0 }).fallback, false);
  const empty = getAvailableRect({ ...info, screenTop: 700 });
  assert.deepEqual(geometry(empty), { x: 10, y: 0, width: 370, height: 0 });
  assert.equal(fitHome(design, empty).scale, 0);
});

test('missing screenTop explicitly falls back to the window without guessing from statusBarHeight', () => {
  const info = {
    windowWidth: 360, windowHeight: 500, statusBarHeight: 24,
    safeArea: { left: 0, top: 24, right: 360, bottom: 760 }
  };
  const rect = getAvailableRect(info);
  assert.equal(rect.fallback, true);
  assert.equal(rect.diagnostics.fallbackReason, 'missing-screen-top');
  assert.equal(rect.diagnostics.screenTop, null);
  assert.deepEqual(geometry(rect), { x: 0, y: 0, width: 360, height: 500 });
  const noSafeArea = getAvailableRect({ windowWidth: 360, windowHeight: 500, screenTop: 0 });
  assert.equal(noSafeArea.fallback, true);
  assert.equal(noSafeArea.diagnostics.fallbackReason, 'missing-safe-area');
});

function fixture() {
  return {
    ...design,
    elements: [
      { designId: 'index-page', type: 'root', parentId: null, x: 9, y: 8, width: 1, height: 100, heightUnit: 'vh', scale: 3 },
      { designId: 'region', type: 'group', parentId: 'index-page', x: 100, y: 200, width: 600, height: 300, scale: 2, visible: false },
      { designId: 'button', type: 'hit', parentId: 'region', x: 0, y: 0, width: 1, height: 1, scale: 9, visible: false,
        hitPadding: { top: 3, right: 7, bottom: 5, left: 11 } },
      { designId: 'index-primary-background', type: 'image', parentId: 'region', x: 40, y: 60, width: 100, height: 50, scale: 1.5, visible: false }
    ]
  };
}

// Compose the actual parent transforms to verify hit edges in canvas coordinates.
function world(elements, id) {
  const e = elements.find((item) => item.designId === id);
  const parent = e.parentId ? world(elements, e.parentId) : { x: 0, y: 0, scale: 1 };
  const scale = parent.scale * e.scale;
  return { x: parent.x + e.x * parent.scale, y: parent.y + e.y * parent.scale,
    width: e.width * scale, height: e.height * scale, scale };
}

test('root uses fixed design geometry; sibling hit follows visual scale and all four padding sides', () => {
  const config = fixture();
  const before = structuredClone(config);
  const elements = resolveHomeElements(config);
  assert.deepEqual(geometry(elements[0]), { x: 0, y: 0, width: 750, height: 1200 });
  assert.equal(elements[0].scale, 1);
  assert.equal(elements[0].heightUnit, undefined);
  const hit = elements[2];
  assert.equal(hit.followsElementId, 'index-primary-background');
  assert.equal(hit.parentId, elements[3].parentId);
  assert.equal(hit.scale, 1.5);
  assert.deepEqual(geometry(hit), { x: 23.5, y: 55.5, width: 118, height: 58 });
  assert.equal(hit.visible, false);
  assert.equal(elements.length, config.elements.length);
  const h = world(elements, 'button');
  const v = world(elements, 'index-primary-background');
  close(v.x - h.x, 33);
  close(v.y - h.y, 9);
  close(h.x + h.width - v.x - v.width, 21);
  close(h.y + h.height - v.y - v.height, 15);
  assert.deepEqual(config, before);
  hit.hitPadding.left = 999;
  assert.equal(config.elements[2].hitPadding.left, 11);
});

test('parent movement, child edits and visibility changes keep hit geometry attached', () => {
  const config = fixture();
  config.elements[1].x = -50;
  config.elements[1].y = 300;
  config.elements[1].scale = 0.5;
  config.elements[2].hitPadding = { left: 4 };
  config.elements[3].x = 80;
  config.elements[3].y = -20;
  config.elements[3].scale = 2;
  const hidden = resolveHomeElements(config);
  for (const e of config.elements) e.visible = true;
  const shown = resolveHomeElements(config);
  assert.deepEqual(world(hidden, 'button'), world(shown, 'button'));
  assert.deepEqual(geometry(shown[2]), { x: 72, y: -20, width: 104, height: 50 });
  const hit = world(shown, 'button');
  const visual = world(shown, 'index-primary-background');
  close(visual.x - hit.x, 4);
  close(hit.x + hit.width, visual.x + visual.width);
  close(hit.y, visual.y);
  close(hit.height, visual.height);
});

test('explicit follow target works without padding; missing and cross-parent targets fail', () => {
  const config = fixture();
  config.elements[3].designId = 'custom-visual';
  config.elements[2].followsElementId = 'custom-visual';
  delete config.elements[2].hitPadding;
  const elements = resolveHomeElements(config);
  assert.deepEqual(geometry(elements[2]), geometry(elements[3]));
  assert.equal(elements[2].scale, elements[3].scale);
  config.elements[3].parentId = 'index-page';
  assert.throws(() => resolveHomeElements(config), /same parentId/);
  config.elements[2].followsElementId = 'missing';
  assert.throws(() => resolveHomeElements(config), /followsElementId/);
});

test('invalid design dimensions are rejected rather than producing invalid transforms', () => {
  for (const value of [0, -1, NaN, Infinity, undefined]) {
    assert.throws(() => fitHome({ ...design, designHeight: value }, { width: 375, height: 500 }), /designHeight/);
    assert.throws(() => resolveHomeElements({ ...fixture(), designWidth: value }), /designWidth/);
  }
});

test('actual background PNG ratio determines the fixed design height and contains every element', async () => {
  const background = config.elements.find((e) => e.designId === 'index-background-image');
  const relative = background.imagePath.replace(/^\/assets\//, 'miniprogram/assets/');
  const bytes = await fs.readFile(path.join(projectRoot, relative));
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.ok(width > 0 && height > 0);
  const inspected = await inspectHomeBackground(config, projectRoot);
  assert.deepEqual(inspected, { width, height, designHeightFromImage: config.designWidth * height / width });
  close(config.designHeight, inspected.designHeightFromImage);
  close(config.designWidth / config.designHeight, width / height);
  assert.equal(background.imageMode, 'aspectFit');
  assert.deepEqual(geometry(background), { x: 0, y: 0, width: config.designWidth, height: config.designHeight });
  const elements = resolveHomeElements(config);
  let contentBottom = 0;
  for (const e of elements) {
    const bounds = world(elements, e.designId);
    assert.ok(bounds.x >= 0 && bounds.y >= 0, `${e.designId} starts outside the design`);
    assert.ok(bounds.x + bounds.width <= config.designWidth, `${e.designId} exceeds the design width`);
    assert.ok(bounds.y + bounds.height <= config.designHeight, `${e.designId} exceeds the design height`);
    if (e.type !== 'root' && e.designId !== background.designId) contentBottom = Math.max(contentBottom, bounds.y + bounds.height);
  }
  assert.ok(contentBottom > 0 && contentBottom <= inspected.designHeightFromImage);
  const aliases = structuredClone(config);
  aliases.elements.find((e) => e.designId === background.designId).imagePath = relative.replace(/^miniprogram/, '');
  assert.deepEqual(await inspectHomeBackground(aliases, projectRoot), inspected);
});

test('background inspection rejects nonlocal, missing, malformed and zero-size PNG inputs', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'home-background-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const c = structuredClone(config);
  const background = c.elements.find((e) => e.designId === 'index-background-image');
  for (const imagePath of ['https://example.test/background.png', 'miniprogram/assets/../secret.png']) {
    background.imagePath = imagePath;
    await assert.rejects(inspectHomeBackground(c, root), /本地图片/);
  }
  background.imagePath = 'miniprogram/assets/background.png';
  await assert.rejects(inspectHomeBackground(c, root), { code: 'ENOENT' });
  const filename = path.join(root, background.imagePath);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  for (const bytes of [Buffer.from('not a PNG'), Buffer.alloc(24)]) {
    await fs.writeFile(filename, bytes);
    await assert.rejects(inspectHomeBackground(c, root), /PNG/);
  }
  const zeroSize = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(zeroSize);
  await fs.writeFile(filename, zeroSize);
  await assert.rejects(inspectHomeBackground(c, root), /尺寸无效/);
});

test('generated CJS and shared ESM agree at four widths using the current design and nested hit geometry', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'home-adaptation-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const before = structuredClone(config);
  const generated = await generator.generateHome(config, { projectRoot: root });
  const relative = 'miniprogram/pages/index/home-adaptation.generated.js';
  assert.ok(generated.written.includes(relative));
  const source = await fs.readFile(path.join(root, relative), 'utf8');
  assert.equal(source, await renderHomeRuntime(config));
  assert.doesNotMatch(source, /export function/);
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(source, context, { filename: relative, timeout: 1000 });
  const runtime = context.module.exports;
  assert.deepEqual(structuredClone(runtime.design), { designWidth: config.designWidth, designHeight: config.designHeight });
  const edited = structuredClone(config);
  Object.assign(edited.elements.find((e) => e.designId === 'index-primary-region'), { x: 61, y: 170, scale: 0.75 });
  Object.assign(edited.elements.find((e) => e.designId === 'index-primary-background'), { x: 93, y: -17, scale: 1.5 });
  edited.elements.find((e) => e.designId === 'index-primary-button').hitPadding = { top: 3, right: 7, bottom: 5, left: 11 };
  for (const c of [config, edited]) {
    const inputBefore = structuredClone(c);
    assert.deepEqual(structuredClone(runtime.resolveHomeElements(c)), resolveHomeElements(c));
    assert.deepEqual(c, inputBefore);
  }
  for (const width of [360, 375, 390, 414]) {
    for (const info of [
      { windowWidth: width, windowHeight: 900, screenTop: 88, statusBarHeight: 44,
        safeArea: { left: 0, top: 44, right: width, bottom: 988 } },
      { windowWidth: width, windowHeight: 400, screenTop: 64, statusBarHeight: 20,
        safeArea: { left: 8, top: 76, right: width - 8, bottom: 452 } },
      { windowWidth: width, windowHeight: 500, statusBarHeight: 24,
        safeArea: { left: 0, top: 24, right: width, bottom: 760 } }
    ]) {
      const infoBefore = structuredClone(info);
      const rect = getAvailableRect(info);
      const cjsRect = runtime.getAvailableRect(info);
      assert.deepEqual(structuredClone(cjsRect), rect);
      const fit = fitHome(config, rect);
      assert.deepEqual(structuredClone(runtime.fitHome(runtime.design, cjsRect)), fit);
      const scale = Math.min(rect.width / config.designWidth, rect.height / config.designHeight);
      close(fit.scale, scale);
      close(fit.offsetX, rect.x + (rect.width - config.designWidth * scale) / 2);
      close(fit.offsetY, rect.y + (rect.height - config.designHeight * scale) / 2);
      for (const e of resolveHomeElements(edited)) {
        const esmBounds = world(resolveHomeElements(edited), e.designId);
        const cjsBounds = world(runtime.resolveHomeElements(edited), e.designId);
        close(fit.offsetX + esmBounds.x * fit.scale, fit.offsetX + cjsBounds.x * fit.scale);
        close(fit.offsetY + esmBounds.y * fit.scale, fit.offsetY + cjsBounds.y * fit.scale);
        close(esmBounds.width * fit.scale, cjsBounds.width * fit.scale);
        close(esmBounds.height * fit.scale, cjsBounds.height * fit.scale);
      }
      assert.deepEqual(info, infoBefore);
    }
  }
  assert.deepEqual(config, before);
});
