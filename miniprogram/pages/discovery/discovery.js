const locationService = require('../../services/locationService');

const NEW_LOCATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function formatLocationText(location) {
  const parts = [location.province, location.city, location.name].filter(Boolean);

  if (parts.length > 0) {
    return parts.join('·');
  }

  return location.name || '未命名地点';
}

function formatLocationMeta(location) {
  if (location.intro) {
    return location.intro;
  }

  if (location.description) {
    return location.description;
  }

  if (location.tags && location.tags.length > 0) {
    return location.tags.slice(0, 2).join(' / ');
  }

  if (location.level) {
    return location.level;
  }

  return '等待补充地点说明';
}

function parseCreatedAtToTimestamp(createdAt) {
  if (!createdAt) {
    return null;
  }

  if (createdAt instanceof Date) {
    const timestamp = createdAt.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof createdAt === 'number') {
    return Number.isFinite(createdAt) ? createdAt : null;
  }

  if (typeof createdAt === 'string') {
    const parsedTimestamp = Date.parse(createdAt);
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : null;
  }

  if (typeof createdAt.toDate === 'function') {
    const dateValue = createdAt.toDate();
    if (dateValue instanceof Date) {
      const timestamp = dateValue.getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    }
  }

  const seconds = Number(createdAt.seconds);
  const nanoseconds = Number(createdAt.nanoseconds);
  if (Number.isFinite(seconds)) {
    const normalizedNanoseconds = Number.isFinite(nanoseconds) ? nanoseconds : 0;
    return (seconds * 1000) + Math.floor(normalizedNanoseconds / 1000000);
  }

  const legacySeconds = Number(createdAt._seconds);
  const legacyNanoseconds = Number(createdAt._nanoseconds);
  if (Number.isFinite(legacySeconds)) {
    const normalizedLegacyNanoseconds = Number.isFinite(legacyNanoseconds) ? legacyNanoseconds : 0;
    return (legacySeconds * 1000) + Math.floor(normalizedLegacyNanoseconds / 1000000);
  }

  return null;
}

function isNewLocation(createdAt, nowTimestamp) {
  const createdAtTimestamp = parseCreatedAtToTimestamp(createdAt);

  if (!Number.isFinite(createdAtTimestamp)) {
    return false;
  }

  const currentTimestamp = Number.isFinite(nowTimestamp) ? nowTimestamp : Date.now();

  if (!Number.isFinite(currentTimestamp) || createdAtTimestamp > currentTimestamp) {
    return false;
  }

  return (currentTimestamp - createdAtTimestamp) <= NEW_LOCATION_WINDOW_MS;
}

function normalizeViewCount(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.floor(numericValue);
}

function isRecordableLocationId(locationId) {
  const normalizedLocationId = typeof locationId === 'string' ? locationId.trim() : '';
  const lowerCaseLocationId = normalizedLocationId.toLowerCase();

  if (!normalizedLocationId || lowerCaseLocationId === 'null') {
    return false;
  }

  if (lowerCaseLocationId.indexOf('temporary:') === 0 || lowerCaseLocationId.indexOf('transient:') === 0) {
    return false;
  }

  return true;
}

function recordLocationViewNonBlocking(locationId) {
  if (
    !isRecordableLocationId(locationId)
    || typeof wx === 'undefined'
    || !wx.cloud
    || typeof wx.cloud.callFunction !== 'function'
  ) {
    return;
  }

  wx.cloud.callFunction({
    name: 'recordLocationView',
    data: {
      locationId: locationId,
    },
  }).catch(function handleRecordLocationViewError(error) {
    console.warn('[recordLocationView] failed', error);
  });
}

function buildPendingSelectedPlaceDetail(selectedPlace) {
  return {
    source: selectedPlace.source,
    name: selectedPlace.name || '未命名地点',
    city: selectedPlace.city || '',
    province: selectedPlace.province || '',
    address: selectedPlace.address || '',
    latitude: selectedPlace.latitude,
    longitude: selectedPlace.longitude,
    poiid: selectedPlace.poiid || '',
    selectedPlace: {
      name: selectedPlace.name || '未命名地点',
      address: selectedPlace.address || '',
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      poiid: selectedPlace.poiid || '',
    },
    intro: selectedPlace.address || '本次地点来自微信地图选点，进入地点页后会先确认正式地点身份。',
    rawSelectedPlace: selectedPlace.rawPlace || null,
  };
}

