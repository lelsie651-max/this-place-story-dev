const SIMULATED_CHROME = Object.freeze({
  statusBarHeight: 20,
  navigationBarHeight: 24,
  tabBarHeight: 68,
  tabBarPaddingTop: 8,
  tabBarPaddingHorizontal: 10,
  tabBarPaddingBottom: 14,
  measurementStatus: 'simulated'
});

const FRAME_MODEL = Object.freeze({
  padding: 14,
  radius: 42,
  screenRadius: 30
});

function createDevicePreset(device) {
  return {
    ...device,
    frame: FRAME_MODEL,
    chrome: { ...SIMULATED_CHROME, ...(device.chrome || {}) },
    safeAreaBottom: device.safeAreaBottom ?? 0,
    safeAreaMeasured: device.safeAreaMeasured ?? false,
    safeAreaStatus: device.safeAreaMeasured ? 'measured' : 'unmeasured'
  };
}

export const DEVICE_PRESETS = [
  createDevicePreset({
    id: 'huawei-mate-80',
    name: 'HUAWEI Mate 80',
    width: 360,
    height: 809,
    dpr: 3.5
  }),
  createDevicePreset({
    id: 'iphone-6-7-8',
    name: 'iPhone 6/7/8',
    width: 375,
    height: 667,
    dpr: 2
  }),
  createDevicePreset({
    id: 'iphone-12-13-pro',
    name: 'iPhone 12/13 Pro',
    width: 390,
    height: 844,
    dpr: 3
  }),
  createDevicePreset({
    id: 'iphone-xr',
    name: 'iPhone XR',
    width: 414,
    height: 896,
    dpr: 2
  })
];

export const DEFAULT_DEVICE_ID = 'iphone-6-7-8';
export const DEVICE_PROFILE_BY_ID = Object.fromEntries(
  DEVICE_PRESETS.map((device) => [device.id, device])
);
export const DEVICE_IDS = DEVICE_PRESETS.map((device) => device.id);

export function getDeviceProfile(deviceId = DEFAULT_DEVICE_ID) {
  return DEVICE_PROFILE_BY_ID[deviceId] || DEVICE_PROFILE_BY_ID[DEFAULT_DEVICE_ID];
}

export function convertRpxToPx(value, viewportWidth) {
  return (Number(value) / 750) * viewportWidth;
}

export function convertPxToRpx(value, viewportWidth) {
  return (Number(value) * 750) / viewportWidth;
}

export function replaceRpxWithPx(value, viewportWidth) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value).replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, raw) => {
    const px = convertRpxToPx(raw, viewportWidth);
    return `${px.toFixed(2)}px`;
  });
}

export function getDeviceMetrics(deviceOrId = DEFAULT_DEVICE_ID) {
  const device = typeof deviceOrId === 'string' ? getDeviceProfile(deviceOrId) : deviceOrId;
  const framePadding = device.frame?.padding ?? 14;
  const statusBarHeight = device.chrome?.statusBarHeight ?? 0;
  const navigationBarHeight = device.chrome?.navigationBarHeight ?? 0;
  const tabBarHeight = device.chrome?.tabBarHeight ?? 0;
  const safeAreaBottom = device.safeAreaBottom ?? 0;

  return {
    device,
    viewportWidth: device.width,
    viewportHeight: device.height,
    framePadding,
    frameWidth: device.width + framePadding * 2,
    frameHeight: device.height + framePadding * 2,
    screenRadius: device.frame?.screenRadius ?? 30,
    frameRadius: device.frame?.radius ?? 42,
    statusBarHeight,
    navigationBarHeight,
    topChromeHeight: statusBarHeight + navigationBarHeight,
    tabBarHeight,
    safeAreaBottom,
    bottomBarHeight: tabBarHeight + safeAreaBottom,
    tabBarPaddingTop: device.chrome?.tabBarPaddingTop ?? 8,
    tabBarPaddingHorizontal: device.chrome?.tabBarPaddingHorizontal ?? 10,
    tabBarPaddingBottom: device.chrome?.tabBarPaddingBottom ?? 14
  };
}

