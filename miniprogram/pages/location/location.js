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
    enabled: true,
  },
];

const STORY_MODE_DISPLAY_TYPES = {
  folk: '民间传说',
  ai_comment: 'AI说',
  traveler: '网友说',
};

function formatCityText(location) {
  if (location.transientPlace && location.address) {
    return location.address;
  }

  const primary = [location.city, location.province].filter(Boolean).join(' · ');

  if (primary) {
    return primary;
  }

  return location.country || '城市信息待补充';
}

function formatLocationIntro(location) {
  if (location.transientPlace) {
    const addressText = location.address ? '微信地图返回地址：' + location.address + '。' : '';
    return addressText + '当前地点尚未写入系统地点库，本次会按临时选定地点生成故事。';
  }

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
  if (location.transientPlace) {
    return '微信地图选点 / 临时地点';
  }

  if (location.tags && location.tags.length > 0) {
    return location.tags.join(' / ');
  }

  if (location.level) {
    return location.level;
  }

  return '地点线索整理中';
}

function formatLocationAddress(location) {
  if (!location) {
    return '';
  }

  if (location.address) {
    return location.address;
  }

  return [location.province, location.city, location.name].filter(Boolean).join('');
}

function createStoryModes(options) {
  return STORY_TYPES.map(function cloneStoryMode(mode) {
    return Object.assign({}, mode);
  });
}

function buildTemporarySelectedPlace(locationDetail) {
  if (!locationDetail) {
    return null;
  }

  const selectedPlace = locationDetail.selectedPlace || {};

  return {
    name: selectedPlace.name || locationDetail.name || '',
    address: selectedPlace.address || locationDetail.address || '',
    latitude: selectedPlace.latitude,
    longitude: selectedPlace.longitude,
    poiid: selectedPlace.poiid || locationDetail.poiid || '',
  };
}

function validateAiStoryRequestPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('故事生成参数不完整，请重新选择地点。');
  }

  if (payload.isTemporary === true) {
    if (payload.locationId !== null) {
      throw new Error('临时地点不应携带正式 locationId。');
    }

    if (!payload.selectedPlace || typeof payload.selectedPlace !== 'object') {
      throw new Error('临时地点信息已失效，请重新选择地点。');
    }

    if (!String(payload.selectedPlace.name || '').trim()) {
      throw new Error('临时地点名称缺失，请重新选择地点。');
    }

    return payload;
  }

  if (typeof payload.locationId !== 'string' || !payload.locationId.trim()) {
    throw new Error('正式地点缺少有效 locationId。');
  }

  return payload;
}

function buildAiStoryRequestPayload(locationDetail, storyDisplayType) {
  const isTemporary = !!(locationDetail && (locationDetail.isTemporary || locationDetail.transientPlace));

  if (isTemporary) {
    return validateAiStoryRequestPayload({
      locationId: null,
      isTemporary: true,
      selectedPlace: buildTemporarySelectedPlace(locationDetail),
      locationName: locationDetail.name || '',
      locationDescription: locationDetail.intro || '',
      city: locationDetail.city || '',
      type: storyDisplayType,
    });
  }

  return validateAiStoryRequestPayload({
    locationId: locationDetail && locationDetail.id ? locationDetail.id : '',
    isTemporary: false,
    selectedPlace: null,
    locationName: locationDetail.name || '',
    locationDescription: locationDetail.intro || '',
    city: locationDetail.city || '',
    type: storyDisplayType,
  });
}

function buildGeneratedStoryForPage(resultStory, locationDetail) {
  return {
    id: resultStory.storyId,
    locationId: resultStory.locationId,
    type: resultStory.type,
    title: resultStory.title,
    content: resultStory.content,
    source: resultStory.source,
    generated: true,
    isTemporary: !!(locationDetail.isTemporary || locationDetail.transientPlace),
    locationName: locationDetail.name || '',
    city: locationDetail.city || '',
    locationAddress: locationDetail.address || '',
    selectedPlace: buildTemporarySelectedPlace(locationDetail),
    transientPlace: !!locationDetail.transientPlace,
  };
}

