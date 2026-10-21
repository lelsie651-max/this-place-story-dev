const locationService = require('../../services/locationService');
const storyService = require('../../services/storyService');

const RECOMMENDATION_LABEL = '编辑推荐';
const RECOMMENDATION_EMPTY_TEXT = '推荐内容正在整理中';
const RECOMMENDATION_FALLBACK_LOCATION = '地点信息整理中';
const RECOMMENDATION_ACTION_TEXT = '免费阅读';
const MAX_RECOMMENDATIONS = 3;
const RECOMMENDATION_STORIES = [
  {
    storyId: 'story_nantou_folk_01',
    label: RECOMMENDATION_LABEL,
    coverImage: '',
    displayTitle: '古城灯火的回路',
    displaySummary: '有人说，夜里最后一盏灯亮起时，老城会把旧故事慢慢讲给路人听。',
    locationName: '南头古城',
  },
  {
    storyId: 'story_1792508501250_ea2612736d0e',
    label: RECOMMENDATION_LABEL,
    coverImage: '',
    displayTitle: '展柜前忽然安静的那三秒',
    displaySummary: '一块小残件，让人群在展柜前齐齐停住，然后一起抬头去看屋檐。',
    locationName: '陈家祠',
  },
  {
    storyId: 'story_1792510928050_769fcbcc41dc',
    label: RECOMMENDATION_LABEL,
    coverImage: '',
    displayTitle: '断桥广播的第五次重复',
    displaySummary: '广播刚提醒完，人群又回到桥中央，像被同一个念头轻轻拽了一下。',
    locationName: '西湖断桥',
  },
];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRecommendationConfig(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const storyId = trimString(item.storyId);

  if (!storyId) {
    return null;
  }

  return {
    storyId: storyId,
    label: trimString(item.label) || RECOMMENDATION_LABEL,
    coverImage: trimString(item.coverImage),
    displayTitle: trimString(item.displayTitle),
    displaySummary: trimString(item.displaySummary),
    locationName: trimString(item.locationName),
  };
}

function getRecommendationConfigs() {
  return RECOMMENDATION_STORIES
    .slice(0, MAX_RECOMMENDATIONS)
    .map(normalizeRecommendationConfig)
    .filter(Boolean);
}

function buildLocationText(location) {
  if (!location || typeof location !== 'object') {
    return '';
  }

  const name = trimString(location.name);
  const city = trimString(location.city);

  if (!name) {
    return '';
  }

  return city ? city + '·' + name : name;
}

async function resolveLocationName(story, fallbackLocationName) {
  const normalizedFallback = trimString(fallbackLocationName);

  if (!story || !trimString(story.locationId) || story.isTemporary) {
    return normalizedFallback;
  }

  try {
    const location = await locationService.getLocationById(story.locationId);
    const locationText = buildLocationText(location);
    return locationText || normalizedFallback;
  } catch (error) {
    return normalizedFallback;
  }
}

async function buildRecommendationCard(config) {
  const story = await storyService.getStoryById(config.storyId);
  const locationName = await resolveLocationName(story, config.locationName);
  const title = trimString(config.displayTitle) || trimString(story && story.title);
  const summary = trimString(config.displaySummary)
    || trimString(story && story.summary)
    || trimString(story && story.content);

  if (!title || !summary) {
    return null;
  }

  return {
    storyId: config.storyId,
    label: config.label,
    coverImage: config.coverImage,
    displayTitle: title,
    displaySummary: summary,
    locationName: locationName || RECOMMENDATION_FALLBACK_LOCATION,
    actionText: RECOMMENDATION_ACTION_TEXT,
  };
}

async function loadRecommendationCards(configList) {
  const normalizedConfigs = Array.isArray(configList) ? configList : [];
  const results = await Promise.all(normalizedConfigs.map(async function loadSingleRecommendation(config) {
    try {
      return await buildRecommendationCard(config);
    } catch (error) {
      return null;
    }
  }));

  return results.filter(Boolean);
}

function buildRecommendationUrl(storyId) {
  return '/pages/story/story?storyId=' + encodeURIComponent(storyId) + '&entry=recommendation';
}

Page({
  data: {
    recommendationCards: [],
    recommendationLoading: true,
    recommendationEmptyText: RECOMMENDATION_EMPTY_TEXT,
  },

  onLoad() {
    this.loadRecommendations();
  },

  async loadRecommendations() {
    if (this._loadingRecommendations) {
      return;
    }

    this._loadingRecommendations = true;
    this.setData({
      recommendationLoading: true,
    });

    try {
      const cards = await loadRecommendationCards(getRecommendationConfigs());
      this.setData({
        recommendationCards: cards,
        recommendationLoading: false,
      });
    } catch (error) {
      this.setData({
        recommendationCards: [],
        recommendationLoading: false,
      });
    } finally {
      this._loadingRecommendations = false;
    }
  },

  goToExplore() {
    wx.navigateTo({
      url: '/pages/discovery/discovery',
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile',
    });
  },

  goToPublish() {
    wx.navigateTo({
      url: '/pages/publish/publish',
    });
  },

  goToRecommendation(event) {
    const storyId = trimString(event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.storyId
      : '');

    if (!storyId) {
      return;
    }

    wx.navigateTo({
      url: buildRecommendationUrl(storyId),
    });
  },
});

module.exports = {
  RECOMMENDATION_STORIES,
  _private: {
    MAX_RECOMMENDATIONS: MAX_RECOMMENDATIONS,
    buildRecommendationCard: buildRecommendationCard,
    buildRecommendationUrl: buildRecommendationUrl,
    getRecommendationConfigs: getRecommendationConfigs,
    loadRecommendationCards: loadRecommendationCards,
    normalizeRecommendationConfig: normalizeRecommendationConfig,
    resolveLocationName: resolveLocationName,
    trimString: trimString,
  },
};
