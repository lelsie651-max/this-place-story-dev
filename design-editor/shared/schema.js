export const PAGE_META = [
  { id: 'index', name: '首页' },
  { id: 'profile', name: '个人中心', widthHeights: { default: 812 } },
  { id: 'atlas', name: '足迹', widthHeights: { default: 812 } },
  { id: 'discovery', name: '寻找传说', widthHeights: { default: 812 } },
  { id: 'location', name: '地点详情', widthHeights: { default: 812 } },
  { id: 'story', name: '故事详情', widthHeights: { default: 812 } },
  { id: 'publish', name: '投稿', widthHeights: { default: 812 } },
  { id: 'myStories', name: '我的投稿', widthHeights: { default: 812 } },
  { id: 'myStoryPreview', name: '投稿预览', widthHeights: { default: 812 } },
  { id: 'myStoryEdit', name: '投稿编辑', widthHeights: { default: 812 } }
];

export const PAGE_COMPONENT_ORDER = {
  index: [], // The homepage catalog is projected from its sole configuration.
  profile: [
    'profile-page-surface',
    'profile-page-title',
    'profile-assets-card',
    'profile-favorites-entry',
    'profile-submissions-entry',
    'profile-language-entry',
    'profile-settings-entry'
  ],
  atlas: ['atlas-page-surface', 'atlas-page-title', 'atlas-empty-state', 'atlas-exploration-card'],
  discovery: [
    'discovery-page-surface',
    'discovery-page-title',
    'discovery-location-picker',
    'discovery-empty-state',
    'discovery-location-card'
  ],
  location: [
    'location-page-surface',
    'location-page-title',
    'location-intro-card',
    'location-story-option',
    'location-loading-overlay'
  ],
  story: [
    'story-page-surface',
    'story-page-title',
    'story-summary',
    'story-content',
    'story-favorite-button',
    'story-back-button'
  ],
  publish: [
    'publish-page-surface',
    'publish-page-title',
    'publish-location-selector',
    'publish-title-input',
    'publish-content-input',
    'publish-submit-button'
  ],
  myStories: ['my-stories-page-surface', 'my-stories-page-title', 'my-story-card', 'my-stories-empty-state'],
  myStoryPreview: [
    'my-story-preview-page-surface',
    'my-story-preview-title',
    'my-story-preview-rejection',
    'my-story-preview-content',
    'my-story-preview-edit-button',
    'my-story-preview-delete-button'
  ],
  myStoryEdit: [
    'my-story-edit-page-surface',
    'my-story-edit-title-input',
    'my-story-edit-content-input',
    'my-story-edit-submit-button',
    'my-story-edit-cancel-button'
  ]
};

export const COMPONENT_LABELS = {
  'profile-page-surface': '个人中心页面背景',
  'profile-page-title': '个人中心标题',
  'profile-assets-card': '资产卡',
  'profile-favorites-entry': '我的收藏入口',
  'profile-submissions-entry': '我的投稿入口',
  'profile-language-entry': '语言设置入口',
  'profile-settings-entry': '设置入口',
  'atlas-page-surface': '足迹页面背景',
  'atlas-page-title': '足迹标题',
  'atlas-exploration-card': '足迹卡片',
  'atlas-empty-state': '足迹空状态',
  'discovery-page-surface': '寻找传说页面背景',
  'discovery-page-title': '寻找传说标题',
  'discovery-location-picker': '地点选择按钮',
  'discovery-location-card': '推荐地点卡片',
  'discovery-empty-state': '地点空状态',
  'location-page-surface': '地点详情页面背景',
  'location-page-title': '地点页标题',
  'location-intro-card': '地点介绍卡',
  'location-story-option': '故事类型卡',
  'location-loading-overlay': '地点加载遮罩',
  'story-page-surface': '故事页面背景',
  'story-page-title': '故事标题',
  'story-summary': '故事摘要/地点',
  'story-content': '故事正文',
  'story-favorite-button': '收藏按钮',
  'story-back-button': '返回按钮',
  'publish-page-surface': '投稿页面背景',
  'publish-page-title': '投稿页标题',
  'publish-location-selector': '投稿地点卡',
  'publish-title-input': '投稿标题输入',
  'publish-content-input': '投稿正文输入',
  'publish-submit-button': '投稿提交按钮',
  'my-stories-page-surface': '我的投稿页面背景',
  'my-stories-page-title': '我的投稿标题',
  'my-story-card': '投稿列表卡',
  'my-stories-empty-state': '投稿空状态',
  'my-story-preview-page-surface': '投稿预览页面背景',
  'my-story-preview-title': '投稿预览标题',
  'my-story-preview-rejection': '拒绝原因提示',
  'my-story-preview-content': '投稿预览内容卡',
  'my-story-preview-edit-button': '投稿预览编辑按钮',
  'my-story-preview-delete-button': '投稿预览删除按钮',
  'my-story-edit-page-surface': '重新编辑页面背景',
  'my-story-edit-title-input': '编辑标题输入',
  'my-story-edit-content-input': '编辑正文输入',
  'my-story-edit-submit-button': '编辑确认按钮',
  'my-story-edit-cancel-button': '编辑取消按钮'
};

