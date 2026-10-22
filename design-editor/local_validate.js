import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  applyDesignToMiniprogram,
  buildApplyPlan,
  exportDesignFiles,
  getProjectRoot,
  readJsonFile
} from './scripts/editor-api.js';
import {
  createEditorState,
  selectDevice,
  selectScale
} from './src/editor-core.js';
import {
  DEVICE_IDS,
  TAB_BAR_ITEMS,
  calculateFitScale,
  convertRpxToPx,
  getDeviceMetrics,
  getDeviceProfile,
  replaceRpxWithPx
} from './shared/preview-data.js';
import {
  createEmptyDraft,
  upsertAsset,
  upsertOverride
} from './shared/schema.js';

const projectRoot = getProjectRoot();

function buildSampleDraft() {
  let draft = createEmptyDraft();
  draft = upsertOverride(draft, 'index', 'index-page-title', 'color', '#123456');
  draft = upsertOverride(draft, 'index', 'index-page-title', 'fontSize', '80rpx');
  draft = upsertOverride(draft, 'index', 'index-page-title', 'text', '新的首页标题');
  draft = upsertAsset(draft, 'asset_validate', {
    assetId: 'asset_validate',
    fileName: 'validate-cover.png',
    mimeType: 'image/png',
    width: 640,
    height: 360,
    relativeProjectPath: 'design-editor/resources/uploads/validate-cover.png',
    previewPath: '/resources/uploads/validate-cover.png'
  });
  draft = upsertOverride(draft, 'index', 'index-recommendation-card', 'imageSrc', 'asset_validate');
  return draft;
}

