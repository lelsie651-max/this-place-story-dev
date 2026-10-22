import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROPERTY_LIBRARY,
  buildComponentCatalog,
  listChanges
} from '../shared/schema.js';
import {
  getDefaultValue
} from '../shared/preview-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DESIGN_EDITOR_ROOT = path.resolve(__dirname, '..');
const IMPORT_LINE = '@import "./design-overrides.wxss";';

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function relativeToProject(projectRoot, targetPath) {
  return toPosix(path.relative(projectRoot, targetPath));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function loadProjectInputs(projectRoot = PROJECT_ROOT) {
  const [registry, tokens, assetManifest] = await Promise.all([
    readJson(path.join(projectRoot, 'design', 'component-registry.json')),
    readJson(path.join(projectRoot, 'design', 'design-tokens.json')),
    readJson(path.join(projectRoot, 'design', 'asset-manifest.json'))
  ]);

  return {
    registry,
    tokens,
    assetManifest,
    catalog: buildComponentCatalog(registry)
  };
}

function getPageWxssPath(projectRoot, pageId) {
  return path.join(projectRoot, 'miniprogram', 'pages', pageId, `${pageId}.wxss`);
}

function getPageOverrideWxssPath(projectRoot, pageId) {
  return path.join(projectRoot, 'miniprogram', 'pages', pageId, 'design-overrides.wxss');
}

function getLastApplyManifestPath(projectRoot) {
  return path.join(projectRoot, 'design-editor', 'resources', 'last-apply.json');
}

async function readLastApplyManifest(projectRoot) {
  const manifestPath = getLastApplyManifestPath(projectRoot);
  if (!(await pathExists(manifestPath))) {
    return { pagesTouched: [] };
  }
  return readJson(manifestPath);
}

function resolveAssetReference(draft, rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }

  const asset = draft.assets?.[rawValue];
  if (!asset) {
    return null;
  }

  return asset;
}

function normalizeDisplayValue(draft, value) {
  const asset = resolveAssetReference(draft, value);
  if (!asset) {
    return value;
  }

  return asset.relativeProjectPath || asset.previewPath || asset.fileName;
}

function propertyToCssDeclarations(propertyKey, value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  switch (propertyKey) {
    case 'buttonHeight':
      return [
        ['min-height', value],
        ['line-height', value]
      ];
    case 'borderWidth':
      return [
        ['border-width', value],
        ['border-style', 'solid']
      ];
    default: {
      const property = PROPERTY_LIBRARY[propertyKey];
      if (!property?.css) {
        return [];
      }
      return [[property.css, value]];
    }
  }
}

function escapeCssValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/\r?\n/g, ' ');
}

function buildChangeEntries(draft, catalog) {
  return listChanges(draft).map((change) => {
    const component = catalog.byId[change.designId];
    const property = PROPERTY_LIBRARY[change.propertyKey];
    const propertyState = component?.propertyStates?.[change.propertyKey] || {
      status: 'unsupported',
      reason: '当前组件没有开放这个属性。'
    };
    const asset = resolveAssetReference(draft, change.nextValue);

    return {
      ...change,
      pageName: component?.pageName || change.pageId,
      componentLabel: component?.label || change.designId,
      selector: component?.selector || '',
      safeApplySelector: component?.safeApplySelector || null,
      propertyLabel: property?.label || change.propertyKey,
      propertyGroup: property?.group || '未分类',
      status: propertyState.status,
      statusReason: propertyState.reason,
      previousValue: getDefaultValue(change.designId, change.propertyKey) ?? null,
      nextDisplayValue: normalizeDisplayValue(draft, change.nextValue),
      asset: asset
        ? {
            assetId: asset.assetId,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            width: asset.width || null,
            height: asset.height || null,
            relativeProjectPath: asset.relativeProjectPath || null
          }
        : null
    };
  });
}

export async function buildApplyPlan(draft, options = {}) {
  const projectRoot = options.projectRoot || PROJECT_ROOT;
  const { catalog } = await loadProjectInputs(projectRoot);
  const changes = buildChangeEntries(draft, catalog);
  const safeChanges = changes.filter((item) => item.status === 'safe' && item.safeApplySelector);
  const previewOnlyChanges = changes.filter((item) => item.status === 'preview');
  const unsupportedChanges = changes.filter((item) => item.status === 'unsupported' || (item.status === 'safe' && !item.safeApplySelector));
  const previousManifest = await readLastApplyManifest(projectRoot);
  const currentPages = Array.from(new Set(safeChanges.map((item) => item.pageId)));
  const affectedPages = Array.from(new Set([...(previousManifest.pagesTouched || []), ...currentPages]));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalChanges: changes.length,
      safeApplyCount: safeChanges.length,
      previewOnlyCount: previewOnlyChanges.length,
      unsupportedCount: unsupportedChanges.length
    },
    changes,
    safeChanges,
    previewOnlyChanges,
    unsupportedChanges,
    affectedPages,
    modifiedPages: Array.from(new Set(changes.map((item) => item.pageId))),
    modifiedComponents: Array.from(new Set(changes.map((item) => item.designId))),
    modifiedProperties: Array.from(new Set(changes.map((item) => item.propertyKey))),
    generatedWxssFiles: affectedPages.map((pageId) =>
      `miniprogram/pages/${pageId}/design-overrides.wxss`
    ),
    modifiedWxssFiles: affectedPages.map((pageId) =>
      `miniprogram/pages/${pageId}/${pageId}.wxss`
    ),
    modifiedWxmlFiles: []
  };
}

