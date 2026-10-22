import registryData from '../../design/component-registry.json';
import tokensData from '../../design/design-tokens.json';
import assetManifestData from '../../design/asset-manifest.json';

import './styles.css';

import {
  PROPERTY_LIBRARY,
  UNSUPPORTED_ITEMS,
  buildComponentCatalog
} from '../shared/schema.js';
import {
  calculateFitScale,
  convertPxToRpx,
  DEVICE_PRESETS,
  DEFAULT_DEVICE_ID,
  PAGE_SAMPLE_DATA,
  SCALE_OPTIONS,
  TAB_BAR_CONFIG,
  TAB_BAR_ITEMS,
  getDeviceMetrics,
  getDeviceProfile as getPreviewDeviceProfile,
  getDefaultComponentState,
  getDefaultValue,
  replaceRpxWithPx
} from '../shared/preview-data.js';
import {
  applyAsset,
  applyOverride,
  clearOverride,
  createEditorState,
  getOverrideValue,
  hasUnsavedChanges,
  markSaved,
  redo,
  restoreAll,
  restoreComponent,
  restorePage,
  selectComponent,
  selectDevice,
  selectPage,
  selectScale,
  undo
} from './editor-core.js';

const catalog = buildComponentCatalog(registryData);
const pageList = Object.keys(catalog.byPage);
const LOCAL_STATE_KEY = 'this-place-story.design-editor.state.v2';
const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_FONT_FILE_SIZE = 6 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const SUPPORTED_FONT_TYPES = ['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/font-woff', 'application/font-sfnt'];
const DEFAULT_NOTICE = { tone: 'info', message: '' };
const statusLabels = {
  safe: '可应用',
  preview: '仅预览',
  unsupported: '不支持'
};
const ADVANCED_GROUP_ORDER = ['文字', '背景', '尺寸和间距', '按钮和卡片', '图片和 Banner'];
const IMAGE_FILE_ACCEPT = '.png,.jpg,.jpeg,.webp';
const FONT_FILE_ACCEPT = '.ttf,.otf,.woff,.woff2';
const SUPPORTED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const SUPPORTED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];
const TEXT_AND_FONT_KEYS = ['text', 'fontFamily', 'fontAssetId', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign'];
const STYLE_KEYS = ['color', 'background', 'cardBackground', 'buttonBackground', 'buttonTextColor', 'buttonRadius', 'buttonHeight', 'borderRadius', 'borderColor', 'borderWidth', 'boxShadow', 'padding', 'margin', 'width', 'height'];
const MATERIAL_BUNDLES = {
  background: ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  image: ['imageSrc', 'objectFit'],
  buttonImage: ['buttonVisualMode', 'buttonImageSrc', 'buttonImageFit', 'buttonImagePosition', 'buttonKeepText', 'buttonImageFill', 'buttonImageRadius'],
  font: ['fontAssetId']
};

const PAGE_NAV_TITLES = {
  index: '首页',
  profile: '我的',
  atlas: '足迹',
  discovery: '寻找传说',
  location: '地点详情',
  story: '故事详情',
  publish: '投稿',
  myStories: '我的投稿',
  myStoryPreview: '投稿预览',
  myStoryEdit: '重新编辑'
};

let state = loadInitialState();
let modalState = null;

const app = document.querySelector('#app');
const uiState = {
  fitScale: 1,
  sidebarScrollTop: 0,
  treeScrollTop: 0,
  inspectorScrollTop: 0,
  inspectorScrollByComponent: {},
  phoneScrollByPage: {},
  pendingPhoneScrollReset: false,
  inspectorOpenByComponent: {},
  resizeObserver: null,
  lastRenderedPageId: state.selectedPageId,
  latestMeasurement: null,
  notice: DEFAULT_NOTICE,
  measurementFrame: null
};

window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges(state)) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
});

window.addEventListener('resize', () => {
  window.requestAnimationFrame(applyPreviewScale);
  scheduleMeasurement();
});

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadInitialState() {
  const baseState = syncSelectedComponent(createEditorState(), createEditorState().selectedPageId);
  try {
    const payload = safeParseJson(window.localStorage.getItem(LOCAL_STATE_KEY) || '');
    if (!payload?.draft) {
      return baseState;
    }

    return syncSelectedComponent({
      ...baseState,
      draft: payload.draft,
      history: baseState.history,
      historyIndex: baseState.historyIndex,
      lastSavedHash: payload.lastSavedHash || baseState.lastSavedHash,
      selectedPageId: payload.selectedPageId || baseState.selectedPageId,
      selectedComponentId: payload.selectedComponentId || baseState.selectedComponentId,
      selectedDeviceId: payload.selectedDeviceId || baseState.selectedDeviceId,
      selectedScale: payload.selectedScale || baseState.selectedScale
    }, payload.selectedPageId || baseState.selectedPageId);
  } catch {
    return baseState;
  }
}

function persistEditorState() {
  try {
    window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({
      draft: state.draft,
      lastSavedHash: state.lastSavedHash,
      selectedPageId: state.selectedPageId,
      selectedComponentId: state.selectedComponentId,
      selectedDeviceId: state.selectedDeviceId,
      selectedScale: state.selectedScale
    }));
  } catch {
    // Ignore storage failures in preview-only environments.
  }
}

function setNotice(message = '', tone = 'info') {
  uiState.notice = { tone, message };
}

function syncSelectedComponent(nextState, pageId) {
  const components = catalog.byPage[pageId] || [];
  const hasSelected = components.some((item) => item.designId === nextState.selectedComponentId);
  if (hasSelected) {
    return nextState;
  }

  const fallback = components[0]?.designId || nextState.selectedComponentId;
  return selectComponent(nextState, fallback);
}

function getComponentKey(pageId = state.selectedPageId, designId = state.selectedComponentId) {
  return `${pageId}:${designId}`;
}

function captureUiState() {
  const sidebarBody = app.querySelector('[data-sidebar-scroll]');
  if (sidebarBody) {
    uiState.sidebarScrollTop = sidebarBody.scrollTop;
  }

  const treeBody = app.querySelector('[data-tree-scroll]');
  if (treeBody) {
    uiState.treeScrollTop = treeBody.scrollTop;
  }

  const inspectorBody = app.querySelector('[data-inspector-scroll]');
  if (inspectorBody) {
    uiState.inspectorScrollTop = inspectorBody.scrollTop;
    uiState.inspectorScrollByComponent[getComponentKey()] = inspectorBody.scrollTop;
  }

  const phoneScroll = app.querySelector('[data-phone-scroll]');
  if (phoneScroll) {
    uiState.phoneScrollByPage[uiState.lastRenderedPageId] = phoneScroll.scrollTop;
  }
}

function restoreUiState() {
  window.requestAnimationFrame(() => {
    const sidebarBody = app.querySelector('[data-sidebar-scroll]');
    if (sidebarBody) {
      sidebarBody.scrollTop = uiState.sidebarScrollTop;
    }

    const treeBody = app.querySelector('[data-tree-scroll]');
    if (treeBody) {
      treeBody.scrollTop = uiState.treeScrollTop;
    }

    const inspectorBody = app.querySelector('[data-inspector-scroll]');
    if (inspectorBody) {
      inspectorBody.scrollTop = uiState.inspectorScrollByComponent[getComponentKey()] ?? uiState.inspectorScrollTop;
    }

    const phoneScroll = app.querySelector('[data-phone-scroll]');
    if (phoneScroll) {
      const scrollTop = uiState.pendingPhoneScrollReset
        ? 0
        : (uiState.phoneScrollByPage[state.selectedPageId] ?? 0);
      phoneScroll.scrollTop = scrollTop;
      uiState.phoneScrollByPage[state.selectedPageId] = scrollTop;
      uiState.pendingPhoneScrollReset = false;
    }

    uiState.lastRenderedPageId = state.selectedPageId;
    bindCanvasResizeObserver();
    applyPreviewScale();
    scheduleMeasurement();
  });
}

function setState(nextState) {
  state = syncSelectedComponent(nextState, nextState.selectedPageId);
  persistEditorState();
  render();
}

function getComponent(designId = state.selectedComponentId) {
  return catalog.byId[designId];
}

function getResolvedValue(designId, propertyKey) {
  const overrideValue = getOverrideValue(state, state.selectedPageId, designId, propertyKey);
  if (overrideValue !== undefined) {
    const asset = state.draft.assets?.[overrideValue];
    if (asset?.previewPath) {
      return asset.previewPath;
    }
    if (asset?.relativeProjectPath) {
      return asset.relativeProjectPath;
    }
    return overrideValue;
  }

  return getDefaultValue(designId, propertyKey);
}

function getResolvedStyle(designId) {
  const defaults = getDefaultComponentState(designId);
  const overrides = state.draft.overrides?.[state.selectedPageId]?.[designId] || {};
  const resolved = { ...defaults };

  Object.entries(overrides).forEach(([propertyKey, propertyValue]) => {
    const asset = state.draft.assets?.[propertyValue];
    if (propertyKey === 'fontAssetId') {
      resolved[propertyKey] = propertyValue;
      if (asset?.fontFamily) {
        resolved.fontFamily = `"${asset.fontFamily}", ${resolved.fontFamily || defaults.fontFamily || 'sans-serif'}`;
      }
      return;
    }

    if (PROPERTY_LIBRARY[propertyKey]?.input === 'asset') {
      resolved[propertyKey] = asset?.previewPath || asset?.relativeProjectPath || propertyValue;
      return;
    }

    resolved[propertyKey] = propertyValue;
  });

  return resolved;
}

function getSelectedDevice() {
  return getPreviewDeviceProfile(state.selectedDeviceId || DEFAULT_DEVICE_ID);
}

function toPreviewCssValue(value) {
  return replaceRpxWithPx(value, getSelectedDevice().width);
}

function styleObjectToString(styleObject) {
  return Object.entries(styleObject)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([property, value]) => `${property}: ${toPreviewCssValue(value)};`)
    .join(' ');
}

