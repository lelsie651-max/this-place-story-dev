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
  const indexWxssPath = path.join(projectRoot, 'miniprogram', 'pages', 'index', 'index.wxss');
  const storyWxssPath = path.join(projectRoot, 'miniprogram', 'pages', 'story', 'story.wxss');
  const beforeIndexWxss = await fs.readFile(indexWxssPath, 'utf8');
  const beforeStoryWxss = await fs.readFile(storyWxssPath, 'utf8');

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

  const afterIndexWxss = await fs.readFile(indexWxssPath, 'utf8');
  const afterStoryWxss = await fs.readFile(storyWxssPath, 'utf8');
  assert.equal(afterIndexWxss, beforeIndexWxss, '未点击应用前，index.wxss 不应变化');
  assert.equal(afterStoryWxss, beforeStoryWxss, '未点击应用前，story.wxss 不应变化');

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