function buildCssBlocksForPage(pageId, safeChanges) {
  const selectorMap = new Map();

  safeChanges
    .filter((item) => item.pageId === pageId)
    .forEach((item) => {
      const key = `${item.designId}::${item.safeApplySelector}`;
      if (!selectorMap.has(key)) {
        selectorMap.set(key, {
          selector: item.safeApplySelector,
          designId: item.designId,
          label: item.componentLabel,
          declarations: []
        });
      }

      const target = selectorMap.get(key);
      propertyToCssDeclarations(item.propertyKey, item.nextDisplayValue).forEach(([cssProperty, cssValue]) => {
        target.declarations.push([cssProperty, cssValue]);
      });
    });

  return Array.from(selectorMap.values())
    .map((block) => {
      const declarations = block.declarations
        .map(([cssProperty, cssValue]) => `  ${cssProperty}: ${escapeCssValue(cssValue)};`)
        .join('\n');

      if (!declarations) {
        return '';
      }

      return `/* ${block.label} (${block.designId}) */\n${block.selector} {\n${declarations}\n}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

async function backupFiles(projectRoot, backupRoot, filePaths) {
  const copied = [];

  for (const filePath of filePaths) {
    if (!(await pathExists(filePath))) {
      continue;
    }

    const relativePath = path.relative(projectRoot, filePath);
    const targetPath = path.join(backupRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(filePath, targetPath);
    copied.push(relativeToProject(projectRoot, targetPath));
  }

  return copied;
}

function ensureImport(content) {
  if (content.includes(IMPORT_LINE)) {
    return content;
  }
  return `${IMPORT_LINE}\n${content}`;
}

function removeImport(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== IMPORT_LINE)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export async function applyDesignToMiniprogram(draft, options = {}) {
  const projectRoot = options.projectRoot || PROJECT_ROOT;
  const plan = await buildApplyPlan(draft, { projectRoot });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = options.backupRoot || path.join(projectRoot, 'design-editor', 'resources', 'backups', timestamp);
  const currentSafePages = Array.from(new Set(plan.safeChanges.map((item) => item.pageId)));
  const touchedFiles = new Set();

  for (const pageId of plan.affectedPages) {
    touchedFiles.add(getPageWxssPath(projectRoot, pageId));
    touchedFiles.add(getPageOverrideWxssPath(projectRoot, pageId));
  }

  const backups = await backupFiles(projectRoot, backupRoot, Array.from(touchedFiles));
  const filesModified = [];
  const filesDeleted = [];

  for (const pageId of plan.affectedPages) {
    const pageWxssPath = getPageWxssPath(projectRoot, pageId);
    const overrideWxssPath = getPageOverrideWxssPath(projectRoot, pageId);
    const pageHasSafeChanges = currentSafePages.includes(pageId);

    if (pageHasSafeChanges) {
      const cssBlocks = buildCssBlocksForPage(pageId, plan.safeChanges);
      const overrideContent = `/* Generated by design-editor. Do not edit manually. */\n${cssBlocks}\n`;

      await fs.mkdir(path.dirname(overrideWxssPath), { recursive: true });
      await fs.writeFile(overrideWxssPath, overrideContent, 'utf8');
      filesModified.push(relativeToProject(projectRoot, overrideWxssPath));

      const originalPageWxss = await fs.readFile(pageWxssPath, 'utf8');
      const nextPageWxss = ensureImport(originalPageWxss);
      if (nextPageWxss !== originalPageWxss) {
        await fs.writeFile(pageWxssPath, nextPageWxss, 'utf8');
        filesModified.push(relativeToProject(projectRoot, pageWxssPath));
      }
      continue;
    }

    if (await pathExists(overrideWxssPath)) {
      await fs.rm(overrideWxssPath, { force: true });
      filesDeleted.push(relativeToProject(projectRoot, overrideWxssPath));
    }

    if (await pathExists(pageWxssPath)) {
      const originalPageWxss = await fs.readFile(pageWxssPath, 'utf8');
      const nextPageWxss = removeImport(originalPageWxss);
      if (nextPageWxss !== originalPageWxss) {
        await fs.writeFile(pageWxssPath, nextPageWxss, 'utf8');
        filesModified.push(relativeToProject(projectRoot, pageWxssPath));
      }
    }
  }

  const manifestPath = getLastApplyManifestPath(projectRoot);
  await writeJson(manifestPath, {
    appliedAt: new Date().toISOString(),
    pagesTouched: currentSafePages
  });

  return {
    appliedAt: new Date().toISOString(),
    backupRoot: relativeToProject(projectRoot, backupRoot),
    filesModified: Array.from(new Set(filesModified)),
    filesDeleted: Array.from(new Set(filesDeleted)),
    backups,
    previewOnlyChanges: plan.previewOnlyChanges,
    unsupportedChanges: plan.unsupportedChanges,
    safeChanges: plan.safeChanges
  };
}

export async function exportDesignFiles(draft, options = {}) {
  const projectRoot = options.projectRoot || PROJECT_ROOT;
  const exportRoot = options.exportRoot || path.join(projectRoot, 'design', 'export');
  const { catalog, tokens, assetManifest } = await loadProjectInputs(projectRoot);
  const plan = await buildApplyPlan(draft, { projectRoot });
  const changes = buildChangeEntries(draft, catalog);
  const exportedAt = new Date().toISOString();
  const uploadedAssets = Object.values(draft.assets || {});

  await fs.mkdir(exportRoot, { recursive: true });

  await writeJson(path.join(exportRoot, 'design-tokens.json'), {
    exportedAt,
    baseTokensSource: 'design/design-tokens.json',
    baseTokens: tokens,
    overrideCount: changes.length,
    safeApplyCount: plan.safeChanges.length
  });

  await writeJson(path.join(exportRoot, 'page-overrides.json'), {
    exportedAt,
    changes
  });

  await writeJson(path.join(exportRoot, 'asset-manifest.json'), {
    exportedAt,
    baseSummary: assetManifest.summary,
    baseAssets: assetManifest.assets,
    uploadedAssets
  });

  await writeJson(path.join(exportRoot, 'design-preview.json'), {
    exportedAt,
    plan
  });

  const readmeContent = [
    '# 设计导出说明',
    '',
    `导出时间：${exportedAt}`,
    '',
    '## 包含文件',
    '',
    '- `design-tokens.json`：当前基线 token 快照与导出摘要',
    '- `page-overrides.json`：逐页面、逐组件、逐属性的修改记录',
    '- `asset-manifest.json`：基础资源清单与编辑器上传资源记录',
    '- `design-preview.json`：应用前差异预览、可应用范围和限制',
    '',
    '## 当前导出摘要',
    '',
    `- 总修改数：${changes.length}`,
    `- 可安全应用：${plan.safeChanges.length}`,
    `- 仅编辑器预览：${plan.previewOnlyChanges.length}`,
    `- 当前不支持：${plan.unsupportedChanges.length}`,
    '',
    '## 说明',
    '',
    '- 只有 `status = safe` 且存在稳定选择器的属性，才会自动生成 WXSS 设计覆盖层。',
    '- `preview` 属性会保留在导出文件中，便于后续继续实现，但当前不会自动写入小程序源码。',
    '- `unsupported` 属性会明确保留原因，不会伪装成已经生效。'
  ].join('\n');

  await fs.writeFile(path.join(exportRoot, 'README.md'), readmeContent + '\n', 'utf8');

  return {
    exportedAt,
    files: [
      'design/export/design-tokens.json',
      'design/export/page-overrides.json',
      'design/export/asset-manifest.json',
      'design/export/design-preview.json',
      'design/export/README.md'
    ]
  };
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function saveUploadedAsset(payload, options = {}) {
  const projectRoot = options.projectRoot || PROJECT_ROOT;
  const uploadsRoot = options.uploadsRoot || path.join(projectRoot, 'design-editor', 'resources', 'uploads');
  const stamp = Date.now();
  const safeName = sanitizeFileName(payload.fileName || 'asset.bin');
  const storedName = `${stamp}-${safeName}`;
  const filePath = path.join(uploadsRoot, storedName);
  const base64 = String(payload.base64 || '').replace(/^data:[^;]+;base64,/, '');

  await fs.mkdir(uploadsRoot, { recursive: true });
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));

  const assetId = `asset_${stamp}_${Math.random().toString(36).slice(2, 8)}`;
  const relativeProjectPath = relativeToProject(projectRoot, filePath);
  const previewPath = `/resources/uploads/${storedName}`;

  return {
    assetId,
    fileName: payload.fileName,
    storedName,
    mimeType: payload.mimeType || 'application/octet-stream',
    width: payload.width || null,
    height: payload.height || null,
    pageId: payload.pageId || null,
    designId: payload.designId || null,
    propertyKey: payload.propertyKey || null,
    uploadedAt: new Date().toISOString(),
    relativeProjectPath,
    previewPath
  };
}

export async function readJsonFile(filePath) {
  return readJson(filePath);
}

export function getProjectRoot() {
  return PROJECT_ROOT;
}

export function getDesignEditorRoot() {
  return DESIGN_EDITOR_ROOT;
}
