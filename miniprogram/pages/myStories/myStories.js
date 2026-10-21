const storyService = require('../../services/storyService');

const DEFAULT_CREATED_TIME_TEXT = '投稿时间：待补充';
const DEFAULT_UPDATED_TIME_TEXT = '最近修改时间：待补充';

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

function formatStoryTimeText(story) {
  const safeStory = story && typeof story === 'object' ? story : {};
  const hasUpdatedAt = typeof safeStory.updatedAt !== 'undefined'
    && safeStory.updatedAt !== null
    && safeStory.updatedAt !== '';
  const formatted = storyService.formatStorySubmissionTime(safeStory);

  if (formatted) {
    return (hasUpdatedAt ? '最近修改时间：' : '投稿时间：') + formatted;
  }

  return hasUpdatedAt ? DEFAULT_UPDATED_TIME_TEXT : DEFAULT_CREATED_TIME_TEXT;
}

function normalizeStoriesForDisplay(stories) {
  return (Array.isArray(stories) ? stories : []).map(function mapStory(story) {
    return Object.assign({}, story, {
      createdAtText: formatStoryTimeText(story),
    });
  });
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

  async loadMyStories() {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const stories = normalizeStoriesForDisplay(await storyService.getMyStories());

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

  openStoryPreview(event) {
    const storyId = event && event.currentTarget && event.currentTarget.dataset
      ? String(event.currentTarget.dataset.storyId || '').trim()
      : '';

    if (!storyId) {
      wx.showToast({
        title: '当前投稿缺少有效标识',
        icon: 'none',
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/myStoryPreview/myStoryPreview?storyId=' + encodeURIComponent(storyId),
    });
  },
});

if (typeof module !== 'undefined') {
  module.exports._private = {
    DEFAULT_CREATED_TIME_TEXT: DEFAULT_CREATED_TIME_TEXT,
    DEFAULT_UPDATED_TIME_TEXT: DEFAULT_UPDATED_TIME_TEXT,
    formatStoryTimeText: formatStoryTimeText,
    getUserFacingErrorMessage: getUserFacingErrorMessage,
    normalizeStoriesForDisplay: normalizeStoriesForDisplay,
  };
}