export const PROPERTY_LIBRARY = {
  text: { label: '文案', group: '文字', input: 'textarea', status: 'preview' },
  fontSize: { label: '字体大小', group: '文字', input: 'text', css: 'font-size', status: 'safe' },
  color: { label: '字体颜色', group: '文字', input: 'color-text', css: 'color', status: 'safe' },
  fontWeight: { label: '字重', group: '文字', input: 'select', css: 'font-weight', status: 'safe', options: ['400', '500', '600', '700'] },
  lineHeight: { label: '行高', group: '文字', input: 'text', css: 'line-height', status: 'safe' },
  letterSpacing: { label: '字间距', group: '文字', input: 'text', css: 'letter-spacing', status: 'safe' },
  textAlign: { label: '对齐方式', group: '文字', input: 'select', css: 'text-align', status: 'safe', options: ['left', 'center', 'right'] },
  fontFamily: { label: '字体栈', group: '文字', input: 'text', css: 'font-family', status: 'preview' },
  fontAssetId: { label: '字体文件', group: '文字', input: 'asset', status: 'preview' },
  background: { label: '背景颜色/渐变', group: '背景', input: 'text', css: 'background', status: 'safe' },
  backgroundImage: { label: '背景图片', group: '背景', input: 'asset', css: 'background-image', status: 'preview' },
  backgroundSize: { label: '背景图显示方式', group: '背景', input: 'text', css: 'background-size', status: 'preview' },
  backgroundPosition: { label: '背景图位置', group: '背景', input: 'text', css: 'background-position', status: 'preview' },
  backgroundRepeat: { label: '背景图重复', group: '背景', input: 'select', css: 'background-repeat', status: 'preview', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] },
  backgroundOverlayColor: { label: '背景叠色', group: '背景', input: 'color-text', status: 'preview' },
  width: { label: '宽度', group: '尺寸和间距', input: 'text', css: 'width', status: 'preview' },
  height: { label: '高度', group: '尺寸和间距', input: 'text', css: 'height', status: 'preview' },
  margin: { label: 'margin', group: '尺寸和间距', input: 'text', css: 'margin', status: 'safe' },
  padding: { label: 'padding', group: '尺寸和间距', input: 'text', css: 'padding', status: 'safe' },
  borderRadius: { label: '圆角', group: '尺寸和间距', input: 'text', css: 'border-radius', status: 'safe' },
  borderWidth: { label: '边框宽度', group: '尺寸和间距', input: 'text', css: 'border-width', status: 'safe' },
  borderColor: { label: '边框颜色', group: '尺寸和间距', input: 'color-text', css: 'border-color', status: 'safe' },
  boxShadow: { label: '阴影', group: '尺寸和间距', input: 'text', css: 'box-shadow', status: 'safe' },
  buttonBackground: { label: '按钮背景', group: '按钮和卡片', input: 'text', css: 'background', status: 'safe' },
  buttonTextColor: { label: '按钮文字', group: '按钮和卡片', input: 'color-text', css: 'color', status: 'safe' },
  buttonRadius: { label: '按钮圆角', group: '按钮和卡片', input: 'text', css: 'border-radius', status: 'safe' },
  buttonHeight: { label: '按钮高度', group: '按钮和卡片', input: 'text', css: 'min-height', status: 'safe' },
  buttonVisualMode: { label: '按钮模式', group: '按钮和卡片', input: 'select', status: 'preview', options: ['css', 'image'] },
  buttonImageSrc: { label: '按钮图片', group: '按钮和卡片', input: 'asset', status: 'preview' },
  buttonImageFit: { label: '按钮图片显示方式', group: '按钮和卡片', input: 'select', status: 'preview', options: ['cover', 'contain', 'fill'] },
  buttonImagePosition: { label: '按钮图片位置', group: '按钮和卡片', input: 'text', status: 'preview' },
  buttonKeepText: { label: '保留按钮文字', group: '按钮和卡片', input: 'select', status: 'preview', options: ['true', 'false'] },
  buttonImageFill: { label: '按钮图片铺满', group: '按钮和卡片', input: 'select', status: 'preview', options: ['true', 'false'] },
  buttonImageRadius: { label: '按钮图片圆角', group: '按钮和卡片', input: 'text', status: 'preview' },
  cardBackground: { label: '卡片背景', group: '按钮和卡片', input: 'text', css: 'background', status: 'safe' },
  cardBorderColor: { label: '卡片边框', group: '按钮和卡片', input: 'color-text', css: 'border-color', status: 'safe' },
  cardShadow: { label: '卡片阴影', group: '按钮和卡片', input: 'text', css: 'box-shadow', status: 'safe' },
  imageSrc: { label: '图片替换', group: '图片和 Banner', input: 'asset', status: 'preview' },
  imageWidth: { label: '图片宽度', group: '图片和 Banner', input: 'text', css: 'width', status: 'preview' },
  imageHeight: { label: '图片高度', group: '图片和 Banner', input: 'text', css: 'height', status: 'preview' },
  imageRadius: { label: '图片圆角', group: '图片和 Banner', input: 'text', css: 'border-radius', status: 'preview' },
  objectFit: { label: 'object-fit', group: '图片和 Banner', input: 'select', css: 'object-fit', status: 'preview', options: ['cover', 'contain', 'fill'] },
  bannerRatio: { label: 'Banner 比例', group: '图片和 Banner', input: 'text', status: 'preview' }
};

