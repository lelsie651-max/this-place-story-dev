const locationService = require('../../services/locationService');
const storyService = require('../../services/storyService');
const userService = require('../../services/userService');

const STORY_TYPES = [
  {
    key: 'folk',
    title: '民间传说',
    description: '听听流传在当地的人间故事。',
    enabled: true,
  },
  {
    key: 'ai_comment',
    title: 'AI说',
    description: '让AI成为这里的观察者，用另一种视角讲述地点。',
    enabled: true,
    featured: true,
  },
  {
    key: 'traveler',
    title: '网友说',
    description: '看看其他旅人的真实分享。',
    enabled: false,
    statusText: '即将开放',
  },
];

function formatCityText(location) {
  const primary = [location.city, location.province].filter(Boolean).join(' · ');

  if (primary) {
    return primary;
  }

  return location.country || '城市信息待补充';
}

function formatLocationIntro(location) {
  if (location.intro) {
    return location.intro;
  }

  if (location.description) {
    return location.description;
  }

  if (location.tags && location.tags.length > 0) {
    return '这里留下的线索包括：' + location.tags.join('、') + '。';
  }

  if (location.level) {
    return '地点类型：' + location.level + '。';
  }

  return '这个地点的简介还在整理中，先看看这里已经公开的故事。';
}

function formatHeroIntro(location) {
  const intro = formatLocationIntro(location);

  if (intro.length <= 28) {
    return intro;
  }

  return intro.slice(0, 28) + '...';
}

function formatTags(location) {
  if (location.tags && location.tags.length > 0) {
    return location.tags.join(' / ');
  }

  if (location.level) {
    return location.level;
  }

  return '地点线索整理中';
}

function createStoryModes() {
  return STORY_TYPES.map(function cloneStoryMode(mode) {
    return Object.assign({}, mode);
  });
}

Page({
  data: {
    locationDetail: null,
    storyModes: createStoryModes(),
    loading: true,
    errorMessage: '',
    remainingMagnifyingGlass: 0,
    requesting: false,
    requestingTypeLabel: '',
  },

  onLoad(options) {
    if (!options || !options.locationId) {
      this.setData({
        loading: false,
        errorMessage: '缺少地点参数，暂时无法查看地点详情。',
      });
      return;
    }

    this.loadLocationDetail(options.locationId);
  },

  onShow() {
    this.loadMagnifyingGlassCount();
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
    });
  },

  async loadMagnifyingGlassCount() {
    try {
      const profile = await userService.getCurrentUserProfile();

      this.setData({
        remainingMagnifyingGlass: profile.magnifyingGlass || 0,
      });
    } catch (error) {
      console.warn('Failed to load magnifyingGlass count:', error);
    }
  },

  async loadLocationDetail(locationId) {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const location = await locationService.getLocationById(locationId);

      if (!location) {
        throw new Error('该地点不存在，或暂时无法读取。');
      }

      const stories = await locationService.getStoriesByLocationId(locationId);
      const profile = await userService.getCurrentUserProfile();

      this.setData({
        locationDetail: {
          id: location.id,
          name: location.name || '未命名地点',
          cityText: formatCityText(location),
          intro: formatLocationIntro(location),
          heroIntro: formatHeroIntro(location),
          tagsText: formatTags(location),
          storyCount: stories.length,
        },
        storyModes: createStoryModes(),
        remainingMagnifyingGlass: profile.magnifyingGlass || 0,
        loading: false,
      });
    } catch (error) {
      this.setData({
        locationDetail: null,
        storyModes: createStoryModes(),
        loading: false,
        errorMessage: error.message || '地点详情加载失败，请稍后再试。',
      });
    }
  },

  async handleSelectStoryType(event) {
    const { type, enabled, label } = event.currentTarget.dataset;

    if (!type || enabled === false || enabled === 'false') {
      wx.showToast({
        title: '即将开放',
        icon: 'none',
      });
      return;
    }

    if (this.requestLock || !this.data.locationDetail) {
      return;
    }

    this.requestLock = true;

    this.setData({
      requesting: true,
      requestingTypeLabel: label || '故事',
    });

    try {
      const story = await storyService.getRandomStoryByLocationAndType(this.data.locationDetail.id, type);
      const profile = await userService.getCurrentUserProfile();

      if (!profile || (profile.magnifyingGlass || 0) < 1) {
        throw new Error('放大镜不足，暂时无法继续探索。');
      }

      const updatedProfile = await userService.consumeMagnifyingGlass(1);

      this.setData({
        remainingMagnifyingGlass: updatedProfile.magnifyingGlass || 0,
      });

      await new Promise(function navigateToStory(resolve, reject) {
        wx.navigateTo({
          url: '/pages/story/story?storyId=' + story.id,
          success: resolve,
          fail: reject,
        });
      });
    } catch (error) {
      const rawMessage = error && error.message ? error.message : '';
      const message = rawMessage.replace(/^Failed to load story by location and type from CloudBase:\s*/, '');

      wx.showToast({
        title: message || '故事探索失败，请稍后再试。',
        icon: 'none',
      });
    } finally {
      this.requestLock = false;
      this.setData({
        requesting: false,
        requestingTypeLabel: '',
      });
    }
  },
});
