const storyService = require('../../services/storyService');

const TITLE_MAX_LENGTH = 40;
const CONTENT_MAX_LENGTH = 2000;

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getUserFacingErrorMessage(error) {
  const message = trimString(error && error.message);

  if (!message) {
    return '投稿提交失败，请稍后再试。';
  }

  if (message.indexOf('locationId') !== -1 || message.indexOf('地点') !== -1) {
    return message;
  }

  if (
    message.indexOf('标题') !== -1
    || message.indexOf('正文') !== -1
    || message.indexOf('提交') !== -1
    || message.indexOf('审核') !== -1
  ) {
    return message;
  }

  return '投稿提交失败，请稍后再试。';
}

Page({
  data: {
    locationId: '',
    locationName: '',
    locationAddress: '',
    latitude: null,
    longitude: null,
    storyTitle: '',
    storyContent: '',
    submitting: false,
    sourceFromLocation: false,
  },

  onLoad(options) {
    const app = getApp();
    const pendingLocation = app && app.globalData ? app.globalData.pendingPublishLocation : null;

    if (app && app.globalData) {
      app.globalData.pendingPublishLocation = null;
    }

    if (pendingLocation && pendingLocation.locationId) {
      this.setData({
        locationId: pendingLocation.locationId,
        locationName: pendingLocation.locationName || '',
        locationAddress: pendingLocation.address || '',
        latitude: pendingLocation.latitude,
        longitude: pendingLocation.longitude,
        sourceFromLocation: true,
      });
      return;
    }

    this.setData({
      sourceFromLocation: options && options.source === 'location',
    });
  },

  onTitleInput(event) {
    this.setData({
      storyTitle: event.detail.value,
    });
  },

  onContentInput(event) {
    this.setData({
      storyContent: event.detail.value,
    });
  },

  chooseLocation() {
    wx.showToast({
      title: '请先从地点页进入投稿。',
      icon: 'none',
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
    });
  },

  async submitStory() {
    if (this.submitLock || this.data.submitting) {
      return;
    }

    const locationId = trimString(this.data.locationId);
    const title = trimString(this.data.storyTitle);
    const content = trimString(this.data.storyContent);

    if (!locationId) {
      wx.showToast({
        title: '请先从地点页进入投稿。',
        icon: 'none',
      });
      return;
    }

    if (!title) {
      wx.showToast({
        title: '请输入故事标题。',
        icon: 'none',
      });
      return;
    }

    if (!content) {
      wx.showToast({
        title: '请输入故事正文。',
        icon: 'none',
      });
      return;
    }

    if (title.length > TITLE_MAX_LENGTH) {
      wx.showToast({
        title: '标题请控制在 40 字以内。',
        icon: 'none',
      });
      return;
    }

    if (content.length > CONTENT_MAX_LENGTH) {
      wx.showToast({
        title: '正文请控制在 2000 字以内。',
        icon: 'none',
      });
      return;
    }

    this.submitLock = true;
    this.setData({
      submitting: true,
      storyTitle: title,
      storyContent: content,
    });

    try {
      const result = await storyService.submitTravelerStory({
        locationId: locationId,
        title: title,
        content: content,
      });

      wx.showToast({
        title: result.message || '投稿已提交，审核通过后会展示。',
        icon: 'none',
      });

      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
        });
      }, 600);
    } catch (error) {
      wx.showToast({
        title: getUserFacingErrorMessage(error),
        icon: 'none',
      });
    } finally {
      this.submitLock = false;
      this.setData({
        submitting: false,
      });
    }
  },
});
