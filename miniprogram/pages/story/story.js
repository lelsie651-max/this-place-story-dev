const favoriteService = require('../../services/favoriteService');
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
    isFavorited: false,
    favoriteSubmitting: false,
  },

  onLoad(options) {
    if (options && options.storyId) {
      this.loadStoryById(options.storyId);
      return;
    }

    if (options && options.locationId) {
      this.loadStoryByLocationId(options.locationId);
      return;
    }

    if (options && options.type) {
      this.loadStoryByType(options.type);
      return;
    }

    this.loadStoryByType('ai_comment');
  },

  async buildStoryViewData(story) {
    let location = null;

    try {
      location = await locationService.getLocationById(story.locationId);
    } catch (locationError) {
      console.warn('Failed to load location for story:', locationError);
    }

    return {
      currentStory: {
        id: story.id,
        locationId: story.locationId,
        title: story.title,
        type: story.type,
        typeLabel: STORY_TYPE_LABELS[story.type] || story.type,
        location: formatLocationText(location),
        content: story.content,
        source: story.source,
      },
      contentParagraphs: (story.content || '').split('\n\n'),
    };
  },

  async loadStoryByType(storyType) {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const story = await storyService.getStoryByType(storyType);
      const storyViewData = await this.buildStoryViewData(story);

      this.setData({
        currentStory: storyViewData.currentStory,
        contentParagraphs: storyViewData.contentParagraphs,
        loading: false,
      });

      await this.loadFavoriteStatus(story.id);
    } catch (error) {
      this.setData({
        currentStory: null,
        contentParagraphs: [],
        loading: false,
        errorMessage: error.message || '故事加载失败，请稍后再试。',
      });
    }
  },

  async loadStoryById(storyId) {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const story = await storyService.getStoryById(storyId);
      const storyViewData = await this.buildStoryViewData(story);

      this.setData({
        currentStory: storyViewData.currentStory,
        contentParagraphs: storyViewData.contentParagraphs,
        loading: false,
      });

      await this.loadFavoriteStatus(story.id);
    } catch (error) {
      this.setData({
        currentStory: null,
        contentParagraphs: [],
        loading: false,
        errorMessage: error.message || '故事加载失败，请稍后再试。',
      });
    }
  },

  async loadStoryByLocationId(locationId) {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const stories = await storyService.listStoriesByLocation(locationId);

      if (!stories || stories.length === 0) {
        throw new Error('该地点暂时还没有已发布故事。');
      }

      const story = stories[0];
      const storyViewData = await this.buildStoryViewData(story);

      this.setData({
        currentStory: storyViewData.currentStory,
        contentParagraphs: storyViewData.contentParagraphs,
        loading: false,
      });

      await this.loadFavoriteStatus(story.id);
    } catch (error) {
      this.setData({
        currentStory: null,
        contentParagraphs: [],
        loading: false,
        errorMessage: error.message || '故事加载失败，请稍后再试。',
      });
    }
  },

  async loadFavoriteStatus(storyId) {
    try {
      const isFavorited = await favoriteService.checkFavorite(storyId, favoriteService.TEST_USER_ID);

      this.setData({
        isFavorited: isFavorited,
      });
    } catch (error) {
      console.warn('Failed to load favorite status:', error);
      this.setData({
        isFavorited: false,
      });
    }
  },

  async handleCollect() {
    const currentStory = this.data.currentStory;

    if (!currentStory || this.data.favoriteSubmitting) {
      return;
    }

    this.setData({
      favoriteSubmitting: true,
    });

    try {
      if (this.data.isFavorited) {
        await favoriteService.removeFavorite(currentStory.id, favoriteService.TEST_USER_ID);
        this.setData({
          isFavorited: false,
        });

        wx.showToast({
          title: '已取消收藏',
          icon: 'none',
        });
      } else {
        await favoriteService.addFavorite({
          userId: favoriteService.TEST_USER_ID,
          storyId: currentStory.id,
          locationId: currentStory.locationId,
        });

        this.setData({
          isFavorited: true,
        });

        wx.showToast({
          title: '已加入收藏',
          icon: 'none',
        });
      }
    } catch (error) {
      wx.showToast({
        title: error.message || '收藏操作失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        favoriteSubmitting: false,
      });
    }
  },

  backToHome() {
    const pages = getCurrentPages();

    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }

    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
});