function getSelectedDeviceMetrics() {
  return getDeviceMetrics(getSelectedDevice());
}

function getSelectedScaleLabel() {
  if (state.selectedScale === 'fit') {
    return `适合窗口 ${Math.round((uiState.fitScale || 1) * 100)}%`;
  }

  const match = SCALE_OPTIONS.find((item) => item.value === String(state.selectedScale));
  return match?.label || `${Math.round((Number(state.selectedScale) || 1) * 100)}%`;
}

function renderPreviewMeta() {
  const device = getSelectedDevice();
  const metrics = getSelectedDeviceMetrics();
  const safeAreaText = device.safeAreaMeasured
    ? `${metrics.safeAreaBottom}px（已测量）`
    : '未测量（当前按 0px 占位）';
  const chromeText = device.chrome.measurementStatus === 'simulated'
    ? '顶部系统区与 tabBar 高度为模拟值'
    : '顶部系统区与 tabBar 高度已测量';

  return `
    <div class="preview-meta-card">
      <div class="preview-meta-line">
        <strong>当前预览使用：</strong>
        <span>设计单位：rpx</span>
        <span>换算规则：rpx × viewportWidth ÷ 750</span>
      </div>
      <div class="preview-meta-line">
        <span>当前设备：${device.name}</span>
        <span>当前 viewport：${device.width} × ${device.height}</span>
        <span>DPR：${device.dpr}</span>
        <span>当前编辑器缩放：${getSelectedScaleLabel()}</span>
      </div>
      <div class="preview-meta-line">
        <span>safe-area：${safeAreaText}</span>
        <span>${chromeText}</span>
        <span>tabBar 来源：${TAB_BAR_CONFIG.source}</span>
      </div>
      ${uiState.notice.message ? `<div class="preview-meta-line preview-meta-line--${uiState.notice.tone}">${uiState.notice.message}</div>` : ''}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFileSize(sizeBytes) {
  const size = Number(sizeBytes || 0);
  if (!size) {
    return '未知大小';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getAssetByReference(reference) {
  if (!reference || typeof reference !== 'string') {
    return null;
  }
  return state.draft.assets?.[reference] || null;
}

function getAssetValue(designId, propertyKey) {
  const rawValue = getOverrideValue(state, state.selectedPageId, designId, propertyKey);
  return rawValue !== undefined ? rawValue : getDefaultValue(designId, propertyKey);
}

function getSelectedAssetMeta(designId, propertyKey) {
  return getAssetByReference(getAssetValue(designId, propertyKey));
}

function getPropertyState(component, propertyKey) {
  return component.propertyStates[propertyKey] || {
    status: 'unsupported',
    reason: '当前组件没有开放这个属性。'
  };
}

function isPropertyOverridden(designId, propertyKey) {
  return getOverrideValue(state, state.selectedPageId, designId, propertyKey) !== undefined;
}

function extractPrimaryFontFamily(fontFamilyValue) {
  const raw = String(fontFamilyValue || '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim();
  return raw || null;
}

function getFontFormat(asset) {
  const mime = String(asset?.mimeType || '').toLowerCase();
  const fileName = String(asset?.fileName || '').toLowerCase();
  if (mime.includes('woff2') || fileName.endsWith('.woff2')) {
    return 'woff2';
  }
  if (mime.includes('woff') || fileName.endsWith('.woff')) {
    return 'woff';
  }
  if (mime.includes('otf') || fileName.endsWith('.otf')) {
    return 'opentype';
  }
  if (mime.includes('ttf') || fileName.endsWith('.ttf')) {
    return 'truetype';
  }
  return '';
}

function isTrueLike(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value) === 'true';
}

function buildBackgroundStyles(style, baseKey = 'cardBackground') {
  const backgroundStyles = {};
  if (style?.[baseKey]) {
    backgroundStyles.background = style[baseKey];
  }
  if (style?.backgroundImage) {
    const overlay = style.backgroundOverlayColor
      ? `linear-gradient(${style.backgroundOverlayColor}, ${style.backgroundOverlayColor}), `
      : '';
    backgroundStyles.backgroundImage = `${overlay}url("${style.backgroundImage}")`;
    backgroundStyles.backgroundSize = style.backgroundSize || 'cover';
    backgroundStyles.backgroundPosition = style.backgroundPosition || 'center';
    backgroundStyles.backgroundRepeat = style.backgroundRepeat || 'no-repeat';
  }
  return backgroundStyles;
}

function renderPreviewFontFaces() {
  const fontRules = [];
  const seenRules = new Set();
  const fontAssets = Object.values(state.draft.assets || {}).filter((asset) => asset?.mimeType && SUPPORTED_FONT_TYPES.includes(asset.mimeType));

  fontAssets.forEach((asset) => {
    const aliases = new Set();
    aliases.add(asset.fontFamily || asset.fileName?.replace(/\.[^.]+$/, '') || asset.assetId);

    Object.entries(state.draft.overrides || {}).forEach(([, componentMap]) => {
      Object.entries(componentMap || {}).forEach(([, propertyMap]) => {
        if (propertyMap?.fontAssetId !== asset.assetId) {
          return;
        }
        const alias = extractPrimaryFontFamily(propertyMap.fontFamily);
        if (alias) {
          aliases.add(alias);
        }
      });
    });

    aliases.forEach((alias) => {
      const ruleKey = `${asset.assetId}:${alias}`;
      if (!alias || seenRules.has(ruleKey)) {
      return;
      }
      seenRules.add(ruleKey);
      const format = getFontFormat(asset);
      fontRules.push(`@font-face { font-family: "${alias}"; src: url("${asset.previewPath || asset.relativeProjectPath}")${format ? ` format("${format}")` : ''}; font-display: swap; }`);
    });
  });

  return fontRules.length ? `<style data-preview-fonts>${fontRules.join('\n')}</style>` : '';
}

function resolveTextStyle(style, extra = {}) {
  return styleObjectToString({
    fontSize: style.fontSize,
    color: style.color,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    fontFamily: style.fontFamily,
    textAlign: style.textAlign,
    margin: style.margin,
    ...extra
  });
}

function renderButtonNode(designId, style, fallbackText) {
  const isImageMode = style.buttonVisualMode === 'image' && style.buttonImageSrc;
  const keepText = isTrueLike(style.buttonKeepText, true);
  const fillImage = isTrueLike(style.buttonImageFill, true);
  const imageLayer = isImageMode
    ? `
      <span
        class="mini-button-image-layer"
        style="${styleObjectToString({
          backgroundImage: `url("${style.buttonImageSrc}")`,
          backgroundSize: fillImage ? (style.buttonImageFit || 'cover') : 'contain',
          backgroundPosition: style.buttonImagePosition || 'center',
          backgroundRepeat: 'no-repeat',
          borderRadius: style.buttonImageRadius || style.buttonRadius
        })}"
      ></span>
    `
    : '';

  return previewNode(designId, `
    <div class="mini-button ${isImageMode ? 'is-image-mode' : ''}" style="${styleObjectToString({
      minHeight: style.buttonHeight,
      lineHeight: style.lineHeight || style.buttonHeight,
      background: isImageMode ? 'transparent' : style.buttonBackground,
      color: style.buttonTextColor,
      borderRadius: style.buttonRadius,
      padding: style.padding,
      boxShadow: style.boxShadow,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      textAlign: style.textAlign,
      borderColor: style.borderColor,
      borderWidth: style.borderWidth,
      borderStyle: style.borderWidth && style.borderWidth !== '0' ? 'solid' : 'none'
    })}">
      ${imageLayer}
      ${(keepText || !isImageMode) ? `<span class="mini-button-label">${style.text || fallbackText}</span>` : ''}
    </div>
  `);
}

function scheduleMeasurement() {
  if (uiState.measurementFrame) {
    cancelAnimationFrame(uiState.measurementFrame);
  }
  uiState.measurementFrame = window.requestAnimationFrame(() => {
    const target = app.querySelector(`[data-measure-id="${state.selectedComponentId}"]`);
    const rect = target?.getBoundingClientRect();
    if (!target || !rect) {
      uiState.latestMeasurement = null;
      return;
    }

    const viewportWidth = getSelectedDevice().width;
    uiState.latestMeasurement = {
      widthPx: Number(rect.width.toFixed(2)),
      heightPx: Number(rect.height.toFixed(2)),
      widthRpx: Number(convertPxToRpx(rect.width, viewportWidth).toFixed(2)),
      heightRpx: Number(convertPxToRpx(rect.height, viewportWidth).toFixed(2)),
      measuredAt: new Date().toISOString()
    };
  });
}

function formatMeasurementValue(value, unit) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return `-- ${unit}`;
  }
  return `${Number(value).toFixed(2)} ${unit}`;
}

async function copyToClipboard(text, successMessage) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setNotice(successMessage, 'success');
      render();
      return;
    }
  } catch {
    // Continue to fallback.
  }

  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  try {
    document.execCommand('copy');
    setNotice(successMessage, 'success');
  } catch {
    setNotice('复制失败，请手动复制。', 'error');
  } finally {
    document.body.removeChild(temp);
    render();
  }
}

function getMeasurementCopyText(mode = 'size') {
  const measurement = uiState.latestMeasurement;
  if (!measurement) {
    return '';
  }

  if (mode === 'recommended-image') {
    return `${Math.round(measurement.widthPx)} x ${Math.round(measurement.heightPx)} px`;
  }

  return [
    `实际宽度：${measurement.widthPx}px`,
    `实际高度：${measurement.heightPx}px`,
    `换算宽度：${measurement.widthRpx}rpx`,
    `换算高度：${measurement.heightRpx}rpx`,
    `设备：${getSelectedDevice().name}`,
    `viewport：${getSelectedDevice().width} x ${getSelectedDevice().height}`
  ].join('\n');
}

function buildCardStyles(style, extraStyles = {}) {
  return {
    ...buildBackgroundStyles(style, 'cardBackground'),
    padding: style.padding,
    margin: style.margin,
    borderRadius: style.borderRadius,
    borderColor: style.cardBorderColor,
    borderWidth: style.cardBorderColor ? '1rpx' : undefined,
    borderStyle: style.cardBorderColor ? 'solid' : undefined,
    boxShadow: style.cardShadow,
    ...extraStyles
  };
}

function isSelected(designId) {
  return state.selectedComponentId === designId ? 'is-selected' : '';
}

function previewNode(designId, innerHtml, extraClass = '') {
  const component = catalog.byId[designId];
  return `
    <div class="preview-node ${isSelected(designId)} ${extraClass}" data-preview-id="${designId}">
      <span class="preview-node-badge">${component?.label || designId}</span>
      <div class="preview-node-surface" data-measure-id="${designId}">
        ${innerHtml}
      </div>
    </div>
  `;
}

function renderTextNode(designId, className, fallbackText = '', extraStyles = {}) {
  const style = getResolvedStyle(designId);
  return previewNode(designId, `
    <div class="${className}" style="${resolveTextStyle(style, extraStyles)}">
      ${escapeHtml(style.text || fallbackText)}
    </div>
  `);
}

function renderCardNode(designId, innerHtml, extraClass = 'mini-panel', extraStyles = {}) {
  const style = getResolvedStyle(designId);
  return previewNode(designId, `
    <div class="${extraClass}" style="${styleObjectToString(buildCardStyles(style, extraStyles))}">
      ${innerHtml}
    </div>
  `);
}

function renderPageSurfaceNode(designId, extraClass, innerHtml) {
  const surface = getResolvedStyle(designId);
  return previewNode(designId, `
    <div class="mini-page ${extraClass}" style="${styleObjectToString({
      ...buildBackgroundStyles(surface, 'background'),
      minHeight: '100%'
    })}">
      ${innerHtml}
    </div>
  `, 'preview-node--surface');
}

function renderStatusBar() {
  const metrics = getSelectedDeviceMetrics();
  return `
    <div class="phone-status-bar" style="height: ${metrics.statusBarHeight}px;">
      <span>9:41</span>
      <span class="phone-status-icons">
        <span>5G</span>
        <span>◖◗</span>
      </span>
    </div>
  `;
}

function renderNavigationBar() {
  const metrics = getSelectedDeviceMetrics();
  return `
    <div class="phone-navigation-bar" style="height: ${metrics.navigationBarHeight}px;">
      <span class="phone-navigation-title">${PAGE_NAV_TITLES[state.selectedPageId] || '页面预览'}</span>
      <span class="phone-navigation-badge">${getSelectedDevice().chrome.measurementStatus === 'simulated' ? '模拟系统区' : '已测量系统区'}</span>
    </div>
  `;
}

function getTabKeyForPage(pageId) {
  return TAB_BAR_ITEMS.some((item) => item.key === pageId) ? pageId : null;
}

function renderTabBar(activeKey) {
  const metrics = getSelectedDeviceMetrics();
  const device = getSelectedDevice();
  return `
    <div
      class="phone-tabbar"
      style="
        min-height: ${metrics.bottomBarHeight}px;
        --tabbar-height: ${metrics.tabBarHeight}px;
        --safe-area-bottom: ${metrics.safeAreaBottom}px;
        --tabbar-padding-top: ${metrics.tabBarPaddingTop}px;
        --tabbar-padding-horizontal: ${metrics.tabBarPaddingHorizontal}px;
        --tabbar-padding-bottom: ${metrics.tabBarPaddingBottom}px;
      "
    >
      ${TAB_BAR_ITEMS.map((item) => `
        <div class="phone-tabbar-item ${item.key === activeKey ? 'is-active' : ''}">
          <span class="phone-tabbar-icon">${item.icon}</span>
          <span>${item.label}</span>
        </div>
      `).join('')}
      ${device.safeAreaMeasured ? '' : '<div class="phone-safe-area-note">safe-area 未测量</div>'}
    </div>
  `;
}

function renderPhoneShell(content) {
  const metrics = getSelectedDeviceMetrics();
  const activeTab = getTabKeyForPage(state.selectedPageId);
  return `
    <div
      class="phone-frame-shell"
      data-phone-shell
      style="
        --device-width: ${metrics.viewportWidth}px;
        --device-height: ${metrics.viewportHeight}px;
        --frame-width: ${metrics.frameWidth}px;
        --frame-height: ${metrics.frameHeight}px;
        --frame-padding: ${metrics.framePadding}px;
        --phone-screen-radius: ${metrics.screenRadius}px;
        --phone-bottom-bar-height: ${metrics.bottomBarHeight}px;
      "
    >
      <div class="phone-frame">
        <div class="phone-screen" data-phone-screen>
          <div class="phone-scroll ${activeTab ? 'has-tabbar' : ''}" data-phone-scroll>
            <div class="page-content">
              <div class="phone-top-chrome">
                ${renderStatusBar()}
                ${renderNavigationBar()}
              </div>
              ${content}
            </div>
            ${activeTab ? renderTabBar(activeTab) : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getGroupedProperties(component) {
  const grouped = component.supportedProperties.reduce((acc, propertyKey) => {
    const property = PROPERTY_LIBRARY[propertyKey];
    const groupName = property?.group || '未分类';
    acc[groupName] = acc[groupName] || [];
    acc[groupName].push(propertyKey);
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(grouped).sort((left, right) => {
      const leftIndex = ADVANCED_GROUP_ORDER.indexOf(left[0]);
      const rightIndex = ADVANCED_GROUP_ORDER.indexOf(right[0]);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    })
  );
}

function getAssetAcceptForProperty(propertyKey) {
  return propertyKey === 'fontAssetId' ? FONT_FILE_ACCEPT : IMAGE_FILE_ACCEPT;
}

function renderStatusBadge(status) {
  return `<span class="property-status ${status}">${statusLabels[status] || statusLabels.unsupported}</span>`;
}

function renderPropertyInput(component, propertyKey) {
  const property = PROPERTY_LIBRARY[propertyKey];
  const controlId = `prop-${component.designId}-${propertyKey}`;
  const currentValue = getResolvedValue(component.designId, propertyKey) ?? '';
  const colorValue = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(currentValue))
    ? String(currentValue)
    : '#8b5e34';

  if (property.input === 'textarea') {
    return `<textarea id="${controlId}" data-property="${propertyKey}" data-design-id="${component.designId}">${escapeHtml(currentValue)}</textarea>`;
  }
  if (property.input === 'select') {
    return `
      <select id="${controlId}" data-property="${propertyKey}" data-design-id="${component.designId}">
        ${(property.options || []).map((option) => `
          <option value="${option}" ${option === currentValue ? 'selected' : ''}>${option}</option>
        `).join('')}
      </select>
    `;
  }
  if (property.input === 'color-text') {
    return `
      <div class="color-input-row">
        <input type="text" id="${controlId}" value="${escapeHtml(currentValue)}" data-property="${propertyKey}" data-design-id="${component.designId}">
        <input type="color" value="${colorValue}" data-color-proxy="${propertyKey}" data-design-id="${component.designId}">
      </div>
    `;
  }
  if (property.input === 'asset') {
    const asset = getSelectedAssetMeta(component.designId, propertyKey);
    return `
      <div class="asset-row">
        <input type="text" id="${controlId}" value="${escapeHtml(asset?.fileName || currentValue)}" data-property="${propertyKey}" data-design-id="${component.designId}" readonly>
        <label class="file-picker-inline">
          选择文件
          <input type="file" accept="${getAssetAcceptForProperty(propertyKey)}" data-asset-property="${propertyKey}" data-design-id="${component.designId}">
        </label>
      </div>
    `;
  }

  return `<input type="text" id="${controlId}" value="${escapeHtml(currentValue)}" data-property="${propertyKey}" data-design-id="${component.designId}">`;
}

function renderPropertyField(component, propertyKey, options = {}) {
  const property = PROPERTY_LIBRARY[propertyKey];
  if (!property) {
    return '';
  }
  const propertyState = getPropertyState(component, propertyKey);
  const isOverridden = isPropertyOverridden(component.designId, propertyKey);
  return `
    <div class="property-item ${options.compact ? 'property-item--compact' : ''}">
      <div class="property-head">
        <label for="prop-${component.designId}-${propertyKey}">${property.label}</label>
        <div class="property-head-actions">
          ${renderStatusBadge(propertyState.status)}
          ${isOverridden ? `<button type="button" class="link-button" data-clear-property="${propertyKey}" data-design-id="${component.designId}">恢复默认</button>` : ''}
        </div>
      </div>
      ${renderPropertyInput(component, propertyKey)}
      ${options.hideReason ? '' : `<div class="asset-meta">${propertyState.reason}</div>`}
    </div>
  `;
}

function renderInspectorSection(title, description, bodyHtml) {
  return `
    <section class="inspector-section">
      <div class="inspector-section-head">
        <h3>${title}</h3>
        <p>${description}</p>
      </div>
      <div class="inspector-section-body">${bodyHtml}</div>
    </section>
  `;
}

function renderMeasurementSection(component) {
  const measurement = uiState.latestMeasurement;
  return renderInspectorSection(
    '组件尺寸',
    '基于当前预览 DOM 的 getBoundingClientRect() 实时测量，和微信开发者工具测量值分开看。',
    `
      <div class="info-grid">
        <div><span>组件名称</span><strong>${escapeHtml(component.label)}</strong></div>
        <div><span>designId</span><code>${component.designId}</code></div>
        <div><span>当前设备</span><strong>${escapeHtml(getSelectedDevice().name)}</strong></div>
        <div><span>当前 viewport</span><strong>${getSelectedDevice().width} × ${getSelectedDevice().height}</strong></div>
      </div>
      <div class="measurement-grid">
        <div><span>实际宽度</span><strong>${formatMeasurementValue(measurement?.widthPx, 'px')}</strong></div>
        <div><span>实际高度</span><strong>${formatMeasurementValue(measurement?.heightPx, 'px')}</strong></div>
        <div><span>换算宽度</span><strong>${formatMeasurementValue(measurement?.widthRpx, 'rpx')}</strong></div>
        <div><span>换算高度</span><strong>${formatMeasurementValue(measurement?.heightRpx, 'rpx')}</strong></div>
      </div>
      <div class="section-actions">
        <button type="button" data-copy-measurement="size" ${measurement ? '' : 'disabled'}>复制尺寸</button>
        <button type="button" data-copy-measurement="recommended-image" ${measurement ? '' : 'disabled'}>复制推荐图片尺寸</button>
      </div>
      <div class="asset-meta">${measurement ? '以上为编辑器预览测量值，微信开发者工具实际值需单独复核。' : '当前没有测量到稳定 DOM，请先选择可见组件后重试。'}</div>
    `
  );
}

function renderAssetPreview(previewSrc, emptyText, altText = '素材预览') {
  if (!previewSrc) {
    return `<div class="asset-preview is-empty"><span>${emptyText}</span></div>`;
  }
  return `<div class="asset-preview"><img src="${previewSrc}" alt="${escapeHtml(altText)}"></div>`;
}

function renderMaterialAssetCard(component, config) {
  const assetMeta = getSelectedAssetMeta(component.designId, config.propertyKey);
  const previewSrc = getResolvedValue(component.designId, config.propertyKey);
  const propertyState = getPropertyState(component, config.propertyKey);
  const sourceLabel = assetMeta
    ? `已上传：${assetMeta.fileName}`
    : previewSrc
      ? '默认素材'
      : '当前无素材';

  return `
    <article class="material-card">
      <div class="material-card-head">
        <div>
          <h4>${config.title}</h4>
          <p>当前素材：${escapeHtml(sourceLabel)}</p>
        </div>
        ${renderStatusBadge(propertyState.status)}
      </div>
      ${renderAssetPreview(previewSrc, config.emptyText, config.title)}
      <div class="info-grid info-grid--material">
        <div><span>文件名</span><strong>${escapeHtml(assetMeta?.fileName || '未设置')}</strong></div>
        <div><span>图片尺寸</span><strong>${assetMeta?.width && assetMeta?.height ? `${assetMeta.width} × ${assetMeta.height}` : '未知尺寸'}</strong></div>
        <div><span>文件大小</span><strong>${formatFileSize(assetMeta?.sizeBytes)}</strong></div>
        <div><span>状态</span><strong>${statusLabels[propertyState.status]}</strong></div>
      </div>
      <label class="file-picker">
        选择图片
        <input type="file" accept="${IMAGE_FILE_ACCEPT}" data-asset-property="${config.propertyKey}" data-design-id="${component.designId}">
      </label>
      ${config.controls.map((propertyKey) => renderPropertyField(component, propertyKey, { compact: true, hideReason: true })).join('')}
      <div class="section-actions">
        <button type="button" data-clear-bundle="${config.bundle}" data-design-id="${component.designId}">清除素材</button>
        <button type="button" data-restore-bundle="${config.bundle}" data-design-id="${component.designId}">恢复默认素材</button>
      </div>
      <div class="asset-meta">${propertyState.reason}</div>
    </article>
  `;
}

function renderFontAssetCard(component) {
  if (!component.supportedProperties.includes('fontAssetId')) {
    return '<div class="empty-card">当前组件没有字体文件预览能力。</div>';
  }
  const assetMeta = getSelectedAssetMeta(component.designId, 'fontAssetId');
  const propertyState = getPropertyState(component, 'fontAssetId');
  const fontStyle = getResolvedStyle(component.designId);
  return `
    <article class="material-card">
      <div class="material-card-head">
        <div>
          <h4>字体与字体文件</h4>
          <p>仅编辑器预览可立即生效，小程序资源链路仍按当前导出能力如实标注。</p>
        </div>
        ${renderStatusBadge(propertyState.status)}
      </div>
      <div class="font-preview" style="${styleObjectToString({ fontFamily: fontStyle.fontFamily, fontSize: '36rpx', lineHeight: '1.5' })}">
        此地有传说，字体预览样张
      </div>
      <div class="info-grid info-grid--material">
        <div><span>文件名</span><strong>${escapeHtml(assetMeta?.fileName || '未上传')}</strong></div>
        <div><span>文件类型</span><strong>${escapeHtml(assetMeta?.mimeType || '未知')}</strong></div>
        <div><span>文件大小</span><strong>${formatFileSize(assetMeta?.sizeBytes)}</strong></div>
        <div><span>应用边界</span><strong>${statusLabels[propertyState.status]}</strong></div>
      </div>
      ${renderPropertyField(component, 'fontFamily', { compact: true, hideReason: true })}
      <label class="file-picker">
        选择字体文件
        <input type="file" accept="${FONT_FILE_ACCEPT}" data-asset-property="fontAssetId" data-design-id="${component.designId}">
      </label>
      <div class="section-actions">
        <button type="button" data-clear-bundle="font" data-design-id="${component.designId}">清除字体</button>
        <button type="button" data-restore-bundle="font" data-design-id="${component.designId}">恢复默认字体</button>
      </div>
      <div class="asset-meta">当前能力：编辑器即时预览；未自动生成小程序远程字体地址；若需小程序实际运行，仍需补充字体资源链路。</div>
    </article>
  `;
}

function renderMaterialSection(component) {
  const cards = [];
  if (component.supportedProperties.includes('backgroundImage')) {
    cards.push(renderMaterialAssetCard(component, {
      title: '背景图片替换',
      propertyKey: 'backgroundImage',
      bundle: 'background',
      emptyText: '当前没有背景图片',
      controls: ['backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'].filter((key) => component.supportedProperties.includes(key))
    }));
  }
  if (component.supportedProperties.includes('imageSrc')) {
    cards.push(renderMaterialAssetCard(component, {
      title: '图片 / Banner 替换',
      propertyKey: 'imageSrc',
      bundle: 'image',
      emptyText: '当前没有图片素材',
      controls: ['objectFit'].filter((key) => component.supportedProperties.includes(key))
    }));
  }
  if (component.supportedProperties.includes('buttonVisualMode')) {
    cards.push(`
      <article class="material-card">
        <div class="material-card-head">
          <div>
            <h4>按钮图片替换</h4>
            <p>模式 A 为 CSS 按钮；模式 B 为图片按钮，只替换视觉层，保留点击区域。</p>
          </div>
          ${renderStatusBadge(getPropertyState(component, 'buttonVisualMode').status)}
        </div>
        ${renderPropertyField(component, 'buttonVisualMode', { compact: true, hideReason: true })}
        ${renderMaterialAssetCard(component, {
          title: '按钮图片素材',
          propertyKey: 'buttonImageSrc',
          bundle: 'buttonImage',
          emptyText: '当前按钮仍使用 CSS 样式',
          controls: ['buttonImageFit', 'buttonImagePosition', 'buttonKeepText', 'buttonImageFill', 'buttonImageRadius'].filter((key) => component.supportedProperties.includes(key))
        })}
      </article>
    `);
  }

  return renderInspectorSection(
    '素材替换',
    '支持图片上传、本地预览、文件元数据展示，以及清除和恢复默认素材。',
    cards.length ? cards.join('') : '<div class="empty-card">当前组件没有可替换素材。</div>'
  );
}

function renderTextAndFontSection(component) {
  const textFields = TEXT_AND_FONT_KEYS
    .filter((propertyKey) => propertyKey !== 'fontAssetId')
    .filter((propertyKey) => component.supportedProperties.includes(propertyKey))
    .map((propertyKey) => renderPropertyField(component, propertyKey, { compact: true }));

  return renderInspectorSection(
    '文字与字体',
    '默认展示文字内容、字号、字体族和字体文件预览，高级 CSS 文本输入收进高级模式。',
    `
      ${textFields.join('') || '<div class="empty-card">当前组件没有开放文字编辑属性。</div>'}
      ${renderFontAssetCard(component)}
    `
  );
}

function renderStyleSection(component) {
  const styleFields = STYLE_KEYS
    .filter((propertyKey) => component.supportedProperties.includes(propertyKey))
    .map((propertyKey) => renderPropertyField(component, propertyKey, { compact: true }));

  return renderInspectorSection(
    '颜色与样式',
    '这里保留 CSS 模式按钮、颜色、阴影、圆角、边框和间距等真实可见样式。',
    styleFields.join('') || '<div class="empty-card">当前组件没有额外样式可调。</div>'
  );
}

function renderExportStatusSection(component) {
  const counts = Object.values(component.propertyStates).reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { safe: 0, preview: 0, unsupported: 0 });

  return renderInspectorSection(
    '导出与应用状态',
    '这里明确区分哪些属性可应用、仅预览和不支持，不把未实现能力伪装成可应用。',
    `
      <div class="component-summary">
        <h3>${component.label}</h3>
        <p>designId：<code>${component.designId}</code></p>
        <p class="selector-meta">选择器：<code>${component.selector}</code></p>
        <p class="selector-meta">可安全写入：<code>${component.safeApplySelector || '当前没有稳定 WXSS 选择器'}</code></p>
      </div>
      <div class="status-summary-grid">
        <div class="status-summary-card"><strong>${counts.safe}</strong><span>可应用</span></div>
        <div class="status-summary-card"><strong>${counts.preview}</strong><span>仅预览</span></div>
        <div class="status-summary-card"><strong>${counts.unsupported}</strong><span>不支持</span></div>
      </div>
      <div class="restore-actions">
        <button type="button" data-action="restore-component">恢复当前组件</button>
        <button type="button" data-action="restore-page">恢复当前页面</button>
        <button type="button" data-action="restore-all">恢复全部默认设计</button>
      </div>
      <ul class="legend-list">
        ${UNSUPPORTED_ITEMS.map((item) => `<li><strong>${item.label}</strong><br>${item.reason}</li>`).join('')}
      </ul>
    `
  );
}

