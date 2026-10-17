const storyService = require('../../services/storyService');

function getUserFacingErrorMessage(error) {
  const code = error && error.code ? String(error.code) : '';
  const message = error && error.message ? String(error.message) : '';

  if (code === 'DEPLOY_REQUIRED') {
    return '投稿记录服务尚未更新，请重新部署 getMyStories 云函数。';
  }

  if (code === 'UNAUTHORIZED') {
    return '当前用户身份读取失败，请稍后再试。';
  }

  if (message) {
    return message;
  }

  return '投稿记录读取失败，请稍后再试。';
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    stories: [],
  },

  onShow() {
    this.loadMyStories();
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

  async loadMyStories() {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const stories = await storyService.getMyStories();

      this.setData({
        loading: false,
        stories: stories,
      });
    } catch (error) {
      console.error('[myStories] getMyStories failed', {
        code: error && error.code ? error.code : 'INTERNAL_ERROR',
        message: error && error.message ? error.message : '',
      });
      this.setData({
        loading: false,
        errorMessage: getUserFacingErrorMessage(error),
      });
    }
  },
});
