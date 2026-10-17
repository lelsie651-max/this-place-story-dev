const storyService = require('../../services/storyService');
const locationService = require('../../services/locationService');

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
        sourceFromLocation: !!(options && options.source),
        entrySource: options && options.source ? options.source : 'direct',
      });
      return;
    }

    this.setData({
      sourceFromLocation: options && options.source === 'location',
      entrySource: options && options.source ? options.source : 'direct',
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

      wx.showToast({
        title: result.message || '投稿已提交，审核通过后会展示。',
        icon: 'none',
      });

      setTimeout(() => {
        this.setData({
          entrySource: '',
        });
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