function renderAdvancedSection(component) {
  const grouped = getGroupedProperties(component);
  return `
    <details class="advanced-mode">
      <summary>高级模式：原始属性字段</summary>
      <div class="advanced-mode-body">
        ${Object.entries(grouped).map(([groupName, propertyKeys]) => `
          <section class="advanced-group">
            <h4>${groupName}</h4>
            ${propertyKeys.map((propertyKey) => renderPropertyField(component, propertyKey)).join('')}
          </section>
        `).join('')}
      </div>
    </details>
  `;
}

function renderIndexPage() {
  const button = getResolvedStyle('index-primary-button');
  const swiper = getResolvedStyle('index-recommendation-swiper');
  const card = getResolvedStyle('index-recommendation-card');
  const cards = PAGE_SAMPLE_DATA.index.recommendationCards;
  const sampleCard = cards[0];

  const coverStyle = styleObjectToString({
    width: card.imageWidth || '220rpx',
    minWidth: card.imageWidth || '220rpx',
    height: card.imageHeight || '312rpx',
    borderRadius: card.imageRadius || '0',
    background: card.imageSrc
      ? `center / ${card.objectFit || 'cover'} no-repeat url("${card.imageSrc}")`
      : 'linear-gradient(180deg, rgba(226, 207, 179, 0.95), rgba(212, 184, 149, 0.92))'
  });

  return renderPageSurfaceNode('index-page-surface', 'mini-home-page', `
      <div class="mini-home-main">
        <section class="mini-home-hero">
          ${renderTextNode('index-page-title', 'mini-hero-title')}
          <div class="mini-hero-english">THIS PLACE HAS LEGENDS</div>
          ${renderTextNode('index-page-subtitle', 'mini-hero-subtitle')}
        </section>

        <section class="mini-panel mini-primary-entry">
          <div class="mini-entry-icon">🔍</div>
          <div class="mini-actions">
            ${renderButtonNode('index-primary-button', button, '寻找传说')}
          </div>
        </section>

        ${renderCardNode('index-recommendation-section', `
          <section class="mini-recommendation-section-inner">
            <div class="mini-section-label mini-recommendation-label">编辑推荐</div>
            <div class="mini-section-title mini-recommendation-title">先听一段传说，再决定要不要出发</div>
            ${previewNode('index-recommendation-swiper', `
              <div class="mini-recommendation-swiper-wrap">
                <div class="mini-swiper-shell" style="${styleObjectToString({ height: swiper.height || '372rpx', margin: swiper.margin })}">
                  ${previewNode('index-recommendation-card', `
                    <div class="mini-recommendation-slide">
                      <article class="mini-recommendation-card" style="${styleObjectToString({
                        background: card.cardBackground,
                        borderRadius: card.borderRadius,
                        borderColor: card.cardBorderColor,
                        boxShadow: card.cardShadow,
                        margin: card.margin
                      })}">
                        <div class="mini-recommendation-cover" style="${coverStyle}">
                          ${card.imageSrc ? '' : `
                            <div class="mini-recommendation-cover-placeholder">
                              <div class="mini-cover-emoji">📖</div>
                              <div class="mini-cover-text">传说节选</div>
                            </div>
                          `}
                        </div>
                        <div class="mini-recommendation-body">
                          <div class="mini-tag">${escapeHtml(sampleCard.label)}</div>
                          <div class="mini-recommendation-card-title">${escapeHtml(card.text || sampleCard.title)}</div>
                          <div class="mini-recommendation-card-location">${escapeHtml(sampleCard.location)}</div>
                          <div class="mini-recommendation-card-summary">${escapeHtml(sampleCard.summary)}</div>
                          <div class="mini-recommendation-card-action">${escapeHtml(sampleCard.cta)}</div>
                        </div>
                      </article>
                    </div>
                  `)}
                  <div class="mini-swiper-dots">
                    ${cards.map((_, index) => `<span class="mini-swiper-dot ${index === 0 ? 'is-active' : ''}"></span>`).join('')}
                  </div>
                </div>
              </div>
            `)}
          </section>
        `, 'mini-panel mini-recommendation-section')}
      </div>
      <div class="mini-company-footer">${escapeHtml(PAGE_SAMPLE_DATA.index.companyName)}</div>
  `);
}