async function main() {
  const draft = buildSampleDraft();
  const mainJsPath = path.join(projectRoot, 'design-editor', 'src', 'main.js');
  const stylesPath = path.join(projectRoot, 'design-editor', 'src', 'styles.css');
  const indexWxssPath = path.join(projectRoot, 'miniprogram', 'pages', 'index', 'index.wxss');
  const storyWxssPath = path.join(projectRoot, 'miniprogram', 'pages', 'story', 'story.wxss');
  const beforeMainJs = await fs.readFile(mainJsPath, 'utf8');
  const beforeStyles = await fs.readFile(stylesPath, 'utf8');
  const beforeIndexWxss = await fs.readFile(indexWxssPath, 'utf8');
  const beforeStoryWxss = await fs.readFile(storyWxssPath, 'utf8');

  assert.equal(convertRpxToPx(375, 360), 180, '375rpx 在 360 viewport 下应为 180px');
  assert.equal(convertRpxToPx(375, 390), 195, '375rpx 在 390 viewport 下应为 195px');
  assert.equal(convertRpxToPx(375, 414), 207, '375rpx 在 414 viewport 下应为 207px');
  assert.equal(convertRpxToPx(72, 375), 36, '72rpx 在 375 viewport 下应为 36px');
  assert.equal(replaceRpxWithPx('72rpx', 375), '36.00px', '72rpx 应在预览层转换为 36px');

  assert.deepEqual(DEVICE_IDS, [
    'huawei-mate-80',
    'iphone-6-7-8',
    'iphone-12-13-pro',
    'iphone-xr'
  ], '设备预设列表不正确');
  assert.deepEqual(
    DEVICE_IDS.map((deviceId) => {
      const device = getDeviceProfile(deviceId);
      return [device.width, device.height];
    }),
    [
      [360, 809],
      [375, 667],
      [390, 844],
      [414, 896]
    ],
    '设备 viewport 配置不正确'
  );
  assert.deepEqual(
    TAB_BAR_ITEMS.map((item) => item.label),
    ['首页', '足迹', '投稿', '我的'],
    'tabBar 顺序必须是 首页 / 足迹 / 投稿 / 我的'
  );

  const fitMetrics = getDeviceMetrics('iphone-12-13-pro');
  assert.equal(fitMetrics.frameWidth, fitMetrics.viewportWidth + fitMetrics.framePadding * 2, '外框宽度必须来自同一份设备模型');
  assert.equal(fitMetrics.frameHeight, fitMetrics.viewportHeight + fitMetrics.framePadding * 2, '外框高度必须来自同一份设备模型');
  assert.equal(fitMetrics.bottomBarHeight, fitMetrics.tabBarHeight + fitMetrics.safeAreaBottom, '底部占用高度必须等于 tabBarHeight + safeAreaBottom');
  assert.equal(calculateFitScale(600, 1200, fitMetrics) <= 1, true, 'fitScale 不应超过 1');

  const initialState = createEditorState();
  const scaledState = selectScale(initialState, '0.75');
  const deviceSwitchedState = selectDevice(scaledState, 'huawei-mate-80');
  assert.equal(deviceSwitchedState.selectedScale, '0.75', '设备切换不应改变编辑器缩放状态');
  const scaledAgainState = selectScale(deviceSwitchedState, '1');
  assert.equal(scaledAgainState.selectedDeviceId, 'huawei-mate-80', '编辑器缩放切换不应改变当前设备');

  const plan = await buildApplyPlan(draft, { projectRoot });
  assert.equal(plan.summary.safeApplyCount >= 2, true, '应至少识别出 2 个可安全应用属性');
  assert.equal(plan.summary.previewOnlyCount >= 2, true, '应识别出仅预览属性');
  assert.ok(plan.generatedWxssFiles.includes('miniprogram/pages/index/design-overrides.wxss'));

  const exportResult = await exportDesignFiles(draft, { projectRoot });
  assert.equal(exportResult.files.length, 5, '导出文件数量不正确');

  await readJsonFile(path.join(projectRoot, 'design', 'export', 'design-tokens.json'));
  await readJsonFile(path.join(projectRoot, 'design', 'export', 'page-overrides.json'));
  await readJsonFile(path.join(projectRoot, 'design', 'export', 'asset-manifest.json'));
  await readJsonFile(path.join(projectRoot, 'design', 'export', 'design-preview.json'));

  const afterMainJs = await fs.readFile(mainJsPath, 'utf8');
  const afterStyles = await fs.readFile(stylesPath, 'utf8');
  const afterIndexWxss = await fs.readFile(indexWxssPath, 'utf8');
  const afterStoryWxss = await fs.readFile(storyWxssPath, 'utf8');
  assert.equal(afterMainJs, beforeMainJs, '未点击应用前，main.js 不应被导出流程改写');
  assert.equal(afterStyles, beforeStyles, '未点击应用前，styles.css 不应被导出流程改写');
  assert.equal(afterIndexWxss, beforeIndexWxss, '未点击应用前，index.wxss 不应变化');
  assert.equal(afterStoryWxss, beforeStoryWxss, '未点击应用前，story.wxss 不应变化');

  assert.ok(beforeMainJs.includes('data-device-id'), '设备选择按钮应使用设备 ID');
  assert.ok(beforeMainJs.includes('safe-area 未测量'), 'safe-area 未测量状态必须出现在界面文案中');
  assert.ok(beforeMainJs.includes('phone-scroll') && beforeStyles.includes('overflow-y: auto'), 'phone-scroll 内部滚动必须有效');
  assert.ok(beforeStyles.includes('position: sticky') && beforeStyles.includes('.phone-tabbar'), 'tabBar 必须固定在屏幕底部');
  assert.ok(beforeStyles.includes('.phone-top-chrome') && beforeStyles.includes('.page-content'), '顶部系统区和页面内容层必须存在');
  assert.equal(beforeStyles.includes('background: linear-gradient(180deg, #231d18, #302720);'), true, '黑色外框应只保留在手机外框层');

  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'design-editor-validate-'));
  await fs.cp(path.join(projectRoot, 'design'), path.join(sandboxRoot, 'design'), { recursive: true });
  await fs.mkdir(path.join(sandboxRoot, 'miniprogram', 'pages', 'index'), { recursive: true });
  await fs.mkdir(path.join(sandboxRoot, 'design-editor', 'resources'), { recursive: true });
  await fs.copyFile(indexWxssPath, path.join(sandboxRoot, 'miniprogram', 'pages', 'index', 'index.wxss'));

  const applyResult = await applyDesignToMiniprogram(draft, { projectRoot: sandboxRoot });
  assert.ok(applyResult.filesModified.some((item) => item.endsWith('miniprogram/pages/index/design-overrides.wxss')));
  assert.ok(applyResult.filesModified.every((item) => !item.endsWith('.js')), '应用不应修改 JS 文件');
  assert.ok(applyResult.filesModified.every((item) => !item.startsWith('cloudfunctions/')), '应用不应修改云函数');

  const sandboxIndexWxssPath = path.join(sandboxRoot, 'miniprogram', 'pages', 'index', 'index.wxss');
  const sandboxOverridePath = path.join(sandboxRoot, 'miniprogram', 'pages', 'index', 'design-overrides.wxss');
  const appliedIndexWxss = await fs.readFile(sandboxIndexWxssPath, 'utf8');
  assert.ok(appliedIndexWxss.includes('@import "./design-overrides.wxss";'), '应用后应注入设计覆盖层 import');
  assert.equal(await fs.stat(sandboxOverridePath).then(() => true).catch(() => false), true, '应用后应生成设计覆盖层文件');

  await applyDesignToMiniprogram(createEmptyDraft(), { projectRoot: sandboxRoot });
  const restoredIndexWxss = await fs.readFile(sandboxIndexWxssPath, 'utf8');
  const overrideStillExists = await fs.stat(sandboxOverridePath).then(() => true).catch(() => false);
  assert.equal(restoredIndexWxss.includes('@import "./design-overrides.wxss";'), false, '恢复默认后应移除设计覆盖层 import');
  assert.equal(overrideStillExists, false, '恢复默认后应删除设计覆盖层文件');

  console.log('design-editor local validate ok');
  console.log(JSON.stringify({
    deviceIds: DEVICE_IDS,
    tabBarOrder: TAB_BAR_ITEMS.map((item) => item.label),
    safeApplyCount: plan.summary.safeApplyCount,
    previewOnlyCount: plan.summary.previewOnlyCount,
    exportFiles: exportResult.files,
    appliedFiles: applyResult.filesModified
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