Page({
  data: {
    allLocations: [],
    filteredLocations: [],
    loading: true,
    emptyState: false,
    emptyMessage: '暂时没有发现新的地点',
    errorMessage: '',
    chooseLocationLoading: false,
  },

  onLoad() {
    this.loadLocations();
  },

  async loadLocations() {
    this.setData({
      loading: true,
      emptyState: false,
      emptyMessage: '暂时没有发现新的地点',
      errorMessage: '',
    });

    try {
      const locations = await locationService.getPublishedLocations();
      const nowTimestamp = Date.now();
      const mappedLocations = locations.map(function mapLocation(location) {
        const viewCount = normalizeViewCount(location.viewCount);

        return {
          id: location.id,
          title: formatLocationText(location),
          description: formatLocationMeta(location),
          name: location.name || '',
          city: location.city || '',
          province: location.province || '',
          country: location.country || '',
          intro: location.intro || '',
          rawDescription: location.description || '',
          level: location.level || '',
          tags: location.tags || [],
          latitude: location.latitude,
          longitude: location.longitude,
          createdAt: location.createdAt || null,
          viewCount: viewCount,
          showNew: isNewLocation(location.createdAt, nowTimestamp),
          showHot: viewCount > 1000,
        };
      });

      this.setData({
        allLocations: mappedLocations,
        filteredLocations: mappedLocations,
        loading: false,
        emptyState: locations.length === 0,
        errorMessage: '',
      });
    } catch (error) {
      console.warn('Failed to load published locations:', error);
      this.setData({
        allLocations: [],
        filteredLocations: [],
        loading: false,
        emptyState: false,
        errorMessage: error.message || '地点加载失败，请稍后再试。',
      });
    }
  },

  goToLocation(event) {
    const { locationId } = event.currentTarget.dataset;

    if (!locationId) {
      return;
    }

    if (isRecordableLocationId(locationId)) {
      recordLocationViewNonBlocking(locationId);
    }

    wx.navigateTo({
      url: '/pages/location/location?locationId=' + locationId,
    });
  },

  handleChooseLocation() {
    if (this.data.chooseLocationLoading) {
      return;
    }

    if (typeof wx === 'undefined' || typeof wx.chooseLocation !== 'function') {
      wx.showToast({
        title: '当前微信版本暂不支持地图选点',
        icon: 'none',
      });
      return;
    }

    this.setData({
      chooseLocationLoading: true,
    });

    wx.chooseLocation({
      success: (result) => {
        const normalizedResult = locationService.normalizeSelectedPlace(result);

        if (normalizedResult.status !== 'valid' || !normalizedResult.selectedPlace) {
          wx.showToast({
            title: normalizedResult.matchReason || '当前地点信息无效，请重新选择',
            icon: 'none',
          });
          return;
        }

        const matchResult = locationService.matchSelectedPlaceToLocations(
          normalizedResult.selectedPlace,
          this.data.allLocations || []
        );

        if (matchResult.status === 'matched' && matchResult.locationId) {
          wx.navigateTo({
            url: '/pages/location/location?locationId=' + matchResult.locationId,
          });
          return;
        }

        const app = getApp();

        if (app && app.globalData) {
          app.globalData.pendingSelectedPlace = buildPendingSelectedPlaceDetail(normalizedResult.selectedPlace);
        }

        wx.navigateTo({
          url: '/pages/location/location?selectedPlace=1',
        });
      },
      fail: (error) => {
        const errMsg = error && error.errMsg ? String(error.errMsg) : '';

        if (errMsg.indexOf('cancel') !== -1) {
          return;
        }

        wx.showToast({
          title: '地图选点暂时不可用，请稍后重试',
          icon: 'none',
        });
      },
      complete: () => {
        this.setData({
          chooseLocationLoading: false,
        });
      },
    });
  },
});

if (typeof module !== 'undefined') {
  module.exports._private = {
    buildTransientLocationDetail: buildTransientLocationDetail,
    formatLocationMeta: formatLocationMeta,
    formatLocationText: formatLocationText,
    buildPendingSelectedPlaceDetail: buildPendingSelectedPlaceDetail,
    isNewLocation: isNewLocation,
    isRecordableLocationId: isRecordableLocationId,
    normalizeViewCount: normalizeViewCount,
    parseCreatedAtToTimestamp: parseCreatedAtToTimestamp,
    recordLocationViewNonBlocking: recordLocationViewNonBlocking,
}
}