function renderProfilePage() {
  const profile = PAGE_SAMPLE_DATA.profile;
  const renderMenu = (menu) => {
    const style = getResolvedStyle(menu.designId);
    return renderCardNode(menu.designId, `
      <div class="mini-menu-entry">
        <div class="mini-menu-entry-main">
          <div class="mini-menu-icon">${escapeHtml(menu.icon)}</div>
          <div>
            <div class="mini-menu-title" style="${styleObjectToString({ fontSize: style.fontSize, color: style.color })}">${escapeHtml(style.text || menu.title)}</div>
            <div class="mini-menu-subtitle">${escapeHtml(menu.subtitle)}</div>
          </div>
        </div>
        <div class="mini-menu-arrow">›</div>
      </div>
    `);
  };

  return renderPageSurfaceNode('profile-page-surface', '', `
    ${renderTextNode('profile-page-title', 'mini-page-title')}
    <div class="mini-page-note">保留温暖卡片语言，不改功能入口。</div>
    ${renderCardNode('profile-assets-card', `
      <div class="mini-profile-summary">
        <div>
          <div class="mini-summary-label">当前身份</div>
          <div class="mini-summary-title">${escapeHtml(profile.level)}</div>
        </div>
        <div class="mini-summary-metrics">
          <div><strong>${profile.magnifyingGlass}</strong><span>放大镜</span></div>
          <div>收藏 ${profile.favorites} · 投稿 ${profile.stories}</div>
        </div>
      </div>
    `)}
    ${profile.menus.map(renderMenu).join('')}
  `);
}

