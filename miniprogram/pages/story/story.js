const favoriteService = require('../../services/favoriteService');
const locationService = require('../../services/locationService');
const storyService = require('../../services/storyService');

const STORY_TYPE_LABELS = {
  ai_comment: 'AI说',
  'AI说': 'AI说',
  folk: '民间传说',
  '民间传说': '民间传说',
  traveler: '网友说',
  '网友说': '网友说',
};

const STORY_SOURCE_LABELS = {
  preset: '预设库',
  user: '网友投稿',
  deepseek: 'AI生成',
};

function isAiStoryType(story) {
  return !!story && (story.type === 'ai_comment' || story.type === 'AI说');
}

function formatLocationText(location) {
  if (!location) {
    return '地点信息暂不可用';
  }

  if (location.city) {
    return location.city + '·' + location.name;
  }

  return location.name;
}

function formatFallbackLocationText(story) {
  if (!story) {
    return '地点信息暂不可用';
  }

  if (story.locationAddress && story.locationName) {
    return story.locationName + ' · ' + story.locationAddress;
  }

  if (story.city && story.locationName) {
    return story.city + '·' + story.locationName;
  }

  return story.locationName || '地点信息暂不可用';
}

function getStorySourceLabel(story) {
  if (!story) {
    return '已收录内容';
  }

  if (STORY_SOURCE_LABELS[story.source]) {
    return STORY_SOURCE_LABELS[story.source];
  }

  if (story.source === 'ai_observer') {
    return 'AI生成';
  }

  if (story.source === 'folk_archive') {
    return '预设库';
  }

  if (story.type === 'traveler' || story.type === '网友说') {
    return '网友投稿';
  }

  if (story.type === 'ai_comment' || story.type === 'AI说' || story.type === '民间传说') {
    return 'AI生成';
  }

  if (story.type === 'folk') {
    return '预设库';
  }

  return '已收录内容';
}

function getStoryNote(story) {
  if (story && story.generated && (story.isTemporary || story.transientPlace)) {
    return '当前展示为本次选点生成的临时故事，仅供阅读参考，暂不支持收藏。';
  }

  if (story && story.generated) {
    return '当前展示为 AI 生成内容，仅供阅读参考，暂不支持收藏。';
  }

  if (story && story.source === 'deepseek') {
    return '当前展示为 AI 生成内容，仅供阅读参考。';
  }

  if (isAiStoryType(story)) {
    return '当前展示为 AI 说内容，仅供阅读参考。';
  }

  return '当前展示为已收录故事内容，仅供阅读参考。';
}

function getUserFacingStoryErrorMessage(error, fallbackMessage) {
  const rawMessage = error && error.message ? String(error.message) : '';

  if (!rawMessage) {
    return fallbackMessage;
  }

  if (
    rawMessage.indexOf('这个地点暂时还没有这种类型的已发布故事') !== -1 ||
    rawMessage.indexOf('该地点暂时还没有已发布故事') !== -1
  ) {
    return '这里暂时还没有可以阅读的故事。';
  }

  if (rawMessage.indexOf('No published story found') !== -1) {
    return '暂时还没有找到这一类故事。';
  }

  if (rawMessage.indexOf('does not exist') !== -1) {
    return '这篇故事暂时不可用。';
  }

  if (
    rawMessage.indexOf('CloudBase') !== -1 ||
    rawMessage.indexOf('database is unavailable') !== -1 ||
    rawMessage.indexOf('Failed to load') !== -1
  ) {
    return fallbackMessage;
  }

  return rawMessage;
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
    if (options && options.generatedStory === '1') {
      this.loadGeneratedStory();
      return;
    }

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
    const isTemporary = !!(story && (story.isTemporary || story.transientPlace));

    if (!isTemporary && story.locationId) {
      try {
        location = await locationService.getLocationById(story.locationId);
      } catch (locationError) {
        console.warn('Failed to load location for story:', locationError);
      }
    }

    return {
      currentStory: {
        id: story.id,
        locationId: story.locationId,
        title: story.title,
        type: story.type,
        typeLabel: STORY_TYPE_LABELS[story.type] || story.type,
        location: location ? formatLocationText(location) : formatFallbackLocationText(story),
        content: story.content,
        sourceLabel: getStorySourceLabel(story),
        note: getStoryNote(story),
        collectible: !story.generated && !isTemporary,
        generated: !!story.generated,
        isTemporary: isTemporary,
        transientPlace: isTemporary,
      },
      contentParagraphs: (story.content || '').split('\n\n'),
    };
  },

  loadGeneratedStory() {
    const app = getApp();
    const generatedStory = app && app.globalData ? app.globalData.pendingGeneratedStory : null;

    if (app && app.globalData) {
      app.globalData.pendingGeneratedStory = null;
    }

    if (!generatedStory) {
      this.setData({
        currentStory: null,
        contentParagraphs: [],
        loading: false,
        errorMessage: '刚生成的 AI 故事暂时不可用，请返回重试。',
        isFavorited: false,
      });
      return;
    }

    this.buildStoryViewData(generatedStory)
      .then((storyViewData) => {
        this.setData({
          currentStory: storyViewData.currentStory,
          contentParagraphs: storyViewData.contentParagraphs,
          loading: false,
          errorMessage: '',
          isFavorited: false,
        });
      })
      .catch(() => {
        this.setData({
          currentStory: null,
          contentParagraphs: [],
          loading: false,
          errorMessage: '刚生成的 AI 故事暂时不可用，请返回重试。',
          isFavorited: false,
        });
      });
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
        errorMessage: getUserFacingStoryErrorMessage(error, '故事加载失败，请稍后再试。'),
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
        errorMessage: getUserFacingStoryErrorMessage(error, '故事加载失败，请稍后再试。'),
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
        errorMessage: getUserFacingStoryErrorMessage(error, '故事加载失败，请稍后再试。'),
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

    if (currentStory.collectible === false) {
      wx.showToast({
        title: '当前 AI 生成故事暂不支持收藏',
        icon: 'none',
      });
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