function createAiServiceError(code, message) {
  const error = new Error(message || 'AI故事暂时生成失败，请稍后再试');

  if (code) {
    error.code = code;
  }

  return error;
}

function createStoryRequestId() {
  return 'mg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function createStableLocationHash(rawText) {
  const text = String(rawText || '');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function normalizeLocationKeyText(value) {
  const normalizedValue = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalizedValue) {
    return '';
  }

  const lowerCaseValue = normalizedValue.toLowerCase();

  if (lowerCaseValue === 'null' || lowerCaseValue === 'undefined') {
    return '';
  }

  return normalizedValue;
}

function normalizeLocationKeyCoordinate(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return numericValue.toFixed(6);
}

function buildTemporaryMagnifyingGlassLocationKey(locationDetail) {
  const selectedPlace = buildTemporarySelectedPlace(locationDetail) || {};
  const poiid = normalizeLocationKeyText(selectedPlace.poiid || locationDetail.poiid || '');

  if (poiid) {
    return 'temporary:poiid:' + poiid;
  }

  const normalizedName = normalizeLocationKeyText(selectedPlace.name || locationDetail.name || '');
  const normalizedAddress = normalizeLocationKeyText(selectedPlace.address || locationDetail.address || '');
  const normalizedLatitude = normalizeLocationKeyCoordinate(selectedPlace.latitude);
  const normalizedLongitude = normalizeLocationKeyCoordinate(selectedPlace.longitude);

  if (!normalizedName || !normalizedLatitude || !normalizedLongitude) {
    throw new Error('当前地点信息不完整，请重新选择地点。');
  }

  return 'temporary:coord:' + createStableLocationHash([
    normalizedName,
    normalizedAddress,
    normalizedLatitude,
    normalizedLongitude,
  ].join('|'));
}

// #region debug-point mg-update-location-debug
function summarizeUsagePayloadForDebug(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};

  return {
    locationKey: data.locationKey || '',
    storyType: data.storyType || '',
    requestId: data.requestId || '',
  };
}

function summarizeLocationDetailForDebug(locationDetail) {
  const detail = locationDetail && typeof locationDetail === 'object' ? locationDetail : {};

  return {
    id: detail.id || null,
    isTemporary: !!detail.isTemporary,
    transientPlace: !!detail.transientPlace,
    name: detail.name || '',
    address: detail.address || '',
    latitude: detail.latitude,
    longitude: detail.longitude,
    poiid: detail.poiid || '',
    selectedPlace: buildTemporarySelectedPlace(detail),
  };
}
// #endregion debug-point mg-update-location-debug

function buildMagnifyingGlassLocationKey(locationDetail) {
  if (!locationDetail) {
    throw new Error('地点信息暂时不可用');
  }

  const formalLocationId = normalizeLocationKeyText(locationDetail.id);

  if (formalLocationId) {
    return formalLocationId;
  }

  return buildTemporaryMagnifyingGlassLocationKey(locationDetail);
}

function buildMagnifyingGlassPayload(locationDetail, storyDisplayType) {
  try {
    return {
      locationKey: buildMagnifyingGlassLocationKey(locationDetail),
      storyType: storyDisplayType,
      requestId: createStoryRequestId(),
    };
  } catch (error) {
    throw createAiServiceError(
      'MAGNIFYING_GLASS_INVALID_LOCATION_KEY',
      error && error.message ? error.message : '当前地点信息不完整，请重新选择地点。'
    );
  }
}