function renderAtlasPage() {
  const sample = PAGE_SAMPLE_DATA.atlas.cards[0];

  return renderPageSurfaceNode('atlas-page-surface', '', `
    ${renderTextNode('atlas-page-title', 'mini-page-title')}
    ${renderCardNode('atlas-exploration-card', `
      <div class="mini-card-title">${escapeHtml(getResolvedStyle('atlas-exploration-card').text || sample.title)}</div>
      <div class="mini-card-meta">${escapeHtml(sample.meta)}</div>
      <div class="mini-card-submeta">${escapeHtml(sample.time)}</div>
    `)}
    ${renderCardNode('atlas-empty-state', `
      <div class="mini-empty-copy" style="${styleObjectToString({ fontSize: getResolvedStyle('atlas-empty-state').fontSize, color: getResolvedStyle('atlas-empty-state').color, lineHeight: getResolvedStyle('atlas-empty-state').lineHeight, textAlign: getResolvedStyle('atlas-empty-state').textAlign })}">
        ${escapeHtml(getResolvedStyle('atlas-empty-state').text)}
      </div>
    `)}
  `);
}

function renderDiscoveryPage() {
  const picker = getResolvedStyle('discovery-location-picker');
  const sample = PAGE_SAMPLE_DATA.discovery.cards[0];

  return renderPageSurfaceNode('discovery-page-surface', '', `
    ${renderTextNode('discovery-page-title', 'mini-page-title')}
    ${renderButtonNode('discovery-location-picker', picker, '选择你的位置')}
    ${renderCardNode('discovery-location-card', `
      <div class="mini-discovery-card">
        <div>
          <div class="mini-card-title">${escapeHtml(getResolvedStyle('discovery-location-card').text || sample.title)}</div>
          <div class="mini-card-meta">${escapeHtml(sample.meta)}</div>
        </div>
        <div class="mini-tag">${escapeHtml(sample.badge)}</div>
      </div>
    `)}
    ${renderCardNode('discovery-empty-state', `
      <div class="mini-empty-copy" style="${styleObjectToString({ fontSize: getResolvedStyle('discovery-empty-state').fontSize, color: getResolvedStyle('discovery-empty-state').color, lineHeight: getResolvedStyle('discovery-empty-state').lineHeight, textAlign: getResolvedStyle('discovery-empty-state').textAlign })}">
        ${escapeHtml(getResolvedStyle('discovery-empty-state').text)}
      </div>
    `)}
  `);
}

function renderLocationPage() {
  const option = getResolvedStyle('location-story-option');
  const overlay = getResolvedStyle('location-loading-overlay');

  return renderPageSurfaceNode('location-page-surface', '', `
    ${renderTextNode('location-page-title', 'mini-page-title')}
    ${renderCardNode('location-intro-card', `
      <div class="mini-card-title">${escapeHtml(PAGE_SAMPLE_DATA.location.locationName)}</div>
      <div class="mini-card-submeta">${escapeHtml(PAGE_SAMPLE_DATA.location.locationAddress)}</div>
      <div class="mini-card-copy">${escapeHtml(PAGE_SAMPLE_DATA.location.intro)}</div>
    `)}
    ${PAGE_SAMPLE_DATA.location.options.map((item) => renderCardNode('location-story-option', `
      <div class="mini-discovery-card">
        <div>
          <div class="mini-card-title" style="${styleObjectToString({ fontSize: option.fontSize, color: option.color })}">${escapeHtml(option.text || item.title)}</div>
          <div class="mini-card-meta">${escapeHtml(item.summary)}</div>
        </div>
        <div class="mini-tag">${escapeHtml(item.tag)}</div>
      </div>
    `)).join('')}
    ${previewNode('location-loading-overlay', `
      <div class="mini-overlay-shell" style="${styleObjectToString({ marginTop: '24rpx', padding: '24rpx', background: overlay.background, borderRadius: '24rpx' })}">
        <div class="mini-panel" style="${styleObjectToString({
          background: overlay.cardBackground,
          borderRadius: overlay.borderRadius,
          boxShadow: overlay.boxShadow,
          color: overlay.color,
          fontSize: overlay.fontSize,
          lineHeight: overlay.lineHeight,
          padding: '40rpx 32rpx'
        })}">
          <div class="mini-overlay-title">正在寻找传说</div>
          <div>轮播词条、AI 合规提示和遮罩文案都只做视觉预览。</div>
        </div>
      </div>
    `)}
  `);
}