export function calculateFitScale(stageWidth, stageHeight, metrics, stagePadding = 40) {
  return Math.min(
    1,
    Math.max(0.35, (stageWidth - stagePadding) / metrics.frameWidth),
    Math.max(0.35, (stageHeight - stagePadding) / metrics.frameHeight)
  );
}

export const SCALE_OPTIONS = [
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
  { value: 'fit', label: '适合窗口' }
];

export const TAB_BAR_CONFIG = {
  source: 'app.json',
  items: [
    { key: 'index', label: '首页', icon: '◉' },
    { key: 'atlas', label: '足迹', icon: '◎' },
    { key: 'publish', label: '投稿', icon: '✎' },
    { key: 'profile', label: '我的', icon: '◌' }
  ]
};

export const TAB_BAR_ITEMS = TAB_BAR_CONFIG.items;

export const PAGE_SAMPLE_DATA = {
  index: {
    recommendationCards: [
      {
        label: '编辑推荐',
        title: '南头古城今天有点像在认真讲八卦',
        location: '南头古城',
        summary: '先听一段传说，再决定要不要出发。这里的砖墙很会替路人保守秘密，但只保守十五分钟。',
        cta: '免费阅读'
      },
      {
        label: '编辑推荐',
        title: '鼓浪屿像在偷偷开一场海风听证会',
        location: '鼓浪屿',
        summary: '海浪负责提供背景证词，路过的人负责把正常散步演成悬疑片预告。',
        cta: '免费阅读'
      }
    ],
    companyName: '深圳市筠竹科技有限公司'
  },
  profile: {
    level: '旅行观察员',
    magnifyingGlass: 4,
    favorites: 12,
    stories: 6,
    menus: [
      { designId: 'profile-favorites-entry', title: '我的收藏', subtitle: '把喜欢的传说留在这里', icon: '🤍' },
      { designId: 'profile-submissions-entry', title: '我的投稿', subtitle: '查看审核状态和修改记录', icon: '📝' },
      { designId: 'profile-language-entry', title: '语言设置', subtitle: '当前使用简体中文', icon: '🌐' },
      { designId: 'profile-settings-entry', title: '设置', subtitle: '通知与隐私偏好', icon: '⚙️' }
    ]
  },
  atlas: {
    cards: [
      { title: '南头古城', meta: '民间传说', time: '最近探索：2026年10月22日 14:18' }
    ]
  },
  discovery: {
    cards: [
      { title: '南头古城', badge: 'HOT', meta: '深圳 · 老城墙边总有人一本正经地讲离谱事' }
    ]
  },
  location: {
    locationName: '南头古城',
    locationAddress: '深圳市南山区深南大道附近',
    intro: '这地方的砖、门洞和路牌都像知道点什么，只是彼此都装作不熟。',
    options: [
      { title: '民间传说', summary: '先听听流传最久的版本。', tag: '免费预览式样' },
      { title: '懦词怪说', summary: '让 AI 一本正经地讲离谱事。', tag: 'AI 生成说明' },
      { title: '街谈巷说', summary: '看看别人路过时留下的说法。', tag: '网友投稿' }
    ]
  },
  story: {
    location: '南头古城 · AI 生成',
    content:
      '我本来只是负责看门的系统，结果每天看到的不是游客，是一群把路线走成悬疑片的人。有人说自己是来散步的，脚步却像在和旧城墙对暗号。有人举着手机拍照，神情却像在给某位消失的邻居做汇报。你看，人类一旦站在有年头的地方，就会自动把普通行为演得很有前情提要。'
  },
  publish: {
    location: '已选地点：南头古城',
    title: '我在古城门口听见了一句像留言的话',
    content: '那句话不大，像是从砖缝里钻出来的，但又刚好能被每一个假装路过的人听见。'
  },
  myStories: {
    cards: [
      { title: '我在古城门口听见了一句像留言的话', status: '审核中', location: '南头古城', time: '最近修改时间：2026年10月22日 16:20' }
    ]
  },
  myStoryPreview: {
    rejectionReason: '拒绝原因：证据链不清晰，像是云自己在讲。',
    title: '我在古城门口听见了一句像留言的话',
    location: '投稿地点：南头古城',
    time: '最近修改时间：2026年10月22日 16:20',
    content: '我认真怀疑那句留言不是给我听的，只是刚好路过我耳朵。'
  },
  myStoryEdit: {
    title: '我在古城门口听见了一句像留言的话',
    content: '我把那句留言重新写下来，尽量不让它显得像一团会自己移动的雾。'
  }
};