function getUserFacingAiErrorMessage(error) {
  const code = error && error.code ? String(error.code) : '';
  const rawMessage = error && error.message ? String(error.message) : '';
  const normalizedMessage = rawMessage
    .replace(/^Failed to load story by location and type from CloudBase:\s*/, '')
    .replace(/^Failed to load preset story by location and type from CloudBase:\s*/, '')
    .replace(/^Failed to load user story by location from CloudBase:\s*/, '');

  if (code === 'AI_USER_LIMIT') {
    return '今日 AI 生成请求已达到保护上限，请稍后再试';
  }

  if (code === 'AI_GLOBAL_LIMIT') {
    return '当前 AI 服务较忙，请稍后再试';
  }

  if (code === 'AI_CIRCUIT_OPEN') {
    return 'AI 故事服务暂时维护中';
  }

  if (code === 'AI_TIMEOUT') {
    return '故事生成超时，请稍后再试';
  }

  if (code === 'AI_PROVIDER_ERROR' || code === 'NORMALIZATION_ERROR') {
    return 'AI 故事暂时生成失败，请稍后再试';
  }

  if (code === 'AI_REQUEST_IN_PROGRESS') {
    return '故事生成处理中，请稍后再试';
  }

  if (code === 'UNAUTHORIZED') {
    return '当前用户身份读取失败，请稍后再试';
  }

  if (code === 'MAGNIFYING_GLASS_EMPTY') {
    return '放大镜不足，暂时无法继续探索。';
  }

  if (code === 'MAGNIFYING_GLASS_DAILY_LIMIT') {
    return '今天的探索次数已用完，请明天再来。';
  }

  if (code === 'MAGNIFYING_GLASS_LOCATION_TYPE_LIMIT') {
    return '这个地点的该类故事今天已经探索 3 次了。';
  }

  if (code === 'MAGNIFYING_GLASS_CONCURRENT_REQUEST') {
    return '当前探索处理中，请稍后再试。';
  }

  if (code === 'MAGNIFYING_GLASS_INVALID_LOCATION_KEY') {
    return '当前地点信息不完整，请重新选择地点。';
  }

  if (code === 'MAGNIFYING_GLASS_USAGE_COLLECTION_ERROR' || code === 'MAGNIFYING_GLASS_DATABASE_ERROR') {
    return '放大镜服务暂时不可用，请稍后再试。';
  }

  if (!normalizedMessage) {
    return 'AI故事生成失败，请稍后重试';
  }

  if (normalizedMessage.indexOf('AI服务暂未配置') !== -1) {
    return 'AI服务暂未配置';
  }

  if (normalizedMessage.indexOf('AI故事生成超时') !== -1) {
    return 'AI故事生成超时，请稍后重试';
  }

  return normalizedMessage;
}

