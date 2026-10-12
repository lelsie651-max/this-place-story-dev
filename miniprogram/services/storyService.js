const { initCloud } = require('./cloud');

const STORY_LIST = [
  {
    id: 'story-ai-nantou',
    locationId: 'loc-nantou',
    type: 'ai_comment',
    title: 'AI观察报告：人类为什么喜欢拍照？',
    content:
      '作为一名驻扎在南头古城的AI观察员，\n我发现了一件有趣的事情。\n\n人类来到古老建筑前，\n第一反应通常不是研究历史，\n而是寻找一个最佳角度证明自己来过。\n\n这是一种非常特别的人类行为。',
    source: 'ai',
    language: 'zh-CN',
    authorId: 'system',
    status: 'published',
    createdAt: '2026-10-12T10:00:00.000Z',
    location: '深圳·南头古城',
  },
  {
    id: 'story-folk-xian',
    locationId: 'loc-xian-wall',
    type: 'folk',
    title: '城门边的灯，总替晚归的人亮着',
    content:
      '老一辈常说，夜色落在城墙上以后，\n总会有一盏灯替晚归的人多亮一会儿。\n\n它照的不是路，\n而是提醒每一个走远的人，\n总还有一个地方在等你回来。',
    source: 'folk',
    language: 'zh-CN',
    authorId: 'system',
    status: 'published',
    createdAt: '2026-10-12T10:05:00.000Z',
    location: '西安·城墙',
  },
];

function getDefaultStory() {
  return STORY_LIST[0];
}

function listStories() {
  initCloud();
  return Promise.resolve(STORY_LIST.slice());
}

function getStoryByType(type) {
  initCloud();
  const story = STORY_LIST.find(function findItem(item) {
    return item.type === type;
  });

  return Promise.resolve(story || getDefaultStory());
}

function getStoryById(storyId) {
  initCloud();
  const story = STORY_LIST.find(function findItem(item) {
    return item.id === storyId;
  });

  return Promise.resolve(story || null);
}

function listStoriesByLocation(locationId) {
  initCloud();
  const stories = STORY_LIST.filter(function filterItem(item) {
    return item.locationId === locationId;
  });

  return Promise.resolve(stories);
}

module.exports = {
  getDefaultStory,
  getStoryById,
  getStoryByType,
  listStories,
  listStoriesByLocation,
};
