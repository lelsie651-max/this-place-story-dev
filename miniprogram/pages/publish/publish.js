const storyService = require('../../services/storyService');
const locationService = require('../../services/locationService');

const TITLE_MAX_LENGTH = 40;
const CONTENT_MAX_LENGTH = 2000;
const DEFAULT_SUBMIT_FAILURE_MESSAGE = '投稿提交失败，请稍后再试。';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getUserFacingErrorMessage(error) {
  const code = trimString(error && error.code);
  const message = trimString(error && error.message);

  if (code === 'DEPLOY_REQUIRED') {
    return '投稿服务尚未更新，请重新部署 submitStory 云函数。';
  }

  if (code === 'UNAUTHORIZED') {
    return '当前用户身份读取失败，请稍后再试。';
  }

  if (code === 'DATABASE_ERROR') {
    return '投稿写入失败，请稍后再试。';
  }

  if (!message) {
    return DEFAULT_SUBMIT_FAILURE_MESSAGE;
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

  return DEFAULT_SUBMIT_FAILURE_MESSAGE;
}

function encodeQueryValue(value) {
  return encodeURIComponent(trimString(value));
}

function buildPublishResultUrl(options) {
  const resultType = options && options.resultType === 'failure' ? 'failure' : 'success';
  const query = ['resultType=' + resultType];

  if (resultType === 'failure') {
    const failureReason = trimString(options && options.reason) || DEFAULT_SUBMIT_FAILURE_MESSAGE;
    query.push('reason=' + encodeQueryValue(failureReason));
  }

  return '/pages/publishResult/publishResult?' + query.join('&');
}

function redirectToPage(url) {
  return new Promise(function redirectPromise(resolve, reject) {
    wx.redirectTo({
      url: url,
      success: resolve,
      fail: reject,
    });
  });
}

function reLaunchToPage(url) {
  return new Promise(function relaunchPromise(resolve, reject) {
    wx.reLaunch({
      url: url,
      success: resolve,
      fail: reject,
    });
  });
}

async function goToPublishResult(options) {
  const url = buildPublishResultUrl(options);

  try {
    await redirectToPage(url);
  } catch (redirectError) {
    console.error('[publish] redirectTo publishResult failed', {
      message: redirectError && redirectError.message ? redirectError.message : '',
      resultType: options && options.resultType ? options.resultType : 'success',
    });
    await reLaunchToPage(url);
  }
}

Page({
  data: {
    locationId: null,
    locationName: '',
    locationAddress: '',
    latitude: null,
    longitude: null,
    isTemporary: false,
    placeSnapshot: null,
    storyTitle: '',
    storyContent: '',
    submitting: false,
    sourceFromLocation: false,
    entrySource: '',
  },

  onLoad(options) {
    this.consumePendingPublishLocation(options);
  },

  onShow() {
    this.consumePendingPublishLocation();
  },

  consumePendingPublishLocation(options) {
    const app = getApp();
    const pendingLocation = app && app.globalData ? app.globalData.pendingPublishLocation : null;

    if (app && app.globalData) {
      app.globalData.pendingPublishLocation = null;
    }

    if (pendingLocation) {
      this.setData({
        locationId: typeof pendingLocation.locationId === 'string' && pendingLocation.locationId.trim()
          ? pendingLocation.locationId.trim()
          : null,
        locationName: pendingLocation.locationName || '',
        locationAddress: pendingLocation.address || '',
        latitude: pendingLocation.latitude,
        longitude: pendingLocation.longitude,
        isTemporary: !!pendingLocation.isTemporary,
        placeSnapshot: pendingLocation.placeSnapshot || {
          name: pendingLocation.locationName || '',
          address: pendingLocation.address || '',
          latitude: pendingLocation.latitude,
          longitude: pendingLocation.longitude,
          poiid: '',
        },
        sourceFromLocation: trimString(pendingLocation.entrySource || pendingLocation.source) === 'userStories',
        entrySource: trimString(pendingLocation.entrySource || pendingLocation.source) || 'direct',
      });
      return;
    }

    if (options) {
      this.setData({
        sourceFromLocation: options.source === 'location',
        entrySource: options && options.source ? options.source : 'direct',
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

  async chooseLocation() {
    if (typeof wx === 'undefined' || typeof wx.chooseLocation !== 'function') {
      wx.showToast({
        title: '当前微信版本暂不支持地图选点',
        icon: 'none',
      });
      return;
    }

    if (this.choosingLocation) {
      return;
    }

    this.choosingLocation = true;

    wx.chooseLocation({
      success: async (result) => {
        try {
          const normalizedResult = locationService.normalizeSelectedPlace(result);

          if (!normalizedResult || normalizedResult.status !== 'valid' || !normalizedResult.selectedPlace) {
            wx.showToast({
              title: '当前地点信息无效，请重新选择',
              icon: 'none',
            });
            return;
          }

          const selectedPlace = normalizedResult.selectedPlace;
          const allLocations = await locationService.listLocations();
          const matchResult = locationService.matchSelectedPlaceToLocations(selectedPlace, allLocations || []);
          const matchedLocationId = matchResult && matchResult.status === 'matched' && matchResult.locationId
            ? matchResult.locationId
            : null;

          this.setData({
            locationId: matchedLocationId,
            locationName: selectedPlace.name || '',
            locationAddress: selectedPlace.address || '',
            latitude: selectedPlace.latitude,
            longitude: selectedPlace.longitude,
            isTemporary: !matchedLocationId,
            placeSnapshot: {
              name: selectedPlace.name || '',
              address: selectedPlace.address || '',
              latitude: selectedPlace.latitude,
              longitude: selectedPlace.longitude,
              poiid: selectedPlace.poiid || '',
            },
          });
        } catch (error) {
          wx.showToast({
            title: '地点选择失败，请稍后再试',
            icon: 'none',
          });
        }
      },
      fail: (error) => {
        const errorMessage = error && error.errMsg ? String(error.errMsg) : '';

        if (errorMessage.indexOf('cancel') !== -1) {
          if (!this.data.locationName) {
            wx.showToast({
              title: '请选择一个地点',
              icon: 'none',
            });
          }
          return;
        }

        wx.showToast({
          title: '地点选择失败，请稍后再试',
          icon: 'none',
        });
      },
      complete: () => {
        this.choosingLocation = false;
      },
    });
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

  async submitStory() {
    if (this.submitLock || this.data.submitting) {
      return;
    }

    const locationId = typeof this.data.locationId === 'string' && this.data.locationId.trim()
      ? this.data.locationId.trim()
      : null;
    const placeSnapshot = this.data.placeSnapshot;
    const isTemporary = !!this.data.isTemporary;
    const title = trimString(this.data.storyTitle);
    const content = trimString(this.data.storyContent);

    if (!placeSnapshot || !trimString(placeSnapshot.name)) {
      wx.showToast({
        title: '请选择一个地点',
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
        isTemporary: isTemporary,
        placeSnapshot: placeSnapshot,
        title: title,
        content: content,
      });

      const app = getApp();
      if (app && app.globalData) {
        app.globalData.pendingPublishLocation = null;
        if (this.data.entrySource === 'userStories') {
          app.globalData.pendingUserStoriesSubmissionNotice = result.message || '投稿已提交，审核通过后会展示。';
        } else {
          app.globalData.pendingUserStoriesSubmissionNotice = '';
        }
      }

      if (!result || !result.storyId) {
        throw new Error(DEFAULT_SUBMIT_FAILURE_MESSAGE);
      }

      await goToPublishResult({
        resultType: 'success',
      });
    } catch (error) {
      const safeReason = getUserFacingErrorMessage(error) || DEFAULT_SUBMIT_FAILURE_MESSAGE;

      console.error('[publish] submitStory failed', {
        code: error && error.code ? error.code : 'INTERNAL_ERROR',
        message: error && error.message ? error.message : '',
        safeReason: safeReason,
      });

      await goToPublishResult({
        resultType: 'failure',
        reason: safeReason,
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
    DEFAULT_SUBMIT_FAILURE_MESSAGE: DEFAULT_SUBMIT_FAILURE_MESSAGE,
    buildPublishResultUrl: buildPublishResultUrl,
    getUserFacingErrorMessage: getUserFacingErrorMessage,
    goToPublishResult: goToPublishResult,
  };
}