function renderStoryPage() {
  const content = getResolvedStyle('story-content');
  const favorite = getResolvedStyle('story-favorite-button');
  const back = getResolvedStyle('story-back-button');

  return renderPageSurfaceNode('story-page-surface', '', `
    <div class="mini-panel mini-story-shell">
      ${renderTextNode('story-page-title', 'mini-story-title')}
      ${renderTextNode('story-summary', 'mini-story-summary')}
      ${previewNode('story-content', `
        <div class="mini-story-content" style="${styleObjectToString({
          fontSize: content.fontSize,
          color: content.color,
          lineHeight: content.lineHeight,
          textAlign: content.textAlign,
          background: content.background,
          padding: content.padding,
          margin: content.margin,
          fontFamily: content.fontFamily
        })}">${escapeHtml(content.text)}</div>
      `)}
    </div>
    <div class="mini-button-row" style="margin-top: ${toPreviewCssValue('24rpx')}">
      ${renderButtonNode('story-favorite-button', favorite, '收藏')}
      ${renderButtonNode('story-back-button', back, '返回')}
    </div>
  `);
}

function renderPublishPage() {
  const titleInput = getResolvedStyle('publish-title-input');
  const contentInput = getResolvedStyle('publish-content-input');
  const submit = getResolvedStyle('publish-submit-button');

  return renderPageSurfaceNode('publish-page-surface', '', `
    ${renderTextNode('publish-page-title', 'mini-page-title')}
    ${renderCardNode('publish-location-selector', `
      <div class="mini-card-title" style="${styleObjectToString({ fontSize: getResolvedStyle('publish-location-selector').fontSize, color: getResolvedStyle('publish-location-selector').color })}">
        ${escapeHtml(getResolvedStyle('publish-location-selector').text)}
      </div>
    `)}
    ${previewNode('publish-title-input', `
      <div class="mini-input-shell" style="${styleObjectToString({
        background: titleInput.background,
        padding: titleInput.padding,
        height: titleInput.height,
        borderRadius: titleInput.borderRadius,
        borderColor: titleInput.borderColor,
        borderWidth: titleInput.borderWidth,
        borderStyle: 'solid',
        boxShadow: titleInput.boxShadow,
        color: titleInput.color,
        fontSize: titleInput.fontSize,
        lineHeight: titleInput.lineHeight,
        margin: '0 0 20rpx',
        fontFamily: titleInput.fontFamily
      })}">${escapeHtml(titleInput.text)}</div>
    `)}
    ${previewNode('publish-content-input', `
      <div class="mini-input-shell" style="${styleObjectToString({
        background: contentInput.background,
        padding: contentInput.padding,
        height: contentInput.height,
        borderRadius: contentInput.borderRadius,
        borderColor: contentInput.borderColor,
        borderWidth: contentInput.borderWidth,
        borderStyle: 'solid',
        boxShadow: contentInput.boxShadow,
        color: contentInput.color,
        fontSize: contentInput.fontSize,
        lineHeight: contentInput.lineHeight,
        margin: '0 0 24rpx',
        fontFamily: contentInput.fontFamily
      })}">${escapeHtml(contentInput.text)}</div>
    `)}
    ${renderButtonNode('publish-submit-button', submit, '提交投稿')}
  `);
}

function renderMyStoriesPage() {
  const sample = PAGE_SAMPLE_DATA.myStories.cards[0];

  return renderPageSurfaceNode('my-stories-page-surface', '', `
    ${renderTextNode('my-stories-page-title', 'mini-page-title')}
    ${renderCardNode('my-story-card', `
      <div class="mini-tag">${escapeHtml(sample.status)}</div>
      <div class="mini-card-title">${escapeHtml(getResolvedStyle('my-story-card').text || sample.title)}</div>
      <div class="mini-card-meta">${escapeHtml(sample.location)}</div>
      <div class="mini-card-submeta">${escapeHtml(sample.time)}</div>
    `)}
    ${renderCardNode('my-stories-empty-state', `
      <div class="mini-empty-copy" style="${styleObjectToString({ fontSize: getResolvedStyle('my-stories-empty-state').fontSize, color: getResolvedStyle('my-stories-empty-state').color, lineHeight: getResolvedStyle('my-stories-empty-state').lineHeight, textAlign: getResolvedStyle('my-stories-empty-state').textAlign })}">
        ${escapeHtml(getResolvedStyle('my-stories-empty-state').text)}
      </div>
    `)}
  `);
}

function renderMyStoryPreviewPage() {
  const rejection = getResolvedStyle('my-story-preview-rejection');
  const contentCard = getResolvedStyle('my-story-preview-content');
  const editButton = getResolvedStyle('my-story-preview-edit-button');
  const deleteButton = getResolvedStyle('my-story-preview-delete-button');
  const sample = PAGE_SAMPLE_DATA.myStoryPreview;

  return renderPageSurfaceNode('my-story-preview-page-surface', '', `
    ${renderTextNode('my-story-preview-title', 'mini-page-title')}
    <div class="mini-page-note">这里展示你提交给审核队列的原始内容。</div>
    ${previewNode('my-story-preview-rejection', `
      <div class="mini-status-banner" style="${styleObjectToString({
        background: rejection.background,
        padding: rejection.padding,
        margin: rejection.margin,
        borderRadius: rejection.borderRadius,
        borderColor: rejection.borderColor,
        borderWidth: rejection.borderWidth,
        borderStyle: 'solid',
        color: rejection.color,
        fontSize: rejection.fontSize,
        lineHeight: rejection.lineHeight
      })}">${escapeHtml(rejection.text)}</div>
    `)}
    ${renderCardNode('my-story-preview-content', `
      <div class="mini-card-title">${escapeHtml(sample.title)}</div>
      <div class="mini-card-meta">${escapeHtml(sample.location)}</div>
      <div class="mini-card-submeta">${escapeHtml(sample.time)}</div>
      <div class="mini-card-copy" style="${styleObjectToString({ fontSize: contentCard.fontSize, lineHeight: contentCard.lineHeight, color: contentCard.color })}">${escapeHtml(sample.content)}</div>
    `)}
    <div class="mini-button-row">
      ${renderButtonNode('my-story-preview-edit-button', editButton, '编辑')}
      ${renderButtonNode('my-story-preview-delete-button', deleteButton, '删除投稿')}
    </div>
  `);
}

function renderMyStoryEditPage() {
  const titleInput = getResolvedStyle('my-story-edit-title-input');
  const contentInput = getResolvedStyle('my-story-edit-content-input');
  const submitButton = getResolvedStyle('my-story-edit-submit-button');
  const cancelButton = getResolvedStyle('my-story-edit-cancel-button');

  return renderPageSurfaceNode('my-story-edit-page-surface', '', `
    <div class="mini-page-title">重新编辑</div>
    <div class="mini-page-note">本页只预览视觉层，地点与提交流程保持原样。</div>
    ${previewNode('my-story-edit-title-input', `
      <div class="mini-input-shell" style="${styleObjectToString({
        background: titleInput.background,
        padding: titleInput.padding,
        height: titleInput.height,
        borderRadius: titleInput.borderRadius,
        borderColor: titleInput.borderColor,
        borderWidth: titleInput.borderWidth,
        borderStyle: 'solid',
        boxShadow: titleInput.boxShadow,
        color: titleInput.color,
        fontSize: titleInput.fontSize,
        lineHeight: titleInput.lineHeight,
        margin: '0 0 20rpx'
      })}">${escapeHtml(titleInput.text)}</div>
    `)}
    ${previewNode('my-story-edit-content-input', `
      <div class="mini-input-shell" style="${styleObjectToString({
        background: contentInput.background,
        padding: contentInput.padding,
        height: contentInput.height,
        borderRadius: contentInput.borderRadius,
        borderColor: contentInput.borderColor,
        borderWidth: contentInput.borderWidth,
        borderStyle: 'solid',
        boxShadow: contentInput.boxShadow,
        color: contentInput.color,
        fontSize: contentInput.fontSize,
        lineHeight: contentInput.lineHeight,
        margin: '0 0 24rpx'
      })}">${escapeHtml(contentInput.text)}</div>
    `)}
    <div class="mini-button-row">
      ${renderButtonNode('my-story-edit-submit-button', submitButton, '提交修改')}
      ${renderButtonNode('my-story-edit-cancel-button', cancelButton, '返回')}
    </div>
  `);
}

const pageRenderers = {
  index: renderIndexPage,
  profile: renderProfilePage,
  atlas: renderAtlasPage,
  discovery: renderDiscoveryPage,
  location: renderLocationPage,
  story: renderStoryPage,
  publish: renderPublishPage,
  myStories: renderMyStoriesPage,
  myStoryPreview: renderMyStoryPreviewPage,
  myStoryEdit: renderMyStoryEditPage
};