export const UNSUPPORTED_ITEMS = [
  {
    key: 'dragPosition',
    label: '任意拖拽定位',
    reason: '当前小程序页面依赖 flow/flex/swiper 响应式布局，直接绝对定位会破坏安全区、长文本和动态列表。'
  },
  {
    key: 'runtimeDataBinding',
    label: '基于 storyId/locationId 的动态节点定位',
    reason: '编辑器不能依赖用户数据、故事 ID 或地点 ID 锁定组件，当前只允许 designId 与稳定 class。'
  },
  {
    key: 'customFontInstall',
    label: '自动安装外部自定义字体',
    reason: '当前项目没有字体文件与小程序字体资源管线，编辑器不能伪装成已成功接入。'
  }
];

export const ROLE_PROPERTY_MAP = {
  'page-surface': ['background', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'page-title': ['text', 'fontSize', 'color', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'fontFamily', 'margin'],
  'page-subtitle': ['text', 'fontSize', 'color', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'fontFamily', 'margin'],
  'primary-button': ['text', 'fontSize', 'buttonTextColor', 'fontWeight', 'lineHeight', 'textAlign', 'buttonBackground', 'buttonRadius', 'buttonHeight', 'padding', 'margin', 'boxShadow', 'borderColor', 'borderWidth', 'buttonVisualMode', 'buttonImageSrc', 'buttonImageFit', 'buttonImagePosition', 'buttonKeepText', 'buttonImageFill', 'buttonImageRadius'],
  'secondary-button': ['text', 'fontSize', 'buttonTextColor', 'fontWeight', 'lineHeight', 'textAlign', 'buttonBackground', 'buttonRadius', 'buttonHeight', 'padding', 'margin', 'borderColor', 'borderWidth', 'buttonVisualMode', 'buttonImageSrc', 'buttonImageFit', 'buttonImagePosition', 'buttonKeepText', 'buttonImageFill', 'buttonImageRadius'],
  'danger-button': ['text', 'fontSize', 'buttonTextColor', 'fontWeight', 'lineHeight', 'buttonBackground', 'buttonRadius', 'buttonHeight', 'padding', 'borderColor', 'borderWidth', 'buttonVisualMode', 'buttonImageSrc', 'buttonImageFit', 'buttonImagePosition', 'buttonKeepText', 'buttonImageFill', 'buttonImageRadius'],
  card: ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  section: ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  swiper: ['height', 'margin', 'bannerRatio'],
  'asset-card': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow'],
  'list-card': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'empty-state': ['text', 'fontSize', 'color', 'lineHeight', 'textAlign', 'cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'location-picker-button': ['text', 'fontSize', 'buttonTextColor', 'fontWeight', 'lineHeight', 'buttonBackground', 'buttonRadius', 'buttonHeight', 'padding', 'margin', 'boxShadow', 'borderColor', 'borderWidth', 'buttonVisualMode', 'buttonImageSrc', 'buttonImageFit', 'buttonImagePosition', 'buttonKeepText', 'buttonImageFill', 'buttonImageRadius'],
  'intro-card': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'option-card': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'fontSize', 'color'],
  overlay: ['background', 'cardBackground', 'borderRadius', 'boxShadow', 'color', 'fontSize', 'lineHeight'],
  'story-summary': ['text', 'fontSize', 'color', 'lineHeight', 'letterSpacing', 'textAlign', 'margin'],
  'story-content': ['text', 'fontSize', 'color', 'lineHeight', 'letterSpacing', 'textAlign', 'background', 'padding', 'margin', 'fontFamily', 'fontAssetId'],
  'location-selector': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'text', 'fontSize', 'color', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'text-input': ['text', 'fontSize', 'color', 'lineHeight', 'fontFamily', 'background', 'padding', 'height', 'borderRadius', 'borderColor', 'borderWidth', 'boxShadow'],
  textarea: ['text', 'fontSize', 'color', 'lineHeight', 'fontFamily', 'background', 'padding', 'height', 'borderRadius', 'borderColor', 'borderWidth', 'boxShadow'],
  'content-card': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'fontSize', 'color', 'lineHeight', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'status-banner': ['text', 'fontSize', 'color', 'lineHeight', 'background', 'padding', 'margin', 'borderRadius', 'borderColor', 'borderWidth'],
  'menu-entry': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'text', 'fontSize', 'color', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'intro-block': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor'],
  'content-block': ['cardBackground', 'padding', 'margin', 'borderRadius', 'cardBorderColor', 'cardShadow', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundOverlayColor']
};

export const MANUAL_COMPONENT_OPTIONS = {
  'profile-page-surface': { role: 'page-surface', selector: '.page', page: 'profile', safeApplySelector: '.page' },
  'profile-favorites-entry': { safeApplySelector: null },
  'profile-submissions-entry': { safeApplySelector: null },
  'profile-language-entry': { safeApplySelector: null },
  'profile-settings-entry': { safeApplySelector: null },
  'atlas-page-surface': { role: 'page-surface', selector: '.page', page: 'atlas', safeApplySelector: '.page' },
  'discovery-page-surface': { role: 'page-surface', selector: '.page', page: 'discovery', safeApplySelector: '.page' },
  'discovery-location-picker': { safeApplySelector: '.choose-location-button' },
  'location-page-surface': { role: 'page-surface', selector: '.page', page: 'location', safeApplySelector: '.page' },
  'story-page-surface': { role: 'page-surface', selector: '.page', page: 'story', safeApplySelector: '.page' },
  'publish-page-surface': { role: 'page-surface', selector: '.page', page: 'publish', safeApplySelector: '.page' },
  'publish-location-selector': { safeApplySelector: '.field-card' },
  'publish-title-input': { safeApplySelector: '.text-input' },
  'publish-content-input': { safeApplySelector: '.text-area' },
  'my-stories-page-surface': { role: 'page-surface', selector: '.page', page: 'myStories', safeApplySelector: '.page' },
  'my-story-preview-page-surface': { role: 'page-surface', selector: '.page', page: 'myStoryPreview', safeApplySelector: '.page' },
  'my-story-edit-page-surface': { role: 'page-surface', selector: '.page', page: 'myStoryEdit', safeApplySelector: '.page' },
  'my-story-edit-title-input': { safeApplySelector: '.text-input' },
  'my-story-edit-content-input': { safeApplySelector: '.text-area' },
  'story-page-title': { safeApplySelector: '.story-title, .forum-title' },
  'story-summary': { safeApplySelector: '.location-text, .forum-location' },
  'story-content': { safeApplySelector: '.story-content' }
};

export function getPageName(pageId) {
  const page = PAGE_META.find((item) => item.id === pageId);
  return page ? page.name : pageId;
}

export function normalizeRegistryComponent(component) {
  const manual = MANUAL_COMPONENT_OPTIONS[component.designId] || {};
  const supported = Array.from(new Set([
    ...(ROLE_PROPERTY_MAP[component.role] || ROLE_PROPERTY_MAP.card),
    ...(manual.assetSlots || [])
  ]));
  const attrSelector = String(component.selector || '').includes('[');
  const safeApplySelector = manual.safeApplySelector === undefined
    ? (attrSelector ? null : component.selector)
    : manual.safeApplySelector;
  const propertyStates = {};

  supported.forEach((propertyKey) => {
    const property = PROPERTY_LIBRARY[propertyKey];
    if (!property) {
      return;
    }

    const defaultStatus = property.status;
    const finalStatus = defaultStatus === 'safe' && safeApplySelector ? 'safe' : defaultStatus;
    propertyStates[propertyKey] = {
      status: finalStatus,
      reason: finalStatus === 'safe'
        ? '当前可生成到独立 WXSS 设计覆盖层。'
        : finalStatus === 'preview'
          ? '编辑器可预览，但当前不会自动写入小程序源码。'
          : '当前不支持。'
    };
  });

  return {
    ...component,
    label: COMPONENT_LABELS[component.designId] || component.designId,
    pageName: getPageName(component.page),
    safeApplySelector,
    supportedProperties: supported,
    propertyStates,
    assetSlots: manual.assetSlots || [],
    hasSafeApply: !!safeApplySelector
  };
}

export function buildComponentCatalog(registry, homeConfig = null) {
  const extraComponents = Object.entries(MANUAL_COMPONENT_OPTIONS)
    .filter(([, config]) => config.role === 'page-surface')
    .map(([designId, config]) => ({
      page: config.page,
      pageName: getPageName(config.page),
      designId,
      selector: config.selector,
      role: config.role,
      editableProperties: ROLE_PROPERTY_MAP[config.role] || []
    }));
  const homeComponents = (homeConfig?.elements || []).map((element) => ({
    ...element, page: 'index', pageName: homeConfig.pageName, label: element.name,
    selector: '', safeApplySelector: null, supportedProperties: [], propertyStates: {},
    assetSlots: [], hasSafeApply: false
  }));
  const components = [...registry.components, ...extraComponents]
    .filter((component) => component.page !== 'index')
    .map(normalizeRegistryComponent).concat(homeComponents);
  const byId = Object.fromEntries(components.map((item) => [item.designId, item]));
  const byPage = PAGE_META.reduce((acc, page) => {
    acc[page.id] = (PAGE_COMPONENT_ORDER[page.id] || [])
      .map((designId) => byId[designId])
      .filter(Boolean);
    return acc;
  }, {});
  byPage.index = homeComponents;

  return { components, byId, byPage };
}

export function getAllPropertyGroups() {
  const groups = {};
  Object.entries(PROPERTY_LIBRARY).forEach(([key, value]) => {
    if (!groups[value.group]) {
      groups[value.group] = [];
    }
    groups[value.group].push({ key, ...value });
  });
  return groups;
}

export function createEmptyDraft() {
  return {
    overrides: {},
    metadata: {},
    assets: {},
    modifiedAt: new Date().toISOString()
  };
}

export function cloneDraft(draft) {
  return JSON.parse(JSON.stringify(draft));
}

export function listChanges(draft) {
  const changes = [];
  Object.entries(draft.overrides || {}).forEach(([pageId, componentMap]) => {
    Object.entries(componentMap || {}).forEach(([designId, propertyMap]) => {
      Object.entries(propertyMap || {}).forEach(([propertyKey, nextValue]) => {
        changes.push({
          pageId,
          designId,
          propertyKey,
          nextValue,
          modifiedAt: draft.metadata?.[pageId]?.[designId]?.[propertyKey]?.modifiedAt || draft.modifiedAt
        });
      });
    });
  });
  return changes;
}

export function upsertOverride(draft, pageId, designId, propertyKey, value) {
  const next = cloneDraft(draft);
  const now = new Date().toISOString();
  next.overrides[pageId] = next.overrides[pageId] || {};
  next.overrides[pageId][designId] = next.overrides[pageId][designId] || {};
  next.overrides[pageId][designId][propertyKey] = value;
  next.metadata[pageId] = next.metadata[pageId] || {};
  next.metadata[pageId][designId] = next.metadata[pageId][designId] || {};
  next.metadata[pageId][designId][propertyKey] = {
    modifiedAt: now
  };
  next.modifiedAt = now;
  return next;
}

export function removeOverride(draft, pageId, designId, propertyKey) {
  const next = cloneDraft(draft);
  if (next.overrides?.[pageId]?.[designId]) {
    delete next.overrides[pageId][designId][propertyKey];
    if (Object.keys(next.overrides[pageId][designId]).length === 0) {
      delete next.overrides[pageId][designId];
    }
    if (next.overrides[pageId] && Object.keys(next.overrides[pageId]).length === 0) {
      delete next.overrides[pageId];
    }
  }
  if (next.metadata?.[pageId]?.[designId]) {
    delete next.metadata[pageId][designId][propertyKey];
    if (Object.keys(next.metadata[pageId][designId]).length === 0) {
      delete next.metadata[pageId][designId];
    }
    if (next.metadata[pageId] && Object.keys(next.metadata[pageId]).length === 0) {
      delete next.metadata[pageId];
    }
  }
  next.modifiedAt = new Date().toISOString();
  return next;
}

export function removeComponentOverrides(draft, pageId, designId) {
  const next = cloneDraft(draft);
  if (next.overrides[pageId]) {
    delete next.overrides[pageId][designId];
    if (Object.keys(next.overrides[pageId]).length === 0) {
      delete next.overrides[pageId];
    }
  }
  if (next.metadata[pageId]) {
    delete next.metadata[pageId][designId];
    if (Object.keys(next.metadata[pageId]).length === 0) {
      delete next.metadata[pageId];
    }
  }
  next.modifiedAt = new Date().toISOString();
  return next;
}

export function removePageOverrides(draft, pageId) {
  const next = cloneDraft(draft);
  delete next.overrides[pageId];
  delete next.metadata[pageId];
  next.modifiedAt = new Date().toISOString();
  return next;
}

export function resetDraft() {
  return createEmptyDraft();
}

export function upsertAsset(draft, assetId, assetInfo) {
  const next = cloneDraft(draft);
  next.assets[assetId] = {
    ...(next.assets[assetId] || {}),
    ...assetInfo,
    assetId,
    updatedAt: new Date().toISOString()
  };
  next.modifiedAt = new Date().toISOString();
  return next;
}

export function getOverrideMeta(draft, pageId, designId, propertyKey) {
  return draft.metadata?.[pageId]?.[designId]?.[propertyKey] || null;
}

export function serializeDraft(draft) {
  return JSON.stringify(draft);
}
