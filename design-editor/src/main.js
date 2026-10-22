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
  DEVICE_WIDTHS,
  PAGE_SAMPLE_DATA,
  getDefaultComponentState,
  getDefaultValue
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
  selectPage,
  selectWidth,
  undo
} from './editor-core.js';

const catalog = buildComponentCatalog(registryData);
const pageList = Object.keys(catalog.byPage);
const statusLabels = {
  safe: '可应用',
  preview: '仅预览',
  unsupported: '不支持'
};

let state = syncSelectedComponent(createEditorState(), createEditorState().selectedPageId);
let modalState = null;

const app = document.querySelector('#app');

window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges(state)) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
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

function toPreviewCssValue(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const width = state.selectedWidth;
  return String(value).replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, raw) => {
    const px = (Number(raw) / 750) * width;
    return `${px.toFixed(2)}px`;
  });
}

function styleObjectToString(styleObject) {
  return Object.entries(styleObject)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([property, value]) => `${property}: ${toPreviewCssValue(value)};`)
    .join(' ');
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

function renderIndexPage() {
  const title = getResolvedStyle('index-page-title');
  const subtitle = getResolvedStyle('index-page-subtitle');
  const button = getResolvedStyle('index-primary-button');
  const section = getResolvedStyle('index-recommendation-section');
  const swiper = getResolvedStyle('index-recommendation-swiper');
  const card = getResolvedStyle('index-recommendation-card');
  const sampleCard = PAGE_SAMPLE_DATA.index.recommendationCards[0];

  const coverStyle = styleObjectToString({
    width: card.imageWidth || '214rpx',
    minWidth: card.imageWidth || '214rpx',
    height: card.imageHeight || '312rpx',
    borderRadius: card.imageRadius || '0',
    background: card.imageSrc
      ? `center / ${card.objectFit || 'cover'} no-repeat url("${card.imageSrc}")`
      : 'linear-gradient(180deg, rgba(214, 188, 149, 0.56), rgba(176, 129, 76, 0.66))'
  });

  return `
    <div class="mini-page">
      <section style="margin-bottom: ${toPreviewCssValue('40rpx')}; text-align: center;">
        ${previewNode('index-page-title', `<div style="${styleObjectToString({
          fontSize: title.fontSize,
          color: title.color,
          fontWeight: title.fontWeight,
          lineHeight: title.lineHeight,
          letterSpacing: title.letterSpacing,
          fontFamily: title.fontFamily,
          textAlign: title.textAlign,
          margin: title.margin
        })}">${title.text}</div>`)}
        ${previewNode('index-page-subtitle', `<div style="${styleObjectToString({
          fontSize: subtitle.fontSize,
          color: subtitle.color,
          fontWeight: subtitle.fontWeight,
          lineHeight: subtitle.lineHeight,
          fontFamily: subtitle.fontFamily,
          textAlign: subtitle.textAlign,
          margin: subtitle.margin
        })}">${subtitle.text}</div>`)}
      </section>

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

      ${previewNode('index-recommendation-section', `
        <section class="mini-panel" style="${styleObjectToString({
          background: section.cardBackground,
          padding: section.padding,
          margin: section.margin,
          borderRadius: section.borderRadius,
          borderColor: section.cardBorderColor,
          boxShadow: section.cardShadow
        })}">
          <div class="mini-tag" style="margin-bottom: ${toPreviewCssValue('12rpx')}">编辑推荐</div>
          <h3 style="margin: 0 0 ${toPreviewCssValue('10rpx')}; font-size: ${toPreviewCssValue('30rpx')}; color: #4a3419;">先听一段传说，再决定要不要出发</h3>
          <p style="margin: 0 0 ${toPreviewCssValue('22rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #7a624c; line-height: 1.6;">当前预览使用设计配置中的静态示例内容。</p>
          ${previewNode('index-recommendation-swiper', `
            <div style="${styleObjectToString({ height: swiper.height || '312rpx', margin: swiper.margin })}">
              ${previewNode('index-recommendation-card', `
                <article class="mini-card" style="display: flex; overflow: hidden; ${styleObjectToString({
                  background: card.cardBackground,
                  borderRadius: card.borderRadius,
                  borderColor: card.cardBorderColor,
                  boxShadow: card.cardShadow,
                  margin: card.margin
                })}">
                  <div style="${coverStyle}; display: flex; align-items: center; justify-content: center; color: #fff7ef; font-size: ${toPreviewCssValue('42rpx')};">📖</div>
                  <div style="padding: ${toPreviewCssValue('28rpx 28rpx 24rpx')}; flex: 1; min-width: 0;">
                    <div class="mini-tag" style="margin-bottom: ${toPreviewCssValue('12rpx')}">${sampleCard.label}</div>
                    <div style="font-size: ${toPreviewCssValue('32rpx')}; font-weight: 600; line-height: 1.4; color: #412a1f;">${card.text || sampleCard.title}</div>
                    <div style="margin-top: ${toPreviewCssValue('8rpx')}; font-size: ${toPreviewCssValue('24rpx')}; color: #8b5e34;">${sampleCard.location}</div>
                    <div style="margin-top: ${toPreviewCssValue('12rpx')}; font-size: ${toPreviewCssValue('24rpx')}; line-height: 1.6; color: #6f5740;">${sampleCard.summary}</div>
                    <div style="margin-top: ${toPreviewCssValue('18rpx')}; font-size: ${toPreviewCssValue('24rpx')}; font-weight: 600; color: #6b4527;">${sampleCard.cta}</div>
                  </div>
                </article>
              `)}
            </div>
          `)}
        </section>
      `)}
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

