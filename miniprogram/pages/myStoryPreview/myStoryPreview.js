const storyService = require('../../services/storyService');

const DEFAULT_TIME_TEXT = '投稿时间：待补充';
const DEFAULT_EDIT_NOTICE = '修改已提交，审核通过后会展示。';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeQueryValue(value) {
  const rawValue = trimString(value);

  if (!rawValue) {
    return '';
  }

  try {
    return trimString(decodeURIComponent(rawValue));
  } catch (error) {
    return '';
  }
}

function getUserFacingErrorMessage(error) {
  const code = trimString(error && error.code);
  const message = trimString(error && error.message);

  if (code === 'DEPLOY_REQUIRED') {
    return '投稿详情服务尚未更新，请重新部署相关云函数。';
  }

  if (code === 'UNAUTHORIZED') {
    return '当前用户身份读取失败，请稍后再试。';
  }

  if (code === 'INVALID_INPUT') {
    return message || '缺少有效的投稿标识。';
  }

  if (
    code === 'STORY_NOT_FOUND'
    || code === 'FORBIDDEN'
    || code === 'CONTENT_NOT_AVAILABLE'
  ) {
    return message || '当前投稿暂不可查看。';
  }

  return message || '投稿详情读取失败，请稍后再试。';
}

function formatStoryTimeText(createdAt) {
  const formatted = storyService.formatStorySubmissionTime(createdAt);
  return formatted ? '投稿时间：' + formatted : DEFAULT_TIME_TEXT;
}

function getLocationAddress(story) {
  return trimString(story && story.placeSnapshot && story.placeSnapshot.address);
}

function normalizeStoryForDisplay(story) {
  const safeStory = story && typeof story === 'object' ? story : {};

  return Object.assign({}, safeStory, {
    createdAtText: formatStoryTimeText(safeStory.createdAt),
    locationAddress: getLocationAddress(safeStory),
    canEdit: storyService.canEditMyStory(safeStory.status),
  });
}

function consumePendingNotice(storyId) {
  const app = getApp();
  const notice = app && app.globalData ? app.globalData.pendingMyStoryPreviewNotice : null;

  if (
    !notice
    || trimString(notice.storyId) !== trimString(storyId)
    || !app
    || !app.globalData
  ) {
    return '';
  }

  app.globalData.pendingMyStoryPreviewNotice = null;
  return trimString(notice.message);
}

function redirectToMyStories() {
  return new Promise(function redirectPromise(resolve, reject) {
    wx.redirectTo({
      url: '/pages/myStories/myStories',
      success: resolve,
      fail: reject,
    });
  });
}

Page({
  data: {
    storyId: '',
    loading: true,
    errorMessage: '',
    noticeMessage: '',
    story: null,
  },

  onLoad(options) {
    const storyId = decodeQueryValue(options && options.storyId);
    const noticeMessage = decodeQueryValue(options && options.notice);

    this.setData({
      storyId: storyId,
      noticeMessage: noticeMessage,
    });

    if (!storyId) {
      this.setData({
        loading: false,
        errorMessage: '缺少有效的投稿标识。',
      });
      return;
    }

    this.loadStory();
  },

  onShow() {
    if (!this.data.storyId || !this.hasLoadedOnce) {
      return;
    }

    const pendingNotice = consumePendingNotice(this.data.storyId);
    if (pendingNotice) {
      this.setData({
        noticeMessage: pendingNotice,
      });
    }

    this.loadStory();
  },

  async loadStory() {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const story = normalizeStoryForDisplay(await storyService.getMyStoryById(this.data.storyId));
      this.hasLoadedOnce = true;

      this.setData({
        loading: false,
        story: story,
      });
    } catch (error) {
      this.hasLoadedOnce = true;
      this.setData({
        loading: false,
        story: null,
        errorMessage: getUserFacingErrorMessage(error),
      });
    }
  },

  openEditPage() {
    const story = this.data.story;
    const storyId = trimString(story && story.id);

    if (!story || !story.canEdit || !storyId) {
      wx.showToast({
        title: '当前状态暂不可编辑',
        icon: 'none',
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/myStoryEdit/myStoryEdit?storyId=' + encodeURIComponent(storyId),
    });
  },

  async goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        delta: 1,
      });
      return;
    }

    try {
      await redirectToMyStories();
    } catch (error) {
      wx.reLaunch({
        url: '/pages/myStories/myStories',
      });
    }
  },
});

if (typeof module !== 'undefined') {
  module.exports._private = {
    DEFAULT_EDIT_NOTICE: DEFAULT_EDIT_NOTICE,
    DEFAULT_TIME_TEXT: DEFAULT_TIME_TEXT,
    consumePendingNotice: consumePendingNotice,
    decodeQueryValue: decodeQueryValue,
    formatStoryTimeText: formatStoryTimeText,
    getLocationAddress: getLocationAddress,
    getUserFacingErrorMessage: getUserFacingErrorMessage,
    normalizeStoryForDisplay: normalizeStoryForDisplay,
  };
}
