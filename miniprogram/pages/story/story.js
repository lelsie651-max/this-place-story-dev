const locationService = require('../../services/locationService');
const storyService = require('../../services/storyService');

const STORY_TYPE_LABELS = {
  ai_comment: 'AI说',
  folk: '民间传说',
  traveler: '网友说',
};

function formatLocationText(location) {
  if (!location) {
    return '地点信息暂不可用';
  }

  if (location.city) {
    return location.city + '·' + location.name;
  }

  return location.name;
}

Page({
  data: {
    currentStory: null,
    contentParagraphs: [],
    loading: true,
    errorMessage: '',
  },

  onLoad(options) {
    const storyType = (options && options.type) || 'ai_comment';

    this.loadStory(storyType);
  },

  async loadStory(storyType) {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const story = await storyService.getStoryByType(storyType);
      let location = null;

      try {
        location = await locationService.getLocationById(story.locationId);
      } catch (locationError) {
        console.warn('Failed to load location for story:', locationError);
      }

      this.setData({
        currentStory: {
          id: story.id,
          title: story.title,
          type: story.type,
          typeLabel: STORY_TYPE_LABELS[story.type] || story.type,
          location: formatLocationText(location),
          content: story.content,
          source: story.source,
        },
        contentParagraphs: (story.content || '').split('\n\n'),
        loading: false,
      });
    } catch (error) {
      this.setData({
        currentStory: null,
        contentParagraphs: [],
        loading: false,
        errorMessage: error.message || '故事加载失败，请稍后再试。',
      });
    }
  },

  handleCollect() {
    wx.showToast({
      title: '已加入收藏占位',
      icon: 'none',
    });
  },

  backToHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
});