function renderPropertyControl(propertyKey, component) {
  const property = PROPERTY_LIBRARY[propertyKey];
  const propertyState = component.propertyStates[propertyKey] || {
    status: 'unsupported',
    reason: '当前组件没有开放这个属性。'
  };
  const value = getResolvedValue(component.designId, propertyKey);
  const controlId = `prop-${component.designId}-${propertyKey}`;
  const currentValue = value ?? '';
  const colorValue = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(currentValue))
    ? String(currentValue)
    : '#8b5e34';

  let fieldHtml = '';
  if (property.input === 'textarea') {
    fieldHtml = `<textarea id="${controlId}" data-property="${propertyKey}" data-design-id="${component.designId}">${currentValue}</textarea>`;
  } else if (property.input === 'select') {
    fieldHtml = `
      <select id="${controlId}" data-property="${propertyKey}" data-design-id="${component.designId}">
        ${(property.options || []).map((option) => `
          <option value="${option}" ${option === currentValue ? 'selected' : ''}>${option}</option>
        `).join('')}
      </select>
    `;
  } else if (property.input === 'color-text') {
    fieldHtml = `
      <div class="color-input-row">
        <input type="text" id="${controlId}" value="${currentValue}" data-property="${propertyKey}" data-design-id="${component.designId}">
        <input type="color" value="${colorValue}" data-color-proxy="${propertyKey}" data-design-id="${component.designId}">
      </div>
    `;
  } else if (property.input === 'asset') {
    const asset = state.draft.assets?.[getOverrideValue(state, state.selectedPageId, component.designId, propertyKey)];
    fieldHtml = `
      <div class="asset-row">
        <input type="text" id="${controlId}" value="${currentValue}" data-property="${propertyKey}" data-design-id="${component.designId}" readonly>
        <input type="file" accept="image/*" data-asset-property="${propertyKey}" data-design-id="${component.designId}">
      </div>
      <div class="asset-meta">${asset ? `${asset.fileName} · ${asset.width || '?'} × ${asset.height || '?'} · ${asset.mimeType}` : '上传后会保存到 design-editor/resources/uploads/'}</div>
    `;
  } else {
    fieldHtml = `<input type="text" id="${controlId}" value="${currentValue}" data-property="${propertyKey}" data-design-id="${component.designId}">`;
  }

  return `
    <div class="property-item">
      <div class="property-head">
        <label for="${controlId}">${property.label}</label>
        <span class="property-status ${propertyState.status}">${statusLabels[propertyState.status]}</span>
      </div>
      ${fieldHtml}
      <div class="asset-meta">${propertyState.reason}</div>
    </div>
  `;
}

function renderInspector() {
  const component = getComponent();
  if (!component) {
    return `
      <div class="editor-panel-head">
        <h2>属性面板</h2>
        <p>当前页面没有可编辑组件。</p>
      </div>
    `;
  }

  return `
    <div class="editor-panel-head">
      <h2>属性面板</h2>
      <p>默认主入口改为尺寸、素材、文字、样式和应用状态；原始 CSS 字段保留在高级模式里。</p>
    </div>
    <div class="editor-inspector-body" data-inspector-scroll>
      ${renderMeasurementSection(component)}
      ${renderMaterialSection(component)}
      ${renderTextAndFontSection(component)}
      ${renderStyleSection(component)}
      ${renderExportStatusSection(component)}
      ${renderAdvancedSection(component)}
    </div>
  `;
}

function renderSidebar() {
  const components = catalog.byPage[state.selectedPageId] || [];
  return `
    <div class="editor-panel-head">
      <h2>页面与组件</h2>
      <p>页面列表固定在左栏顶部，组件树在左栏内部独立滚动。</p>
    </div>
    <div class="editor-sidebar-body" data-sidebar-scroll>
      <div class="page-list">
        ${pageList.map((pageId) => `
          <button type="button" class="${pageId === state.selectedPageId ? 'is-active' : ''}" data-page-id="${pageId}">
            ${catalog.byPage[pageId]?.[0]?.pageName || pageId}
          </button>
        `).join('')}
      </div>
      <div class="tree-panel">
        <div class="tree-title-row">
          <span>组件树</span>
          <span>${components.length}</span>
        </div>
        <div class="component-tree" data-tree-scroll>
          ${components.map((component) => `
          <button type="button" class="${component.designId === state.selectedComponentId ? 'is-active' : ''}" data-component-id="${component.designId}">
            <strong>${component.label}</strong>
            <code>${component.designId}</code>
          </button>
        `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderCanvas() {
  const renderer = pageRenderers[state.selectedPageId];
  return `
    <div class="editor-canvas-body">
      ${renderPreviewMeta()}
      ${renderPreviewFontFaces()}
      <div class="editor-canvas-stage" data-canvas-stage>
        ${renderPhoneShell(renderer ? renderer() : '<div class="mini-page">页面预览尚未实现。</div>')}
      </div>
    </div>
  `;
}

function renderModal() {
  if (!modalState) {
    return '';
  }

  if (modalState.type === 'result') {
    return `
      <div class="modal-backdrop">
        <div class="modal">
          <h3>${modalState.title}</h3>
          <p>${modalState.description}</p>
          ${modalState.files?.length ? `
            <div class="modal-card" style="margin-top: 18px;">
              <h4>相关文件</h4>
              <ul class="file-list">${modalState.files.map((file) => `<li><code>${file}</code></li>`).join('')}</ul>
            </div>
          ` : ''}
          <div class="modal-actions">
            <button type="button" class="primary" data-action="close-modal">我知道了</button>
          </div>
        </div>
      </div>
    `;
  }

  if (modalState.type === 'apply-preview') {
    const plan = modalState.plan;
    return `
      <div class="modal-backdrop">
        <div class="modal">
          <h3>应用前预览</h3>
          <p>即将把当前设计生成到 miniprogram 的 WXSS/WXML 设计层。不会修改业务 JS、云函数、AI、数据库和业务逻辑。是否继续？</p>
          <div class="modal-grid">
            <div class="modal-card">
              <h4>设计差异</h4>
              <ul class="change-list">
                <li>修改页面：${plan.modifiedPages.join('、') || '无'}</li>
                <li>修改组件：${plan.modifiedComponents.join('、') || '无'}</li>
                <li>修改属性：${plan.modifiedProperties.join('、') || '无'}</li>
                <li>可安全应用：${plan.summary.safeApplyCount}</li>
                <li>仅编辑器预览：${plan.summary.previewOnlyCount}</li>
                <li>当前不支持：${plan.summary.unsupportedCount}</li>
              </ul>
            </div>
            <div class="modal-card">
              <h4>预计文件</h4>
              <ul class="file-list">
                ${plan.generatedWxssFiles.map((file) => `<li><code>${file}</code></li>`).join('') || '<li>暂无</li>'}
                ${plan.modifiedWxssFiles.map((file) => `<li><code>${file}</code></li>`).join('')}
              </ul>
            </div>
          </div>
          <div class="modal-card" style="margin-top: 14px;">
            <h4>修改属性列表</h4>
            <ul class="change-list">
              ${plan.changes.slice(0, 12).map((item) => `
                <li>
                  <strong>${item.componentLabel}</strong> · <code>${item.propertyLabel}</code><br>
                  ${item.previousValue ?? '空'} → ${item.nextDisplayValue ?? '空'}
                </li>
              `).join('')}
            </ul>
          </div>
          <div class="modal-actions">
            <button type="button" data-action="close-modal">取消</button>
            <button type="button" class="primary" data-action="confirm-apply">确认应用</button>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

function getCurrentPreviewScale() {
  if (state.selectedScale === 'fit') {
    return uiState.fitScale || 1;
  }
  return Number(state.selectedScale) || 1;
}

function applyPreviewScale() {
  const stage = app.querySelector('[data-canvas-stage]');
  const phoneShell = app.querySelector('[data-phone-shell]');
  const fitLabel = app.querySelector('[data-fit-label]');
  if (!stage || !phoneShell) {
    return;
  }

  const metrics = getSelectedDeviceMetrics();
  const fitScale = calculateFitScale(stage.clientWidth, stage.clientHeight, metrics);

  uiState.fitScale = Number.isFinite(fitScale) ? fitScale : 1;
  phoneShell.style.setProperty('--preview-scale', String(getCurrentPreviewScale()));
  if (fitLabel) {
    fitLabel.textContent = `适合窗口 ${Math.round(uiState.fitScale * 100)}%`;
  }
}

function bindCanvasResizeObserver() {
  if (uiState.resizeObserver) {
    uiState.resizeObserver.disconnect();
  }

  const stage = app.querySelector('[data-canvas-stage]');
  if (!stage || typeof ResizeObserver === 'undefined') {
    return;
  }

  uiState.resizeObserver = new ResizeObserver(() => {
    applyPreviewScale();
    scheduleMeasurement();
  });
  uiState.resizeObserver.observe(stage);
}

function render() {
  captureUiState();
  app.innerHTML = `
    <div class="editor-app">
      <header class="editor-toolbar">
        <div class="editor-toolbar-brand">
          <h1>此地有传说 UI 设计编辑器</h1>
          <p>固定工作台布局，手机预览按真实设备宽高渲染，未点击“应用到小程序”前不会改动 miniprogram。</p>
        </div>
        <div class="editor-toolbar-controls">
          <div class="toolbar-group">
            <span class="toolbar-label">设备</span>
            ${DEVICE_PRESETS.map((device) => `
              <button type="button" class="toolbar-button ${device.id === state.selectedDeviceId ? 'is-active' : ''}" data-device-id="${device.id}">
                ${device.name}<span class="toolbar-device-meta">${device.width}×${device.height}</span>
              </button>
            `).join('')}
          </div>
          <div class="toolbar-group">
            <span class="toolbar-label">缩放</span>
            ${SCALE_OPTIONS.map((item) => `
              <button type="button" class="toolbar-button ${String(state.selectedScale) === item.value ? 'is-active' : ''}" data-scale-value="${item.value}">
                <span ${item.value === 'fit' ? 'data-fit-label' : ''}>${item.label}</span>
              </button>
            `).join('')}
          </div>
          <div class="toolbar-group">
            <span class="status-pill ${hasUnsavedChanges(state) ? 'is-dirty' : ''}">
              ${hasUnsavedChanges(state) ? '有未保存修改' : '已与最近导出/应用同步'}
            </span>
            <button type="button" class="toolbar-button" data-action="undo">撤销</button>
            <button type="button" class="toolbar-button" data-action="redo">重做</button>
            <button type="button" class="toolbar-button toolbar-button--primary" data-action="export">导出设计</button>
            <button type="button" class="toolbar-button" data-action="apply-preview">应用到小程序</button>
          </div>
        </div>
      </header>

      <main class="editor-workspace">
        <aside class="editor-sidebar">${renderSidebar()}</aside>
        <section class="editor-canvas">${renderCanvas()}</section>
        <aside class="editor-inspector">${renderInspector()}</aside>
      </main>
    </div>
    ${renderModal()}
  `;
  restoreUiState();
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

function getFileExtension(fileName) {
  return String(fileName || '').split('.').pop().toLowerCase();
}

function getNormalizedMimeType(file, propertyKey) {
  if (file.type) {
    return file.type;
  }
  const extension = getFileExtension(file.name);
  if (propertyKey === 'fontAssetId') {
    return extension === 'woff2' ? 'font/woff2' : extension === 'woff' ? 'font/woff' : extension === 'otf' ? 'font/otf' : 'font/ttf';
  }
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
}

function deriveFontAlias(designId, fileName) {
  return extractPrimaryFontFamily(getResolvedValue(designId, 'fontFamily'))
    || String(fileName || '').replace(/\.[^.]+$/, '').trim()
    || 'DesignEditorFont';
}

function clearBundleOverrides(designId, bundleKey) {
  const pageId = state.selectedPageId;
  const properties = MATERIAL_BUNDLES[bundleKey] || [];
  let nextState = state;
  properties.forEach((propertyKey) => {
    nextState = clearOverride(nextState, pageId, designId, propertyKey);
  });
  return nextState;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }
  return data;
}

async function handleAssetUpload(input) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  const propertyKey = input.dataset.assetProperty;
  const designId = input.dataset.designId;
  const pageId = state.selectedPageId;
  const isFontAsset = propertyKey === 'fontAssetId';
  const extension = getFileExtension(file.name);
  const normalizedMimeType = getNormalizedMimeType(file, propertyKey);
  const previousState = state;
  const component = catalog.byId[designId];

  if (!component?.supportedProperties.includes(propertyKey)) {
    setNotice('当前组件不支持该素材替换。', 'error');
    render();
    input.value = '';
    return;
  }

  if (isFontAsset) {
    if (!SUPPORTED_FONT_EXTENSIONS.includes(extension)) {
      setNotice('字体格式不支持，仅支持 ttf / otf / woff / woff2。', 'error');
      render();
      input.value = '';
      return;
    }
    if (file.size > MAX_FONT_FILE_SIZE) {
      setNotice('字体文件过大，请控制在 6 MB 以内。', 'error');
      render();
      input.value = '';
      return;
    }
  } else {
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
      setNotice('图片格式不支持，仅支持 png / jpg / jpeg / webp。', 'error');
      render();
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setNotice('图片过大，请控制在 8 MB 以内。', 'error');
      render();
      input.value = '';
      return;
    }
  }

  try {
    const localPreviewUrl = URL.createObjectURL(file);
    const [base64, size] = await Promise.all([
      toBase64(file),
      isFontAsset ? Promise.resolve({ width: null, height: null }) : readImageSize(file)
    ]);
    const optimisticAssetId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fontFamily = isFontAsset ? deriveFontAlias(designId, file.name) : undefined;
    const optimisticAsset = {
      assetId: optimisticAssetId,
      fileName: file.name,
      mimeType: normalizedMimeType,
      width: size.width,
      height: size.height,
      sizeBytes: file.size,
      previewPath: localPreviewUrl,
      relativeProjectPath: '',
      fontFamily
    };

    let optimisticState = applyAsset(previousState, optimisticAssetId, optimisticAsset);
    optimisticState = applyOverride(optimisticState, pageId, designId, propertyKey, optimisticAssetId);
    setNotice(isFontAsset ? '已加载字体预览，正在保存资源...' : '已加载图片预览，正在保存资源...', 'info');
    setState(optimisticState);

    const asset = await postJson('/__design_editor/upload-asset', {
      fileName: file.name,
      mimeType: normalizedMimeType,
      base64,
      width: size.width,
      height: size.height,
      pageId,
      designId,
      propertyKey
    });

    URL.revokeObjectURL(localPreviewUrl);
    let nextState = applyAsset(state, optimisticAssetId, {
      ...asset,
      assetId: optimisticAssetId,
      sizeBytes: file.size,
      fontFamily
    });
    nextState = applyOverride(nextState, pageId, designId, propertyKey, optimisticAssetId);
    setNotice(isFontAsset ? '字体预览已更新。' : '图片预览已更新。', 'success');
    setState(nextState);
  } catch (error) {
    setNotice(error instanceof Error ? error.message : (isFontAsset ? '字体读取失败。' : '图片读取失败。'), 'error');
    setState(previousState);
  } finally {
    input.value = '';
  }
}

