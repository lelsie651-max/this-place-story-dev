const storyService = require('../../services/storyService');

const TITLE_MAX_LENGTH = 40;
const CONTENT_MAX_LENGTH = 2000;
const DEFAULT_SUCCESS_MESSAGE = '修改已提交，审核通过后会展示。';

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
    return '投稿编辑服务尚未更新，请重新部署相关云函数。';
  }

  if (code === 'UNAUTHORIZED') {
    return '当前用户身份读取失败，请稍后再试。';
  }

  if (
    code === 'INVALID_INPUT'
    || code === 'STATUS_NOT_EDITABLE'
    || code === 'FORBIDDEN'
    || code === 'STORY_NOT_FOUND'
  ) {
    return message || '当前投稿暂不支持编辑。';
  }

  if (code === 'DATABASE_ERROR') {
    return '投稿写入失败，请稍后再试。';
  }

  return message || '投稿修改失败，请稍后再试。';
}

function buildPreviewUrl(storyId, noticeMessage) {
  const query = ['storyId=' + encodeURIComponent(trimString(storyId))];
  const safeNotice = trimString(noticeMessage);

  if (safeNotice) {
    query.push('notice=' + encodeURIComponent(safeNotice));
  }

  return '/pages/myStoryPreview/myStoryPreview?' + query.join('&');
}

function canEditStory(story) {
  return !!(story && storyService.canEditMyStory(story.status));
}

function createLoadViewModel(story) {
  const safeStory = story && typeof story === 'object' ? story : {};

  return {
    story: safeStory,
    storyTitle: safeStory.title || '',
    storyContent: safeStory.content || '',
    locationName: safeStory.locationName || '',
    locationAddress: trimString(safeStory && safeStory.placeSnapshot && safeStory.placeSnapshot.address),
  };
}

function validateForm(title, content) {
  const normalizedTitle = trimString(title);
  const normalizedContent = trimString(content);

  if (!normalizedTitle) {
    return '请输入故事标题。';
  }

  if (!normalizedContent) {
    return '请输入故事正文。';
  }

  if (normalizedTitle.length > TITLE_MAX_LENGTH) {
    return '标题请控制在 40 字以内。';
  }

  if (normalizedContent.length > CONTENT_MAX_LENGTH) {
    return '正文请控制在 2000 字以内。';
  }

  return '';
}

function redirectToPreview(storyId, noticeMessage) {
  return new Promise(function redirectPromise(resolve, reject) {
    wx.redirectTo({
      url: buildPreviewUrl(storyId, noticeMessage),
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
    story: null,
    storyTitle: '',
    storyContent: '',
    locationName: '',
    locationAddress: '',
    submitting: false,
  },

  onLoad(options) {
    const storyId = decodeQueryValue(options && options.storyId);

    this.setData({
      storyId: storyId,
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

  async loadStory() {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const story = await storyService.getMyStoryById(this.data.storyId);

      if (!canEditStory(story)) {
        wx.showToast({
          title: '当前状态暂不可编辑',
          icon: 'none',
        });
        await redirectToPreview(this.data.storyId);
        return;
      }

      this.setData(Object.assign({
        loading: false,
      }, createLoadViewModel(story)));
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: getUserFacingErrorMessage(error),
      });
    }
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

  async cancelEdit() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        delta: 1,
      });
      return;
    }

    try {
      await redirectToPreview(this.data.storyId);
    } catch (error) {
      wx.reLaunch({
        url: buildPreviewUrl(this.data.storyId),
      });
    }
  },

  async submitEdit() {
    if (this.submitLock || this.data.submitting) {
      return;
    }

    const validationMessage = validateForm(this.data.storyTitle, this.data.storyContent);

    if (validationMessage) {
      wx.showToast({
        title: validationMessage,
        icon: 'none',
      });
      return;
    }

    this.submitLock = true;
    this.setData({
      submitting: true,
      storyTitle: trimString(this.data.storyTitle),
      storyContent: trimString(this.data.storyContent),
    });

    try {
      const result = await storyService.updateTravelerStory({
        storyId: this.data.storyId,
        title: this.data.storyTitle,
        content: this.data.storyContent,
      });
      const message = trimString(result && result.message) || DEFAULT_SUCCESS_MESSAGE;
      const app = getApp();

      if (app && app.globalData) {
        app.globalData.pendingMyStoryPreviewNotice = {
          storyId: this.data.storyId,
          message: message,
        };
      }

      if (getCurrentPages().length > 1) {
        wx.navigateBack({
          delta: 1,
        });
        return;
      }

      await redirectToPreview(this.data.storyId, message);
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

if (typeof module !== 'undefined') {
  module.exports._private = {
    CONTENT_MAX_LENGTH: CONTENT_MAX_LENGTH,
    DEFAULT_SUCCESS_MESSAGE: DEFAULT_SUCCESS_MESSAGE,
    TITLE_MAX_LENGTH: TITLE_MAX_LENGTH,
    buildPreviewUrl: buildPreviewUrl,
    canEditStory: canEditStory,
    createLoadViewModel: createLoadViewModel,
    decodeQueryValue: decodeQueryValue,
    getUserFacingErrorMessage: getUserFacingErrorMessage,
    validateForm: validateForm,
  };
}