function renderInspector() {
  const component = getComponent();
  if (!component) {
    return '<div class="inspector-body"><p class="helper-text">当前页面没有可编辑组件。</p></div>';
  }

  const grouped = component.supportedProperties.reduce((acc, propertyKey) => {
    const property = PROPERTY_LIBRARY[propertyKey];
    const groupName = property?.group || '未分类';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(propertyKey);
    return acc;
  }, {});

  return `
    <div class="panel-header">
      <h2>属性面板</h2>
      <p>右侧明确区分可安全应用、仅预览和不支持的属性状态。</p>
    </div>
    <div class="inspector-body">
      <section class="inspector-section component-summary">
        <h3>${component.label}</h3>
        <p>designId：<code>${component.designId}</code></p>
        <p class="selector-meta">选择器：<code>${component.selector}</code></p>
        <p class="selector-meta">可安全写入：<code>${component.safeApplySelector || '当前没有稳定 WXSS 选择器'}</code></p>
      </section>

      ${Object.entries(grouped).map(([groupName, propertyKeys]) => `
        <section class="inspector-section property-group">
          <h4>${groupName}</h4>
          ${propertyKeys.map((propertyKey) => renderPropertyControl(propertyKey, component)).join('')}
        </section>
      `).join('')}

      <section class="inspector-section">
        <div class="component-summary">
          <h3>当前不支持</h3>
          <ul class="legend-list">
            ${UNSUPPORTED_ITEMS.map((item) => `<li><strong>${item.label}</strong><br>${item.reason}</li>`).join('')}
          </ul>
        </div>
      </section>
    </div>
  `;
}

function renderSidebar() {
  return `
    <div class="panel-header">
      <h2>页面与组件</h2>
      <p>左侧按页面切换，并展示当前页面的稳定 designId 组件树。</p>
    </div>
    <div class="sidebar-body">
      <div class="page-list">
        ${pageList.map((pageId) => `
          <button type="button" class="${pageId === state.selectedPageId ? 'is-active' : ''}" data-page-id="${pageId}">
            ${catalog.byPage[pageId]?.[0]?.pageName || pageId}
          </button>
        `).join('')}
      </div>
      <div class="tree-title">组件树</div>
      <div class="component-tree">
        ${(catalog.byPage[state.selectedPageId] || []).map((component) => `
          <button type="button" class="${component.designId === state.selectedComponentId ? 'is-active' : ''}" data-component-id="${component.designId}">
            <strong>${component.label}</strong>
            <code>${component.designId}</code>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCanvas() {
  const renderer = pageRenderers[state.selectedPageId];
  return `
    <div class="canvas-header">
      <h2>设备预览</h2>
      <p>默认模拟微信小程序页面，使用静态示例数据和当前 design 配置预览。</p>
      <div class="canvas-toolbar">
        <div class="device-switch">
          ${DEVICE_WIDTHS.map((width) => `
            <button type="button" class="${width === state.selectedWidth ? 'is-active' : ''}" data-device-width="${width}">
              ${width}px
            </button>
          `).join('')}
        </div>
        <div class="toolbar-row">
          <span class="status-pill ${hasUnsavedChanges(state) ? 'is-dirty' : ''}">
            ${hasUnsavedChanges(state) ? '有未保存修改' : '已与上次导出/应用同步'}
          </span>
          <button type="button" data-action="undo">撤销</button>
          <button type="button" data-action="redo">重做</button>
          <button type="button" data-action="restore-component">恢复当前组件</button>
          <button type="button" data-action="restore-page">恢复当前页面</button>
          <button type="button" data-action="restore-all">恢复全部默认设计</button>
        </div>
      </div>
    </div>
    <div class="canvas-body">
      <div class="device-stage">
        <div class="device-frame" style="--device-width: ${state.selectedWidth}px;">
          <div class="device-screen">
            ${renderer ? renderer() : '<div class="mini-page">页面预览尚未实现。</div>'}
          </div>
        </div>
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

function render() {
  app.innerHTML = `
    <div class="editor-shell">
      <header class="topbar">
        <div class="topbar-title">
          <h1>此地有传说 UI 设计编辑器</h1>
          <p>独立运行在 <code>design-editor/</code>，预览不依赖 CloudBase，也不会在你点“应用到小程序”之前改动 <code>miniprogram/</code>。</p>
        </div>
        <div class="topbar-actions">
          <span class="status-pill ${hasUnsavedChanges(state) ? 'is-dirty' : ''}">
            ${hasUnsavedChanges(state) ? '未保存修改提示已开启' : '当前没有未保存修改'}
          </span>
          <button type="button" data-action="export" class="primary">导出设计</button>
          <button type="button" data-action="apply-preview">应用到小程序</button>
        </div>
      </header>

      <main class="workspace">
        <aside class="sidebar">${renderSidebar()}</aside>
        <section class="canvas-panel">${renderCanvas()}</section>
        <aside class="inspector">${renderInspector()}</aside>
      </main>
    </div>
    ${renderModal()}
  `;
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

  const pageButton = event.target.closest('[data-page-id]');
  if (pageButton) {
    const nextState = syncSelectedComponent(selectPage(state, pageButton.dataset.pageId), pageButton.dataset.pageId);
    setState(nextState);
    return;
  }

  const componentButton = event.target.closest('[data-component-id]');
  if (componentButton) {
    setState(selectComponent(state, componentButton.dataset.componentId));
    return;
  }

  const deviceButton = event.target.closest('[data-device-width]');
  if (deviceButton) {
    setState(selectWidth(state, Number(deviceButton.dataset.deviceWidth)));
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
      setState(restorePage(state, state.selectedPageId));
      return;
    case 'restore-all':
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