async function requestApplyPreview() {
  try {
    const plan = await postJson('/__design_editor/plan', { draft: state.draft });
    modalState = { type: 'apply-preview', plan };
    render();
  } catch (error) {
    modalState = {
      type: 'result',
      title: '无法生成应用预览',
      description: error instanceof Error ? error.message : '请确认当前编辑器正在通过 npm run dev 运行。'
    };
    render();
  }
}

async function exportDesign() {
  try {
    const result = await postJson('/__design_editor/export', { draft: state.draft });
    setState(markSaved(state));
    modalState = {
      type: 'result',
      title: '导出成功',
      description: '设计文件已经写入 design/export/，可以继续在编辑器里迭代。',
      files: result.files
    };
    render();
  } catch (error) {
    modalState = {
      type: 'result',
      title: '导出失败',
      description: error instanceof Error ? error.message : '导出设计失败'
    };
    render();
  }
}

async function confirmApply() {
  try {
    const result = await postJson('/__design_editor/apply', { draft: state.draft });
    setState(markSaved(state));
    modalState = {
      type: 'result',
      title: '应用完成',
      description: `已生成设计覆盖层，并自动备份当前相关 WXSS/WXML。备份目录：${result.backupRoot}`,
      files: [...(result.filesModified || []), ...(result.filesDeleted || [])]
    };
    render();
  } catch (error) {
    modalState = {
      type: 'result',
      title: '应用失败',
      description: error instanceof Error ? error.message : '应用到小程序失败'
    };
    render();
  }
}

app.addEventListener('click', async (event) => {
  const previewNodeElement = event.target.closest('[data-preview-id]');
  if (previewNodeElement) {
    setState(selectComponent(state, previewNodeElement.dataset.previewId));
    return;
  }

  const clearPropertyButton = event.target.closest('[data-clear-property]');
  if (clearPropertyButton) {
    setNotice('属性已恢复默认值。', 'success');
    setState(clearOverride(state, state.selectedPageId, clearPropertyButton.dataset.designId, clearPropertyButton.dataset.clearProperty));
    return;
  }

  const copyButton = event.target.closest('[data-copy-measurement]');
  if (copyButton) {
    const mode = copyButton.dataset.copyMeasurement;
    const text = getMeasurementCopyText(mode);
    if (!text) {
      setNotice('当前组件暂时没有可复制的测量结果。', 'error');
      render();
      return;
    }
    await copyToClipboard(text, mode === 'recommended-image' ? '推荐图片尺寸已复制。' : '组件尺寸已复制。');
    return;
  }

  const clearBundleButton = event.target.closest('[data-clear-bundle]');
  if (clearBundleButton) {
    setNotice('素材已清除，已恢复原始视觉。', 'success');
    setState(clearBundleOverrides(clearBundleButton.dataset.designId, clearBundleButton.dataset.clearBundle));
    return;
  }

  const restoreBundleButton = event.target.closest('[data-restore-bundle]');
  if (restoreBundleButton) {
    setNotice('默认素材已恢复。', 'success');
    setState(clearBundleOverrides(restoreBundleButton.dataset.designId, restoreBundleButton.dataset.restoreBundle));
    return;
  }

  const pageButton = event.target.closest('[data-page-id]');
  if (pageButton) {
    uiState.pendingPhoneScrollReset = true;
    const nextState = syncSelectedComponent(selectPage(state, pageButton.dataset.pageId), pageButton.dataset.pageId);
    setState(nextState);
    return;
  }

  const componentButton = event.target.closest('[data-component-id]');
  if (componentButton) {
    setState(selectComponent(state, componentButton.dataset.componentId));
    return;
  }

  const deviceButton = event.target.closest('[data-device-id]');
  if (deviceButton) {
    setState(selectDevice(state, deviceButton.dataset.deviceId));
    return;
  }

  const scaleButton = event.target.closest('[data-scale-value]');
  if (scaleButton) {
    setState(selectScale(state, scaleButton.dataset.scaleValue));
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) {
    return;
  }

  switch (actionButton.dataset.action) {
    case 'undo':
      setState(undo(state));
      return;
    case 'redo':
      setState(redo(state));
      return;
    case 'restore-component':
      setState(restoreComponent(state, state.selectedPageId, state.selectedComponentId));
      return;
    case 'restore-page':
      uiState.pendingPhoneScrollReset = true;
      setState(restorePage(state, state.selectedPageId));
      return;
    case 'restore-all':
      uiState.pendingPhoneScrollReset = true;
      setState(restoreAll(state));
      return;
    case 'export':
      await exportDesign();
      return;
    case 'apply-preview':
      await requestApplyPreview();
      return;
    case 'confirm-apply':
      await confirmApply();
      return;
    case 'close-modal':
      modalState = null;
      render();
      return;
    default:
      return;
  }
});

app.addEventListener('input', (event) => {
  const target = event.target;

  if (target.matches('[data-property]')) {
    setState(applyOverride(
      state,
      state.selectedPageId,
      target.dataset.designId,
      target.dataset.property,
      target.value
    ));
    return;
  }

  if (target.matches('[data-color-proxy]')) {
    setState(applyOverride(
      state,
      state.selectedPageId,
      target.dataset.designId,
      target.dataset.colorProxy,
      target.value
    ));
  }
});

app.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('[data-property]') && target.tagName === 'SELECT') {
    setState(applyOverride(
      state,
      state.selectedPageId,
      target.dataset.designId,
      target.dataset.property,
      target.value
    ));
    return;
  }

  if (target.matches('[data-asset-property]')) {
    handleAssetUpload(target);
  }
});

render();

console.log('[design-editor] loaded', {
  pages: pageList.length,
  components: registryData.components.length,
  tokenSources: tokensData.generatedFrom?.length || 0,
  assets: assetManifestData.assets?.length || 0
});