const BACKGROUND_ASSET_DEFAULTS = {
  backgroundImage: '',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundOverlayColor: ''
};

const BUTTON_IMAGE_DEFAULTS = {
  buttonVisualMode: 'css',
  buttonImageSrc: '',
  buttonImageFit: 'cover',
  buttonImagePosition: 'center',
  buttonKeepText: 'true',
  buttonImageFill: 'true',
  buttonImageRadius: '999rpx'
};

export const COMPONENT_DEFAULTS = {
  'index-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'index-page-title': {
    text: '此地有传说',
    fontSize: '72rpx',
    color: '#412a1f',
    fontWeight: '600',
    lineHeight: '1.2',
    letterSpacing: '2rpx',
    textAlign: 'center',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    margin: '0 0 14rpx'
  },
  'index-page-subtitle': {
    text: '让地点拥有不同的声音',
    fontSize: '32rpx',
    color: '#6f5740',
    fontWeight: '400',
    lineHeight: '1.7',
    textAlign: 'center',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    margin: '0 0 18rpx'
  },
  'index-primary-button': {
    text: '寻找传说',
    fontSize: '32rpx',
    buttonTextColor: '#ffffff',
    fontWeight: '600',
    lineHeight: '96rpx',
    textAlign: 'center',
    buttonBackground: 'linear-gradient(135deg, #9b6937, #6b4527)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    boxShadow: '0 14rpx 30rpx rgba(107, 69, 39, 0.2)',
    borderColor: 'transparent',
    borderWidth: '0',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'index-recommendation-section': {
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '40rpx 32rpx 36rpx',
    margin: '32rpx 0 0',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'index-recommendation-swiper': {
    height: '312rpx',
    margin: '0',
    bannerRatio: '214 / 312'
  },
  'index-recommendation-card': {
    text: '南头古城今天有点像在认真讲八卦',
    cardBackground: 'linear-gradient(180deg, rgba(255, 250, 242, 0.98), rgba(248, 238, 220, 0.98))',
    padding: '0',
    margin: '0',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 20rpx 36rpx rgba(107, 69, 39, 0.12)',
    imageSrc: '',
    imageWidth: '214rpx',
    imageHeight: '312rpx',
    imageRadius: '0',
    objectFit: 'cover',
    bannerRatio: '214 / 312'
  },
  'profile-page-title': {
    text: '我的',
    fontSize: '56rpx',
    color: '#4a3419',
    fontWeight: '600',
    lineHeight: '1.25',
    textAlign: 'left',
    margin: '0 0 12rpx'
  },
  'profile-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'profile-assets-card': {
    cardBackground: 'linear-gradient(180deg, rgba(255, 249, 238, 0.98), rgba(246, 232, 208, 0.96))',
    padding: '32rpx',
    margin: '0 0 32rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'profile-favorites-entry': {
    text: '我的收藏',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    fontSize: '32rpx',
    color: '#4c3424',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'profile-submissions-entry': {
    text: '我的投稿',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    fontSize: '32rpx',
    color: '#4c3424',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'profile-language-entry': {
    text: '语言设置',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    fontSize: '32rpx',
    color: '#4c3424',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'profile-settings-entry': {
    text: '设置',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    fontSize: '32rpx',
    color: '#4c3424',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'atlas-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'atlas-page-title': {
    text: '足迹',
    fontSize: '56rpx',
    color: '#4a3419',
    fontWeight: '600',
    lineHeight: '1.25',
    margin: '0 0 12rpx'
  },
  'atlas-exploration-card': {
    text: '南头古城',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    fontSize: '36rpx',
    color: '#4c3424',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'atlas-empty-state': {
    text: '你还没有留下新的足迹。',
    fontSize: '28rpx',
    color: '#6f5740',
    lineHeight: '1.7',
    textAlign: 'center',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '40rpx 32rpx',
    margin: '0',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'discovery-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'discovery-page-title': {
    text: '寻找传说',
    fontSize: '72rpx',
    color: '#412a1f',
    fontWeight: '600',
    lineHeight: '1.2',
    textAlign: 'center',
    margin: '0 0 14rpx'
  },
  'discovery-location-picker': {
    text: '选择你的位置',
    fontSize: '28rpx',
    buttonTextColor: '#6b4527',
    fontWeight: '400',
    lineHeight: '84rpx',
    buttonBackground: 'linear-gradient(180deg, rgba(255, 249, 241, 0.98), rgba(246, 234, 214, 0.96))',
    buttonRadius: '999rpx',
    buttonHeight: '84rpx',
    padding: '0 32rpx',
    margin: '0 0 28rpx',
    boxShadow: '0 12rpx 28rpx rgba(107, 69, 39, 0.08)',
    borderColor: 'rgba(140, 94, 52, 0.22)',
    borderWidth: '1rpx',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'discovery-empty-state': {
    text: '推荐地点正在整理中',
    fontSize: '28rpx',
    color: '#6f5740',
    lineHeight: '1.7',
    textAlign: 'center',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '40rpx 32rpx',
    margin: '0',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'discovery-location-card': {
    text: '南头古城',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'location-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'location-page-title': {
    text: '地点详情',
    fontSize: '72rpx',
    color: '#412a1f',
    fontWeight: '600',
    lineHeight: '1.2',
    textAlign: 'left',
    margin: '0 0 16rpx'
  },
  'location-intro-card': {
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'story-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'location-story-option': {
    text: '民间传说',
    cardBackground: 'rgba(255, 247, 235, 0.72)',
    padding: '28rpx 24rpx',
    margin: '0 0 20rpx',
    borderRadius: '24rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: 'none',
    fontSize: '32rpx',
    color: '#4c3424'
  },
  'location-loading-overlay': {
    background: 'rgba(73, 46, 23, 0.42)',
    cardBackground: 'linear-gradient(180deg, rgba(255, 249, 238, 0.98), rgba(246, 232, 208, 0.96))',
    borderRadius: '32rpx',
    boxShadow: '0 24rpx 60rpx rgba(73, 46, 23, 0.18)',
    color: '#4c3424',
    fontSize: '28rpx',
    lineHeight: '1.7'
  },
  'story-page-title': {
    text: '南头古城今天有点像在认真讲八卦',
    fontSize: '46rpx',
    color: '#412a1f',
    fontWeight: '600',
    lineHeight: '1.35',
    margin: '0 0 16rpx'
  },
  'story-summary': {
    text: '南头古城 · AI 生成',
    fontSize: '24rpx',
    color: '#8a725c',
    lineHeight: '1.6',
    textAlign: 'left',
    margin: '0 0 24rpx'
  },
  'story-content': {
    text: PAGE_SAMPLE_DATA.story.content,
    fontSize: '30rpx',
    color: '#4c3424',
    lineHeight: '2',
    textAlign: 'left',
    background: 'transparent',
    padding: '0',
    margin: '0',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontAssetId: ''
  },
  'story-favorite-button': {
    text: '收藏',
    fontSize: '32rpx',
    buttonTextColor: '#ffffff',
    fontWeight: '600',
    lineHeight: '96rpx',
    buttonBackground: 'linear-gradient(135deg, #9b6937, #6b4527)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    boxShadow: '0 14rpx 30rpx rgba(107, 69, 39, 0.2)',
    borderColor: 'transparent',
    borderWidth: '0',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'story-back-button': {
    text: '返回',
    fontSize: '32rpx',
    buttonTextColor: '#6b4527',
    fontWeight: '600',
    lineHeight: '96rpx',
    buttonBackground: 'rgba(255, 247, 235, 0.95)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    borderColor: 'rgba(140, 94, 52, 0.22)',
    borderWidth: '1rpx',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'publish-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'publish-page-title': {
    text: '投稿',
    fontSize: '56rpx',
    color: '#4a3419',
    fontWeight: '600',
    lineHeight: '1.25',
    margin: '0 0 12rpx'
  },
  'publish-location-selector': {
    text: '已选地点：南头古城',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    fontSize: '38rpx',
    color: '#4c3424',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'publish-title-input': {
    text: PAGE_SAMPLE_DATA.publish.title,
    fontSize: '32rpx',
    color: '#4c3424',
    lineHeight: '92rpx',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    background: 'rgba(255, 247, 235, 0.92)',
    padding: '0 24rpx',
    height: '92rpx',
    borderRadius: '22rpx',
    borderColor: 'rgba(140, 94, 52, 0.12)',
    borderWidth: '1rpx',
    boxShadow: 'inset 0 2rpx 10rpx rgba(140, 94, 52, 0.04)'
  },
  'publish-content-input': {
    text: PAGE_SAMPLE_DATA.publish.content,
    fontSize: '32rpx',
    color: '#4c3424',
    lineHeight: '1.8',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    background: 'rgba(255, 247, 235, 0.92)',
    padding: '24rpx',
    height: '280rpx',
    borderRadius: '22rpx',
    borderColor: 'rgba(140, 94, 52, 0.12)',
    borderWidth: '1rpx',
    boxShadow: 'inset 0 2rpx 10rpx rgba(140, 94, 52, 0.04)'
  },
  'publish-submit-button': {
    text: '提交投稿',
    fontSize: '32rpx',
    buttonTextColor: '#ffffff',
    fontWeight: '600',
    lineHeight: '96rpx',
    buttonBackground: 'linear-gradient(135deg, #9b6937, #6b4527)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    boxShadow: '0 14rpx 30rpx rgba(107, 69, 39, 0.2)',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'my-stories-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'my-stories-page-title': {
    text: '我的投稿',
    fontSize: '56rpx',
    color: '#4a3419',
    fontWeight: '600',
    lineHeight: '1.25',
    margin: '0 0 12rpx'
  },
  'my-story-card': {
    text: '我在古城门口听见了一句像留言的话',
    cardBackground: 'linear-gradient(180deg, rgba(255, 251, 244, 0.98), rgba(249, 240, 226, 0.94))',
    padding: '32rpx',
    margin: '0 0 28rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'my-stories-empty-state': {
    text: '你还没有投稿记录。',
    fontSize: '28rpx',
    color: '#6f5740',
    lineHeight: '1.7',
    textAlign: 'center',
    cardBackground: 'rgba(255, 250, 242, 0.92)',
    padding: '40rpx 32rpx',
    margin: '0',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'my-story-preview-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'my-story-preview-title': {
    text: '投稿预览',
    fontSize: '56rpx',
    color: '#4a3419',
    fontWeight: '600',
    lineHeight: '1.25',
    margin: '0 0 12rpx'
  },
  'my-story-preview-rejection': {
    text: PAGE_SAMPLE_DATA.myStoryPreview.rejectionReason,
    fontSize: '26rpx',
    color: '#8a4d4d',
    lineHeight: '1.7',
    background: 'rgba(169, 90, 90, 0.08)',
    padding: '18rpx 20rpx',
    margin: '0 0 24rpx',
    borderRadius: '20rpx',
    borderColor: 'rgba(169, 90, 90, 0.16)',
    borderWidth: '1rpx'
  },
  'my-story-preview-content': {
    cardBackground: 'linear-gradient(180deg, rgba(255, 251, 244, 0.98), rgba(249, 240, 226, 0.94))',
    padding: '32rpx',
    margin: '0 0 24rpx',
    borderRadius: '28rpx',
    cardBorderColor: 'rgba(140, 94, 52, 0.12)',
    cardShadow: '0 16rpx 40rpx rgba(108, 74, 45, 0.08)',
    fontSize: '30rpx',
    color: '#4c3424',
    lineHeight: '1.9',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'my-story-preview-edit-button': {
    text: '编辑',
    fontSize: '32rpx',
    buttonTextColor: '#ffffff',
    fontWeight: '600',
    lineHeight: '96rpx',
    buttonBackground: 'linear-gradient(135deg, #9b6937, #6b4527)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    boxShadow: '0 14rpx 30rpx rgba(107, 69, 39, 0.2)',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'my-story-preview-delete-button': {
    text: '删除投稿',
    fontSize: '32rpx',
    buttonTextColor: '#8a4d4d',
    fontWeight: '600',
    lineHeight: '96rpx',
    buttonBackground: 'rgba(169, 90, 90, 0.08)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    borderColor: 'rgba(169, 90, 90, 0.16)',
    borderWidth: '1rpx',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'my-story-edit-page-surface': {
    background: 'radial-gradient(circle at top, rgba(255, 248, 236, 0.98), rgba(239, 228, 210, 0.98) 48%, rgba(226, 207, 179, 0.98))',
    ...BACKGROUND_ASSET_DEFAULTS
  },
  'my-story-edit-title-input': {
    text: PAGE_SAMPLE_DATA.myStoryEdit.title,
    fontSize: '32rpx',
    color: '#4c3424',
    lineHeight: '92rpx',
    background: 'rgba(255, 247, 235, 0.92)',
    padding: '0 24rpx',
    height: '92rpx',
    borderRadius: '22rpx',
    borderColor: 'rgba(140, 94, 52, 0.12)',
    borderWidth: '1rpx',
    boxShadow: 'inset 0 2rpx 10rpx rgba(140, 94, 52, 0.04)'
  },
  'my-story-edit-content-input': {
    text: PAGE_SAMPLE_DATA.myStoryEdit.content,
    fontSize: '32rpx',
    color: '#4c3424',
    lineHeight: '1.8',
    background: 'rgba(255, 247, 235, 0.92)',
    padding: '24rpx',
    height: '320rpx',
    borderRadius: '22rpx',
    borderColor: 'rgba(140, 94, 52, 0.12)',
    borderWidth: '1rpx',
    boxShadow: 'inset 0 2rpx 10rpx rgba(140, 94, 52, 0.04)'
  },
  'my-story-edit-submit-button': {
    text: '提交修改',
    fontSize: '32rpx',
    buttonTextColor: '#ffffff',
    fontWeight: '600',
    lineHeight: '96rpx',
    buttonBackground: 'linear-gradient(135deg, #9b6937, #6b4527)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    boxShadow: '0 14rpx 30rpx rgba(107, 69, 39, 0.2)',
    ...BUTTON_IMAGE_DEFAULTS
  },
  'my-story-edit-cancel-button': {
    text: '返回',
    fontSize: '32rpx',
    buttonTextColor: '#6b4527',
    fontWeight: '600',
    lineHeight: '96rpx',
    buttonBackground: 'rgba(255, 247, 235, 0.92)',
    buttonRadius: '999rpx',
    buttonHeight: '96rpx',
    padding: '0 32rpx',
    margin: '0',
    borderColor: 'rgba(140, 94, 52, 0.22)',
    borderWidth: '1rpx',
    ...BUTTON_IMAGE_DEFAULTS
  }
};

export function getDefaultComponentState(designId) {
  return JSON.parse(JSON.stringify(COMPONENT_DEFAULTS[designId] || {}));
}

export function getDefaultValue(designId, propertyKey) {
  return COMPONENT_DEFAULTS[designId]?.[propertyKey];
}