function getStoryDisplayTypeByModeKey(modeKey) {
  return STORY_MODE_DISPLAY_TYPES[modeKey] || 'AI说';
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
    if (options && options.transientPlace === '1') {
      this.loadTransientLocationDetail();
      return;
    }

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
          locationId: location.id,
          isTemporary: false,
          transientPlace: false,
          name: location.name || '未命名地点',
          city: location.city || '',
          province: location.province || '',
          country: location.country || '',
          address: formatLocationAddress(location),
          latitude: location.latitude,
          longitude: location.longitude,
          cityText: formatCityText(location),
          intro: formatLocationIntro(location),
          heroIntro: formatHeroIntro(location),
          tagsText: formatTags(location),
          storyCountText: stories.length + ' 篇',
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

  async loadTransientLocationDetail() {
    const app = getApp();
    const selectedPlace = app && app.globalData ? app.globalData.pendingSelectedPlace : null;

    if (app && app.globalData) {
      app.globalData.pendingSelectedPlace = null;
    }

    if (!selectedPlace) {
      this.setData({
        locationDetail: null,
        storyModes: createStoryModes(),
        loading: false,
        errorMessage: '当前临时地点信息已失效，请重新选择地点。',
      });
      return;
    }

    try {
      const profile = await userService.getCurrentUserProfile();

      this.setData({
        locationDetail: {
          id: null,
          locationId: null,
          isTemporary: true,
          transientPlace: true,
          source: selectedPlace.source || 'wechat_chooseLocation',
          name: selectedPlace.name || '未命名地点',
          city: selectedPlace.city || '',
          address: selectedPlace.address || '',
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          poiid: selectedPlace.poiid || '',
          selectedPlace: buildTemporarySelectedPlace(selectedPlace),
          cityText: formatCityText(selectedPlace),
          intro: formatLocationIntro(selectedPlace),
          heroIntro: formatHeroIntro(selectedPlace),
          tagsText: formatTags(selectedPlace),
          storyCountText: '本次选点临时生成',
        },
        storyModes: createStoryModes({
          transientPlace: true,
        }),
        remainingMagnifyingGlass: profile.magnifyingGlass || 0,
        loading: false,
        errorMessage: '',
      });
    } catch (error) {
      this.setData({
        locationDetail: null,
        storyModes: createStoryModes(),
        loading: false,
        errorMessage: '临时地点加载失败，请重新选择地点。',
      });
    }
  },

  openTravelerStoriesPage() {
    const locationDetail = this.data.locationDetail;

    if (!locationDetail) {
      wx.showToast({
        title: '地点信息暂时不可用',
        icon: 'none',
      });
      return;
    }

    const app = getApp();

    if (app && app.globalData) {
      app.globalData.pendingUserStoriesLocation = {
        locationId: locationDetail.id || null,
        locationName: locationDetail.name || '',
        address: locationDetail.address || '',
        latitude: locationDetail.latitude,
        longitude: locationDetail.longitude,
        isTemporary: !!(locationDetail.isTemporary || locationDetail.transientPlace),
        transientPlace: !!locationDetail.transientPlace,
        placeSnapshot: {
          name: locationDetail.name || '',
          address: locationDetail.address || '',
          latitude: locationDetail.latitude,
          longitude: locationDetail.longitude,
          poiid: locationDetail.poiid || '',
        },
      };
    }

    wx.navigateTo({
      url: '/pages/userStories/userStories?source=location',
    });
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

    let usagePayload = null;
    let usagePrepared = false;
    let usageConsumed = false;

    try {
      if (type === 'traveler') {
        this.openTravelerStoriesPage();
        return;
      }

      this.requestLock = true;
      let profile = null;

      try {
        profile = await userService.getCurrentUserProfile();
      } catch (profileError) {
        wx.showToast({
          title: '放大镜数量获取失败，请稍后重试',
          icon: 'none',
        });
        return;
      }

      if (!profile) {
        wx.showToast({
          title: '放大镜数量获取失败，请稍后重试',
          icon: 'none',
        });
        return;
      }

      const currentMagnifyingGlass = profile.magnifyingGlass || 0;

      this.setData({
        remainingMagnifyingGlass: currentMagnifyingGlass,
      });

      if (currentMagnifyingGlass < 1) {
        wx.showToast({
          title: '放大镜不足，暂时无法继续探索。',
          icon: 'none',
        });
        return;
      }

      usagePayload = buildMagnifyingGlassPayload(
        this.data.locationDetail,
        getStoryDisplayTypeByModeKey(type)
      );
      console.warn('[location][debug] prepare start', {
        type: type,
        label: label || '',
        locationDetail: summarizeLocationDetailForDebug(this.data.locationDetail),
        usagePayload: summarizeUsagePayloadForDebug(usagePayload),
      });
      await userService.prepareMagnifyingGlassUsage(usagePayload);
      usagePrepared = true;
      console.warn('[location][debug] prepare success', {
        type: type,
        usagePayload: summarizeUsagePayloadForDebug(usagePayload),
      });

      this.setData({
        requesting: true,
        requestingTypeLabel: label || '故事',
      });

      let story = null;
      const isTransientPlace = !!(
        this.data.locationDetail.transientPlace || this.data.locationDetail.isTemporary
      );

      if (type === 'ai_comment') {
        const generatedStory = await this.generateAiStory(type);
        story = generatedStory;
      } else if (type === 'folk') {
        if (isTransientPlace) {
          story = await this.generateAiStory(type);
        } else {
          try {
            story = await storyService.getRandomPresetStoryByLocationAndType(this.data.locationDetail.id, type);
          } catch (presetError) {
            const rawMessage = presetError && presetError.message ? String(presetError.message) : '';

            if (rawMessage.indexOf('这个地点暂时还没有这种类型的预设故事。') === -1) {
              throw presetError;
            }

            story = await this.generateAiStory(type);
          }
        }
      } else {
        try {
          story = await storyService.getRandomStoryByLocationAndType(this.data.locationDetail.id, type);
        } catch (error) {
          throw error;
        }
      }

      console.warn('[location][debug] consume start', {
        type: type,
        usagePayload: summarizeUsagePayloadForDebug(usagePayload),
        storyGenerated: !!(story && story.generated),
        storyId: story && story.id ? story.id : '',
      });
      const updatedProfile = await userService.consumeMagnifyingGlass(usagePayload);
      usageConsumed = true;
      console.warn('[location][debug] consume success', {
        type: type,
        usagePayload: summarizeUsagePayloadForDebug(usagePayload),
        magnifyingGlass: updatedProfile && typeof updatedProfile.magnifyingGlass === 'number'
          ? updatedProfile.magnifyingGlass
          : null,
        dailyTotalCount: updatedProfile && typeof updatedProfile.dailyTotalCount === 'number'
          ? updatedProfile.dailyTotalCount
          : null,
        locationTypeCount: updatedProfile && typeof updatedProfile.locationTypeCount === 'number'
          ? updatedProfile.locationTypeCount
          : null,
      });

      this.setData({
        remainingMagnifyingGlass: updatedProfile.magnifyingGlass || 0,
      });

      await new Promise(function navigateToStory(resolve, reject) {
        wx.navigateTo({
          url: story.generated
            ? '/pages/story/story?generatedStory=1'
            : '/pages/story/story?storyId=' + story.id,
          success: resolve,
          fail: reject,
        });
      });
    } catch (error) {
      if (usagePrepared && !usageConsumed && usagePayload) {
        try {
          console.warn('[location][debug] release start', {
            type: type,
            usagePayload: summarizeUsagePayloadForDebug(usagePayload),
          });
          await userService.releaseMagnifyingGlassRequest(usagePayload);
          console.warn('[location][debug] release success', {
            type: type,
            usagePayload: summarizeUsagePayloadForDebug(usagePayload),
          });
        } catch (releaseError) {
          console.warn('[location] release magnifying glass request failed', {
            code: releaseError && releaseError.code ? releaseError.code : 'INTERNAL_ERROR',
            message: releaseError && releaseError.message ? releaseError.message : '',
            usagePayload: summarizeUsagePayloadForDebug(usagePayload),
          });
        }
      }

      console.error('[location] story request failed', {
        code: error && error.code ? error.code : 'INTERNAL_ERROR',
        message: error && error.message ? error.message : '',
        type: type,
        usagePayload: summarizeUsagePayloadForDebug(usagePayload),
        usagePrepared: usagePrepared,
        usageConsumed: usageConsumed,
      });
      const message = getUserFacingAiErrorMessage(error);

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

  async generateAiStory(storyModeKey) {
    if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      throw new Error('AI服务暂时不可用，请稍后重试');
    }

    const payload = buildAiStoryRequestPayload(
      this.data.locationDetail,
      getStoryDisplayTypeByModeKey(storyModeKey)
    );
    const functionResult = await new Promise(function callGenerateStory(resolve, reject) {
      wx.cloud.callFunction({
        name: 'generateStory',
        data: payload,
        success: resolve,
        fail: reject,
      });
    });
    const result = functionResult && functionResult.result ? functionResult.result : null;

    if (!result || result.ok !== true || !result.story) {
      const errorCode = result && result.error && result.error.code
        ? result.error.code
        : 'AI_PROVIDER_ERROR';
      const message = result && result.error && result.error.message
        ? result.error.message
        : 'AI故事暂时生成失败，请稍后再试';
      throw createAiServiceError(errorCode, message);
    }

    const app = getApp();
    const generatedStory = buildGeneratedStoryForPage(result.story, this.data.locationDetail);

    if (app && app.globalData) {
      app.globalData.pendingGeneratedStory = generatedStory;
    }

    return generatedStory;
  },
});
