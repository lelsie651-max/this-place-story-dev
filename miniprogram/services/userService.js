const { initCloud } = require('./cloud');

const CURRENT_USER = {
  openid: 'mock-user-001',
  nickname: '旅途观察员',
  avatarUrl: '',
  language: 'zh-CN',
  magnifyingGlass: 1,
  createdAt: '2026-10-12T10:10:00.000Z',
};

const ATLAS_ITEMS = [
  {
    id: 'exp-001',
    userId: CURRENT_USER.openid,
    locationId: 'loc-nantou',
    storyId: 'story-ai-nantou',
    type: 'AI说',
    createdAt: '2026-10-12T10:12:00.000Z',
    location: '深圳·南头古城',
    note: '从AI观察视角看到熟悉地点的另一面。',
  },
  {
    id: 'exp-002',
    userId: CURRENT_USER.openid,
    locationId: 'loc-xian-wall',
    storyId: 'story-folk-xian',
    type: '民间传说',
    createdAt: '2026-10-12T10:15:00.000Z',
    location: '西安城墙',
    note: '带一点时间感和地方记忆的故事卡片。',
  },
];

function cloneCurrentUser() {
  return Object.assign({}, CURRENT_USER);
}

function getCurrentUserProfile() {
  initCloud();
  return Promise.resolve(cloneCurrentUser());
}

function getAtlasItems() {
  initCloud();
  return Promise.resolve(ATLAS_ITEMS.slice());
}

function consumeMagnifyingGlass(amount) {
  initCloud();

  const consumeAmount = typeof amount === 'number' ? amount : 1;

  if (CURRENT_USER.magnifyingGlass < consumeAmount) {
    throw new Error('放大镜不足，暂时无法继续探索。');
  }

  CURRENT_USER.magnifyingGlass = CURRENT_USER.magnifyingGlass - consumeAmount;
  return Promise.resolve(cloneCurrentUser());
}

module.exports = {
  consumeMagnifyingGlass,
  getAtlasItems,
  getCurrentUserProfile,
};
