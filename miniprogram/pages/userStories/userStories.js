const storyService = require('../../services/storyService');

function buildLocationContext(rawLocation) {
  const location = rawLocation || {};

  return {
    locationId: location.locationId || null,
    locationName: location.locationName || location.name || '',
    address: location.address || '',
    latitude: location.latitude,
    longitude: location.longitude,
    isTemporary: !!location.isTemporary,
    transientPlace: !!location.transientPlace,
  };
}

function getUserFacingErrorMessage(error) {
  const message = error && error.message ? String(error.message) : '';

  if (!message) {
    return '网友故事暂时不可用，请稍后再试。';
  }

  if (message.indexOf('locationId') !== -1 || message.indexOf('地点') !== -1) {
    return message;
  }

  return '网友故事暂时不可用，请稍后再试。';
}

Page({
  data: {
    locationContext: null,
    loading: true,
    errorMessage: '',
    stories: [],
    emptyStateMessage: '',
    submissionNotice: '',
  },

  onLoad() {
    const app = getApp();
    const pendingLocation = app && app.globalData ? app.globalData.pendingUserStoriesLocation : null;

    if (app && app.globalData) {
      app.globalData.pendingUserStoriesLocation = null;
    }

    if (!pendingLocation) {
      this.setData({
        loading: false,
        errorMessage: '当前地点上下文已失效，请重新从地点页进入。',
      });
      return;
    }

    this.setData({
      locationContext: buildLocationContext(pendingLocation),
    });

    this.loadUserStories();
  },

  onShow() {
    if (!this.data.locationContext) {
      return;
    }

    const app = getApp();
    const notice = app && app.globalData ? app.globalData.pendingUserStoriesSubmissionNotice : '';

    if (app && app.globalData) {
      app.globalData.pendingUserStoriesSubmissionNotice = '';
    }

    if (notice) {
      this.setData({
        submissionNotice: notice,
      });
    }

    this.loadUserStories();
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        delta: 1,
      });
      return;
    }

    wx.switchTab({
      url: '/pages/index/index',
    });
  },

  async loadUserStories() {
    const locationContext = this.data.locationContext;

    if (!locationContext) {
      return;
    }

    this.setData({
      loading: true,
      errorMessage: '',
    });

    if (locationContext.isTemporary || locationContext.transientPlace || !locationContext.locationId) {
      this.setData({
        loading: false,
        stories: [],
        emptyStateMessage: '这个地点还没有加入地点库，暂时不能投稿。',
      });
      return;
    }

    try {
      const stories = await storyService.listPublishedUserStoriesByLocation(locationContext.locationId);

      this.setData({
        loading: false,
        stories: stories,
        emptyStateMessage: stories.length > 0 ? '' : '暂时没有网友提供故事哦！',
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: getUserFacingErrorMessage(error),
      });
    }
  },

  handleShareStory() {
    const locationContext = this.data.locationContext;

    if (!locationContext) {
      wx.showToast({
        title: '地点信息暂时不可用',
        icon: 'none',
      });
      return;
    }

    if (locationContext.isTemporary || locationContext.transientPlace || !locationContext.locationId) {
      wx.showToast({
        title: '这个地点还没有加入地点库，暂时不能投稿。',
        icon: 'none',
      });
      return;
    }

    const app = getApp();

    if (app && app.globalData) {
      app.globalData.pendingPublishLocation = {
        locationId: locationContext.locationId,
        locationName: locationContext.locationName,
        address: locationContext.address || '',
        latitude: locationContext.latitude,
        longitude: locationContext.longitude,
      };
    }

    wx.navigateTo({
      url: '/pages/publish/publish?source=userStories',
    });
  },

  openStoryDetail(event) {
    const storyId = event.currentTarget.dataset.storyId;

    if (!storyId) {
      return;
    }

    wx.navigateTo({
      url: '/pages/story/story?storyId=' + storyId,
    });
  },
});
