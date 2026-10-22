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
const statusLabels = {
  safe: '可应用',
  preview: '仅预览',
  unsupported: '不支持'
};

const GROUP_ORDER = [
  '文字',
  '背景',
  '尺寸和间距',
  '按钮和卡片',
  '图片和 Banner',
  '应用状态'
];

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

let state = syncSelectedComponent(createEditorState(), createEditorState().selectedPageId);
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
  lastRenderedPageId: createEditorState().selectedPageId
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
});

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
  });
}

function setState(nextState) {
  state = syncSelectedComponent(nextState, nextState.selectedPageId);
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
    resolved[propertyKey] = asset?.previewPath || asset?.relativeProjectPath || propertyValue;
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
    </div>
  `;
}

function isSelected(designId) {
  return state.selectedComponentId === designId ? 'is-selected' : '';
}

function previewNode(designId, innerHtml, extraClass = '') {
  const component = catalog.byId[designId];
  return `
    <div class="preview-node ${isSelected(designId)} ${extraClass}" data-preview-id="${designId}">
      <span class="preview-node-badge">${component?.label || designId}</span>
      ${innerHtml}
    </div>
  `;
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
    Object.entries(grouped).sort((left, right) => GROUP_ORDER.indexOf(left[0]) - GROUP_ORDER.indexOf(right[0]))
  );
}

function getPreferredGroupName(component) {
  const preferredPropertyKey = component.supportedProperties.find((propertyKey) => PROPERTY_LIBRARY[propertyKey]);
  return PROPERTY_LIBRARY[preferredPropertyKey]?.group || '文字';
}

function getExpandedGroups(component, grouped) {
  const componentKey = getComponentKey(component.page, component.designId);
  const existing = uiState.inspectorOpenByComponent[componentKey];
  if (existing?.length) {
    return existing;
  }

  const defaultGroup = getPreferredGroupName(component);
  const fallbackGroup = Object.keys(grouped)[0] || '应用状态';
  uiState.inspectorOpenByComponent[componentKey] = [defaultGroup || fallbackGroup];
  return uiState.inspectorOpenByComponent[componentKey];
}

function toggleInspectorGroup(groupName) {
  const componentKey = getComponentKey();
  const current = uiState.inspectorOpenByComponent[componentKey] || [];
  const next = current.includes(groupName)
    ? current.filter((item) => item !== groupName)
    : [...current, groupName];

  uiState.inspectorOpenByComponent[componentKey] = next;
  render();
}

function renderIndexPage() {
  const title = getResolvedStyle('index-page-title');
  const subtitle = getResolvedStyle('index-page-subtitle');
  const button = getResolvedStyle('index-primary-button');
  const section = getResolvedStyle('index-recommendation-section');
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

  return `
    <div class="mini-page mini-home-page">
      <div class="mini-home-main">
        <section class="mini-home-hero">
          ${previewNode('index-page-title', `<div class="mini-hero-title" style="${styleObjectToString({
          fontSize: title.fontSize,
          color: title.color,
          fontWeight: title.fontWeight,
          lineHeight: title.lineHeight,
          letterSpacing: title.letterSpacing,
          fontFamily: title.fontFamily,
          textAlign: title.textAlign,
          margin: title.margin
        })}">${title.text}</div>`)}
          <div class="mini-hero-english">THIS PLACE HAS LEGENDS</div>
          ${previewNode('index-page-subtitle', `<div class="mini-hero-subtitle" style="${styleObjectToString({
          fontSize: subtitle.fontSize,
          color: subtitle.color,
          fontWeight: subtitle.fontWeight,
          lineHeight: subtitle.lineHeight,
          fontFamily: subtitle.fontFamily,
          textAlign: subtitle.textAlign,
          margin: subtitle.margin
        })}">${subtitle.text}</div>`)}
        </section>

        <section class="mini-panel mini-primary-entry">
          <div class="mini-entry-icon">🔍</div>
          <div class="mini-actions">
            ${previewNode('index-primary-button', `
              <div class="mini-button" style="${styleObjectToString({
              minHeight: button.buttonHeight,
              lineHeight: button.lineHeight || button.buttonHeight,
              background: button.buttonBackground,
              color: button.buttonTextColor,
              borderRadius: button.buttonRadius,
              padding: button.padding,
              boxShadow: button.boxShadow,
              fontSize: button.fontSize,
              fontWeight: button.fontWeight,
              textAlign: button.textAlign,
              borderColor: button.borderColor,
              borderWidth: button.borderWidth,
              borderStyle: button.borderWidth && button.borderWidth !== '0' ? 'solid' : 'none'
            })}">${button.text}</div>
            `)}
          </div>
        </section>

        ${previewNode('index-recommendation-section', `
          <section class="mini-panel mini-recommendation-section" style="${styleObjectToString({
            background: section.cardBackground,
            padding: section.padding,
            margin: section.margin,
            borderRadius: section.borderRadius,
            borderColor: section.cardBorderColor,
            boxShadow: section.cardShadow
          })}">
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
                          <div class="mini-tag">${sampleCard.label}</div>
                          <div class="mini-recommendation-card-title">${card.text || sampleCard.title}</div>
                          <div class="mini-recommendation-card-location">${sampleCard.location}</div>
                          <div class="mini-recommendation-card-summary">${sampleCard.summary}</div>
                          <div class="mini-recommendation-card-action">${sampleCard.cta}</div>
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
        `)}
      </div>
      <div class="mini-company-footer">${PAGE_SAMPLE_DATA.index.companyName}</div>
    </div>
  `;
}

function renderProfilePage() {
  const title = getResolvedStyle('profile-page-title');
  const assets = getResolvedStyle('profile-assets-card');
  const favorites = getResolvedStyle('profile-favorites-entry');
  const submissions = getResolvedStyle('profile-submissions-entry');
  const language = getResolvedStyle('profile-language-entry');
  const settings = getResolvedStyle('profile-settings-entry');

  const renderMenu = (menu, style) => previewNode(menu.designId, `
    <div class="mini-panel" style="${styleObjectToString({
      background: style.cardBackground,
      padding: style.padding,
      margin: style.margin,
      borderRadius: style.borderRadius,
      borderColor: style.cardBorderColor,
      boxShadow: style.cardShadow
    })}">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: ${toPreviewCssValue('72rpx')}; height: ${toPreviewCssValue('72rpx')}; border-radius: ${toPreviewCssValue('22rpx')}; display: flex; align-items: center; justify-content: center; background: rgba(140, 94, 52, 0.12); font-size: ${toPreviewCssValue('32rpx')};">${menu.icon}</div>
          <div>
            <div style="font-size: ${toPreviewCssValue(style.fontSize || '32rpx')}; color: ${style.color || '#4c3424'}; font-weight: 600;">${style.text || menu.title}</div>
            <div style="font-size: ${toPreviewCssValue('22rpx')}; color: #7a624c; margin-top: ${toPreviewCssValue('6rpx')};">${menu.subtitle}</div>
          </div>
        </div>
        <div style="font-size: ${toPreviewCssValue('26rpx')}; color: rgba(139, 94, 52, 0.48);">›</div>
      </div>
    </div>
  `);

  return `
    <div class="mini-page">
      ${previewNode('profile-page-title', `<div style="${styleObjectToString({
        fontSize: title.fontSize,
        color: title.color,
        fontWeight: title.fontWeight,
        lineHeight: title.lineHeight,
        margin: title.margin
      })}">${title.text}</div>`)}
      <div style="font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c; margin-bottom: ${toPreviewCssValue('24rpx')};">保留温暖卡片语言，不改功能入口。</div>
      ${previewNode('profile-assets-card', `
        <div class="mini-panel" style="${styleObjectToString({
          background: assets.cardBackground,
          padding: assets.padding,
          margin: assets.margin,
          borderRadius: assets.borderRadius,
          borderColor: assets.cardBorderColor,
          boxShadow: assets.cardShadow
        })}">
          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <div>
              <div style="font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c;">当前身份</div>
              <div style="font-size: ${toPreviewCssValue('40rpx')}; font-weight: 600; color: #4a3419; margin-top: ${toPreviewCssValue('8rpx')};">${PAGE_SAMPLE_DATA.profile.level}</div>
            </div>
            <div style="display: grid; gap: 8px; text-align: right;">
              <div><strong style="font-size: ${toPreviewCssValue('58rpx')}; color: #8b5e34;">${PAGE_SAMPLE_DATA.profile.magnifyingGlass}</strong><div style="font-size: ${toPreviewCssValue('22rpx')}; color: #7a624c;">放大镜</div></div>
              <div style="font-size: ${toPreviewCssValue('22rpx')}; color: #7a624c;">收藏 ${PAGE_SAMPLE_DATA.profile.favorites} · 投稿 ${PAGE_SAMPLE_DATA.profile.stories}</div>
            </div>
          </div>
        </div>
      `)}
      ${renderMenu(PAGE_SAMPLE_DATA.profile.menus[0], favorites)}
      ${renderMenu(PAGE_SAMPLE_DATA.profile.menus[1], submissions)}
      ${renderMenu(PAGE_SAMPLE_DATA.profile.menus[2], language)}
      ${renderMenu(PAGE_SAMPLE_DATA.profile.menus[3], settings)}
    </div>
  `;
}

function renderAtlasPage() {
  const title = getResolvedStyle('atlas-page-title');
  const card = getResolvedStyle('atlas-exploration-card');
  const emptyState = getResolvedStyle('atlas-empty-state');
  const sample = PAGE_SAMPLE_DATA.atlas.cards[0];

  return `
    <div class="mini-page">
      ${previewNode('atlas-page-title', `<div style="${styleObjectToString({
        fontSize: title.fontSize,
        color: title.color,
        fontWeight: title.fontWeight,
        lineHeight: title.lineHeight,
        margin: title.margin
      })}">${title.text}</div>`)}
      ${previewNode('atlas-exploration-card', `
        <div class="mini-panel" style="${styleObjectToString({
          background: card.cardBackground,
          padding: card.padding,
          margin: card.margin,
          borderRadius: card.borderRadius,
          borderColor: card.cardBorderColor,
          boxShadow: card.cardShadow
        })}">
          <div style="font-size: ${toPreviewCssValue(card.fontSize || '36rpx')}; color: ${card.color || '#4c3424'}; font-weight: 600;">${card.text || sample.title}</div>
          <div style="margin-top: ${toPreviewCssValue('10rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #8b5e34;">${sample.meta}</div>
          <div style="margin-top: ${toPreviewCssValue('12rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c;">${sample.time}</div>
        </div>
      `)}
      ${previewNode('atlas-empty-state', `
        <div class="mini-panel" style="${styleObjectToString({
          background: emptyState.cardBackground,
          padding: emptyState.padding,
          margin: emptyState.margin,
          borderRadius: emptyState.borderRadius,
          borderColor: emptyState.cardBorderColor,
          boxShadow: emptyState.cardShadow,
          textAlign: emptyState.textAlign
        })}">
          <div style="font-size: ${toPreviewCssValue(emptyState.fontSize)}; color: ${emptyState.color}; line-height: ${emptyState.lineHeight};">${emptyState.text}</div>
        </div>
      `)}
    </div>
  `;
}

function renderDiscoveryPage() {
  const title = getResolvedStyle('discovery-page-title');
  const picker = getResolvedStyle('discovery-location-picker');
  const card = getResolvedStyle('discovery-location-card');
  const emptyState = getResolvedStyle('discovery-empty-state');
  const sample = PAGE_SAMPLE_DATA.discovery.cards[0];

  return `
    <div class="mini-page">
      ${previewNode('discovery-page-title', `<div style="${styleObjectToString({
        fontSize: title.fontSize,
        color: title.color,
        fontWeight: title.fontWeight,
        lineHeight: title.lineHeight,
        textAlign: title.textAlign,
        margin: title.margin
      })}">${title.text}</div>`)}
      ${previewNode('discovery-location-picker', `
        <div class="mini-button" style="${styleObjectToString({
          minHeight: picker.buttonHeight,
          lineHeight: picker.lineHeight || picker.buttonHeight,
          background: picker.buttonBackground,
          color: picker.buttonTextColor,
          borderRadius: picker.buttonRadius,
          padding: picker.padding,
          boxShadow: picker.boxShadow,
          margin: picker.margin,
          borderColor: picker.borderColor,
          borderWidth: picker.borderWidth,
          borderStyle: 'solid',
          fontSize: picker.fontSize
        })}">${picker.text}</div>
      `)}
      ${previewNode('discovery-location-card', `
        <div class="mini-panel" style="${styleObjectToString({
          background: card.cardBackground,
          padding: card.padding,
          margin: card.margin,
          borderRadius: card.borderRadius,
          borderColor: card.cardBorderColor,
          boxShadow: card.cardShadow
        })}">
          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <div>
              <div style="font-size: ${toPreviewCssValue('36rpx')}; font-weight: 600; color: #4a3419;">${card.text || sample.title}</div>
              <div style="margin-top: ${toPreviewCssValue('12rpx')}; font-size: ${toPreviewCssValue('26rpx')}; color: #7a624c; line-height: 1.6;">${sample.meta}</div>
            </div>
            <div class="mini-tag">${sample.badge}</div>
          </div>
        </div>
      `)}
      ${previewNode('discovery-empty-state', `
        <div class="mini-panel" style="${styleObjectToString({
          background: emptyState.cardBackground,
          padding: emptyState.padding,
          borderRadius: emptyState.borderRadius,
          borderColor: emptyState.cardBorderColor,
          boxShadow: emptyState.cardShadow,
          textAlign: emptyState.textAlign
        })}">
          <div style="font-size: ${toPreviewCssValue(emptyState.fontSize)}; color: ${emptyState.color}; line-height: ${emptyState.lineHeight};">${emptyState.text}</div>
        </div>
      `)}
    </div>
  `;
}

function renderLocationPage() {
  const title = getResolvedStyle('location-page-title');
  const intro = getResolvedStyle('location-intro-card');
  const option = getResolvedStyle('location-story-option');
  const overlay = getResolvedStyle('location-loading-overlay');

  return `
    <div class="mini-page" style="position: relative;">
      ${previewNode('location-page-title', `<div style="${styleObjectToString({
        fontSize: title.fontSize,
        color: title.color,
        fontWeight: title.fontWeight,
        lineHeight: title.lineHeight,
        margin: title.margin
      })}">${title.text}</div>`)}
      ${previewNode('location-intro-card', `
        <div class="mini-panel" style="${styleObjectToString({
          background: intro.cardBackground,
          padding: intro.padding,
          margin: intro.margin,
          borderRadius: intro.borderRadius,
          borderColor: intro.cardBorderColor,
          boxShadow: intro.cardShadow
        })}">
          <div style="font-size: ${toPreviewCssValue('38rpx')}; font-weight: 600; color: #4a3419;">${PAGE_SAMPLE_DATA.location.locationName}</div>
          <div style="margin-top: ${toPreviewCssValue('10rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c;">${PAGE_SAMPLE_DATA.location.locationAddress}</div>
          <div style="margin-top: ${toPreviewCssValue('14rpx')}; font-size: ${toPreviewCssValue('28rpx')}; line-height: 1.7; color: #4c3424;">${PAGE_SAMPLE_DATA.location.intro}</div>
        </div>
      `)}
      ${PAGE_SAMPLE_DATA.location.options.map((item) => previewNode('location-story-option', `
        <div class="mini-panel" style="${styleObjectToString({
          background: option.cardBackground,
          padding: option.padding,
          margin: option.margin,
          borderRadius: option.borderRadius,
          borderColor: option.cardBorderColor,
          boxShadow: option.cardShadow
        })}">
          <div style="display: flex; justify-content: space-between; gap: 10px;">
            <div>
              <div style="font-size: ${toPreviewCssValue(option.fontSize || '32rpx')}; font-weight: 600; color: ${option.color || '#4c3424'};">${option.text || item.title}</div>
              <div style="margin-top: ${toPreviewCssValue('10rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c; line-height: 1.6;">${item.summary}</div>
            </div>
            <div class="mini-tag">${item.tag}</div>
          </div>
        </div>
      `)).join('')}
      ${previewNode('location-loading-overlay', `
        <div style="margin-top: ${toPreviewCssValue('24rpx')}; padding: ${toPreviewCssValue('24rpx')}; background: ${overlay.background}; border-radius: ${toPreviewCssValue('24rpx')};">
          <div class="mini-panel" style="${styleObjectToString({
            background: overlay.cardBackground,
            borderRadius: overlay.borderRadius,
            boxShadow: overlay.boxShadow,
            color: overlay.color,
            fontSize: overlay.fontSize,
            lineHeight: overlay.lineHeight,
            padding: '40rpx 32rpx'
          })}">
            <div style="font-weight: 600; margin-bottom: ${toPreviewCssValue('10rpx')};">正在寻找传说</div>
            <div>轮播词条、AI 合规提示和遮罩文案都只做视觉预览。</div>
          </div>
        </div>
      `)}
    </div>
  `;
}

function renderStoryPage() {
  const title = getResolvedStyle('story-page-title');
  const summary = getResolvedStyle('story-summary');
  const content = getResolvedStyle('story-content');
  const favorite = getResolvedStyle('story-favorite-button');
  const back = getResolvedStyle('story-back-button');

  return `
    <div class="mini-page">
      <div class="mini-panel" style="padding: ${toPreviewCssValue('34rpx 30rpx')};">
        ${previewNode('story-page-title', `<div style="${styleObjectToString({
          fontSize: title.fontSize,
          color: title.color,
          fontWeight: title.fontWeight,
          lineHeight: title.lineHeight,
          margin: title.margin
        })}">${title.text}</div>`)}
        ${previewNode('story-summary', `<div style="${styleObjectToString({
          fontSize: summary.fontSize,
          color: summary.color,
          lineHeight: summary.lineHeight,
          textAlign: summary.textAlign,
          margin: summary.margin
        })}">${summary.text}</div>`)}
        ${previewNode('story-content', `<div style="${styleObjectToString({
          fontSize: content.fontSize,
          color: content.color,
          lineHeight: content.lineHeight,
          textAlign: content.textAlign,
          background: content.background,
          padding: content.padding,
          margin: content.margin
        })}">${content.text}</div>`)}
      </div>
      <div class="mini-button-row" style="margin-top: ${toPreviewCssValue('24rpx')}">
        ${previewNode('story-favorite-button', `<div class="mini-button" style="${styleObjectToString({
          minHeight: favorite.buttonHeight,
          lineHeight: favorite.lineHeight || favorite.buttonHeight,
          background: favorite.buttonBackground,
          color: favorite.buttonTextColor,
          borderRadius: favorite.buttonRadius,
          padding: favorite.padding,
          boxShadow: favorite.boxShadow,
          fontSize: favorite.fontSize
        })}">${favorite.text}</div>`)}
        ${previewNode('story-back-button', `<div class="mini-button" style="${styleObjectToString({
          minHeight: back.buttonHeight,
          lineHeight: back.lineHeight || back.buttonHeight,
          background: back.buttonBackground,
          color: back.buttonTextColor,
          borderRadius: back.buttonRadius,
          padding: back.padding,
          borderColor: back.borderColor,
          borderWidth: back.borderWidth,
          borderStyle: 'solid',
          fontSize: back.fontSize
        })}">${back.text}</div>`)}
      </div>
    </div>
  `;
}

function renderPublishPage() {
  const title = getResolvedStyle('publish-page-title');
  const locationSelector = getResolvedStyle('publish-location-selector');
  const titleInput = getResolvedStyle('publish-title-input');
  const contentInput = getResolvedStyle('publish-content-input');
  const submit = getResolvedStyle('publish-submit-button');

  return `
    <div class="mini-page">
      ${previewNode('publish-page-title', `<div style="${styleObjectToString({
        fontSize: title.fontSize,
        color: title.color,
        fontWeight: title.fontWeight,
        lineHeight: title.lineHeight,
        margin: title.margin
      })}">${title.text}</div>`)}
      ${previewNode('publish-location-selector', `
        <div class="mini-panel" style="${styleObjectToString({
          background: locationSelector.cardBackground,
          padding: locationSelector.padding,
          margin: locationSelector.margin,
          borderRadius: locationSelector.borderRadius,
          borderColor: locationSelector.cardBorderColor,
          boxShadow: locationSelector.cardShadow
        })}">
          <div style="font-size: ${toPreviewCssValue(locationSelector.fontSize || '38rpx')}; color: ${locationSelector.color || '#4c3424'}; font-weight: 600;">${locationSelector.text}</div>
        </div>
      `)}
      ${previewNode('publish-title-input', `
        <div class="mini-panel" style="${styleObjectToString({
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
        })}">${titleInput.text}</div>
      `)}
      ${previewNode('publish-content-input', `
        <div class="mini-panel" style="${styleObjectToString({
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
        })}">${contentInput.text}</div>
      `)}
      ${previewNode('publish-submit-button', `<div class="mini-button" style="${styleObjectToString({
        minHeight: submit.buttonHeight,
        lineHeight: submit.lineHeight || submit.buttonHeight,
        background: submit.buttonBackground,
        color: submit.buttonTextColor,
        borderRadius: submit.buttonRadius,
        padding: submit.padding,
        boxShadow: submit.boxShadow,
        fontSize: submit.fontSize
      })}">${submit.text}</div>`)}
    </div>
  `;
}

function renderMyStoriesPage() {
  const title = getResolvedStyle('my-stories-page-title');
  const card = getResolvedStyle('my-story-card');
  const emptyState = getResolvedStyle('my-stories-empty-state');
  const sample = PAGE_SAMPLE_DATA.myStories.cards[0];

  return `
    <div class="mini-page">
      ${previewNode('my-stories-page-title', `<div style="${styleObjectToString({
        fontSize: title.fontSize,
        color: title.color,
        fontWeight: title.fontWeight,
        lineHeight: title.lineHeight,
        margin: title.margin
      })}">${title.text}</div>`)}
      ${previewNode('my-story-card', `
        <div class="mini-panel" style="${styleObjectToString({
          background: card.cardBackground,
          padding: card.padding,
          margin: card.margin,
          borderRadius: card.borderRadius,
          borderColor: card.cardBorderColor,
          boxShadow: card.cardShadow
        })}">
          <div class="mini-tag">${sample.status}</div>
          <div style="margin-top: ${toPreviewCssValue('12rpx')}; font-size: ${toPreviewCssValue('34rpx')}; color: #4c3424; font-weight: 600;">${card.text || sample.title}</div>
          <div style="margin-top: ${toPreviewCssValue('10rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #8b5e34;">${sample.location}</div>
          <div style="margin-top: ${toPreviewCssValue('12rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c;">${sample.time}</div>
        </div>
      `)}
      ${previewNode('my-stories-empty-state', `
        <div class="mini-panel" style="${styleObjectToString({
          background: emptyState.cardBackground,
          padding: emptyState.padding,
          borderRadius: emptyState.borderRadius,
          borderColor: emptyState.cardBorderColor,
          boxShadow: emptyState.cardShadow,
          textAlign: emptyState.textAlign
        })}">
          <div style="font-size: ${toPreviewCssValue(emptyState.fontSize)}; color: ${emptyState.color}; line-height: ${emptyState.lineHeight};">${emptyState.text}</div>
        </div>
      `)}
    </div>
  `;
}

function renderMyStoryPreviewPage() {
  const title = getResolvedStyle('my-story-preview-title');
  const rejection = getResolvedStyle('my-story-preview-rejection');
  const contentCard = getResolvedStyle('my-story-preview-content');
  const editButton = getResolvedStyle('my-story-preview-edit-button');
  const deleteButton = getResolvedStyle('my-story-preview-delete-button');
  const sample = PAGE_SAMPLE_DATA.myStoryPreview;

  return `
    <div class="mini-page">
      ${previewNode('my-story-preview-title', `<div style="${styleObjectToString({
        fontSize: title.fontSize,
        color: title.color,
        fontWeight: title.fontWeight,
        lineHeight: title.lineHeight,
        margin: title.margin
      })}">${title.text}</div>`)}
      <div style="font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c; margin-bottom: ${toPreviewCssValue('18rpx')};">这里展示你提交给审核队列的原始内容。</div>
      ${previewNode('my-story-preview-rejection', `
        <div class="mini-panel" style="${styleObjectToString({
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
        })}">${rejection.text}</div>
      `)}
      ${previewNode('my-story-preview-content', `
        <div class="mini-panel" style="${styleObjectToString({
          background: contentCard.cardBackground,
          padding: contentCard.padding,
          margin: contentCard.margin,
          borderRadius: contentCard.borderRadius,
          borderColor: contentCard.cardBorderColor,
          boxShadow: contentCard.cardShadow
        })}">
          <div style="font-size: ${toPreviewCssValue('34rpx')}; font-weight: 600; color: #4c3424;">${sample.title}</div>
          <div style="margin-top: ${toPreviewCssValue('10rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #8b5e34;">${sample.location}</div>
          <div style="margin-top: ${toPreviewCssValue('10rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c;">${sample.time}</div>
          <div style="margin-top: ${toPreviewCssValue('18rpx')}; font-size: ${toPreviewCssValue(contentCard.fontSize || '30rpx')}; line-height: ${contentCard.lineHeight || '1.9'}; color: ${contentCard.color || '#4c3424'};">${sample.content}</div>
        </div>
      `)}
      <div class="mini-button-row">
        ${previewNode('my-story-preview-edit-button', `<div class="mini-button" style="${styleObjectToString({
          minHeight: editButton.buttonHeight,
          lineHeight: editButton.lineHeight || editButton.buttonHeight,
          background: editButton.buttonBackground,
          color: editButton.buttonTextColor,
          borderRadius: editButton.buttonRadius,
          padding: editButton.padding,
          boxShadow: editButton.boxShadow,
          fontSize: editButton.fontSize
        })}">${editButton.text}</div>`)}
        ${previewNode('my-story-preview-delete-button', `<div class="mini-button" style="${styleObjectToString({
          minHeight: deleteButton.buttonHeight,
          lineHeight: deleteButton.lineHeight || deleteButton.buttonHeight,
          background: deleteButton.buttonBackground,
          color: deleteButton.buttonTextColor,
          borderRadius: deleteButton.buttonRadius,
          padding: deleteButton.padding,
          borderColor: deleteButton.borderColor,
          borderWidth: deleteButton.borderWidth,
          borderStyle: 'solid',
          fontSize: deleteButton.fontSize
        })}">${deleteButton.text}</div>`)}
      </div>
    </div>
  `;
}

function renderMyStoryEditPage() {
  const titleInput = getResolvedStyle('my-story-edit-title-input');
  const contentInput = getResolvedStyle('my-story-edit-content-input');
  const submitButton = getResolvedStyle('my-story-edit-submit-button');
  const cancelButton = getResolvedStyle('my-story-edit-cancel-button');

  return `
    <div class="mini-page">
      <div style="font-size: ${toPreviewCssValue('56rpx')}; font-weight: 600; color: #4a3419; margin-bottom: ${toPreviewCssValue('12rpx')};">重新编辑</div>
      <div style="font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c; margin-bottom: ${toPreviewCssValue('24rpx')};">本页只预览视觉层，地点与提交流程保持原样。</div>
      ${previewNode('my-story-edit-title-input', `
        <div class="mini-panel" style="${styleObjectToString({
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
        })}">${titleInput.text}</div>
      `)}
      ${previewNode('my-story-edit-content-input', `
        <div class="mini-panel" style="${styleObjectToString({
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
        })}">${contentInput.text}</div>
      `)}
      <div class="mini-button-row">
        ${previewNode('my-story-edit-submit-button', `<div class="mini-button" style="${styleObjectToString({
          minHeight: submitButton.buttonHeight,
          lineHeight: submitButton.lineHeight || submitButton.buttonHeight,
          background: submitButton.buttonBackground,
          color: submitButton.buttonTextColor,
          borderRadius: submitButton.buttonRadius,
          padding: submitButton.padding,
          boxShadow: submitButton.boxShadow,
          fontSize: submitButton.fontSize
        })}">${submitButton.text}</div>`)}
        ${previewNode('my-story-edit-cancel-button', `<div class="mini-button" style="${styleObjectToString({
          minHeight: cancelButton.buttonHeight,
          lineHeight: cancelButton.lineHeight || cancelButton.buttonHeight,
          background: cancelButton.buttonBackground,
          color: cancelButton.buttonTextColor,
          borderRadius: cancelButton.buttonRadius,
          padding: cancelButton.padding,
          borderColor: cancelButton.borderColor,
          borderWidth: cancelButton.borderWidth,
          borderStyle: 'solid',
          fontSize: cancelButton.fontSize
        })}">${cancelButton.text}</div>`)}
      </div>
    </div>
  `;
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

function renderGroup(groupName, count, bodyHtml, isOpen) {
  return `
    <section class="inspector-group ${isOpen ? 'is-open' : ''}">
      <button type="button" class="inspector-group-toggle" data-group-toggle="${groupName}">
        <span>${groupName}</span>
        <span class="inspector-group-meta">${count}</span>
      </button>
      <div class="inspector-group-body">${bodyHtml}</div>
    </section>
  `;
}

function renderApplicationStatusGroup(component) {
  const counts = Object.values(component.propertyStates).reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { safe: 0, preview: 0, unsupported: 0 });

  return `
    <div class="component-summary">
      <h3>${component.label}</h3>
      <p>designId：<code>${component.designId}</code></p>
      <p class="selector-meta">选择器：<code>${component.selector}</code></p>
      <p class="selector-meta">可安全写入：<code>${component.safeApplySelector || '当前没有稳定 WXSS 选择器'}</code></p>
    </div>
    <div class="status-summary-grid">
      <div class="status-summary-card">
        <strong>${counts.safe}</strong>
        <span>可应用</span>
      </div>
      <div class="status-summary-card">
        <strong>${counts.preview}</strong>
        <span>仅预览</span>
      </div>
      <div class="status-summary-card">
        <strong>${counts.unsupported}</strong>
        <span>不支持</span>
      </div>
    </div>
    <div class="restore-actions">
      <button type="button" data-action="restore-component">恢复当前组件</button>
      <button type="button" data-action="restore-page">恢复当前页面</button>
      <button type="button" data-action="restore-all">恢复全部默认设计</button>
    </div>
    <ul class="legend-list">
      ${UNSUPPORTED_ITEMS.map((item) => `<li><strong>${item.label}</strong><br>${item.reason}</li>`).join('')}
    </ul>
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

  const grouped = getGroupedProperties(component);
  const expandedGroups = getExpandedGroups(component, grouped);

  return `
    <div class="editor-panel-head">
      <h2>属性面板</h2>
      <p>默认只展开当前最相关的一组，滚动和折叠都只发生在右栏内部。</p>
    </div>
    <div class="editor-inspector-body" data-inspector-scroll>
      ${Object.entries(grouped).map(([groupName, propertyKeys]) => renderGroup(
        groupName,
        propertyKeys.length,
        propertyKeys.map((propertyKey) => renderPropertyControl(propertyKey, component)).join(''),
        expandedGroups.includes(groupName)
      )).join('')}
      ${renderGroup(
        '应用状态',
        6,
        renderApplicationStatusGroup(component),
        expandedGroups.includes('应用状态')
      )}
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

  try {
    const [base64, size] = await Promise.all([toBase64(file), readImageSize(file)]);
    const asset = await postJson('/__design_editor/upload-asset', {
      fileName: file.name,
      mimeType: file.type,
      base64,
      width: size.width,
      height: size.height,
      pageId: state.selectedPageId,
      designId,
      propertyKey
    });

    let nextState = applyAsset(state, asset.assetId, asset);
    nextState = applyOverride(nextState, state.selectedPageId, designId, propertyKey, asset.assetId);
    setState(nextState);
  } catch (error) {
    modalState = {
      type: 'result',
      title: '上传失败',
      description: error instanceof Error ? error.message : '图片上传失败'
    };
    render();
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

  const groupToggle = event.target.closest('[data-group-toggle]');
  if (groupToggle) {
    toggleInspectorGroup(groupToggle.dataset.groupToggle);
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
