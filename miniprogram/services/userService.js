const { initCloud } = require('./cloud');

const CURRENT_USER = {
  openid: 'mock-user-001',
  nickname: '旅途观察员',
  avatarUrl: '',
  language: 'zh-CN',
  magnifyingGlass: 5,
  createdAt: '2026-10-12T10:10:00.000Z',
};

const ATLAS_ITEMS = [
  {
    id: 'exp-001',
    userId: CURRENT_USER.openid,
    locationId: 'loc-nantou',
    storyId: 'story-ai-nantou',
    type: 'AI说',
    createdAt: '2026-10-12T10:12:00.000Z',
    location: '深圳·南头古城',
    note: '从AI观察视角看到熟悉地点的另一面。',
  },
  {
    id: 'exp-002',
    userId: CURRENT_USER.openid,
    locationId: 'loc-xian-wall',
    storyId: 'story-folk-xian',
    type: '民间传说',
    createdAt: '2026-10-12T10:15:00.000Z',
    location: '西安城墙',
    note: '带一点时间感和地方记忆的故事卡片。',
  },
];

function cloneCurrentUser() {
  return Object.assign({}, CURRENT_USER);
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createServiceError(code, message) {
  const error = new Error(message || '放大镜服务暂时不可用，请稍后再试');

  if (code) {
    error.code = code;
  }

  return error;
}

function syncLocalCurrentUser(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  CURRENT_USER.openid = trimString(profile.openid) || CURRENT_USER.openid;
  CURRENT_USER.nickname = trimString(profile.nickname) || CURRENT_USER.nickname;
  CURRENT_USER.avatarUrl = trimString(profile.avatarUrl);
  CURRENT_USER.language = trimString(profile.language) || CURRENT_USER.language;
  CURRENT_USER.magnifyingGlass = typeof profile.magnifyingGlass === 'number'
    ? profile.magnifyingGlass
    : CURRENT_USER.magnifyingGlass;

  return cloneCurrentUser();
}

function normalizeCloudProfile(rawData) {
  const profile = rawData && typeof rawData === 'object' ? rawData : {};

  return {
    openid: trimString(profile.openid),
    nickname: trimString(profile.nickname) || CURRENT_USER.nickname,
    avatarUrl: trimString(profile.avatarUrl),
    language: trimString(profile.language) || CURRENT_USER.language,
    magnifyingGlass: typeof profile.magnifyingGlass === 'number' ? profile.magnifyingGlass : 0,
    dailyTotalCount: typeof profile.dailyTotalCount === 'number' ? profile.dailyTotalCount : 0,
    locationTypeCount: typeof profile.locationTypeCount === 'number' ? profile.locationTypeCount : 0,
    duplicate: !!profile.duplicate,
  };
}

function shouldUseLocalFallback() {
  return typeof wx === 'undefined'
    || !wx.cloud
    || typeof wx.cloud.callFunction !== 'function';
}

async function callMagnifyingGlassFunction(data) {
  initCloud();

  if (shouldUseLocalFallback()) {
    throw createServiceError('LOCAL_ONLY', '当前环境不支持云函数调用');
  }

  try {
    const result = await new Promise(function callCloudFunction(resolve, reject) {
      wx.cloud.callFunction({
        name: 'consumeMagnifyingGlass',
        data: data,
        success: resolve,
        fail: reject,
      });
    });
    const functionResult = result && result.result ? result.result : null;

    if (!functionResult || typeof functionResult.ok !== 'boolean') {
      throw createServiceError('DEPLOY_REQUIRED', '放大镜服务尚未更新，请重新部署 consumeMagnifyingGlass 云函数。');
    }

    if (functionResult.ok !== true) {
      const errorCode = functionResult && functionResult.error && functionResult.error.code
        ? functionResult.error.code
        : 'INTERNAL_ERROR';
      const message = functionResult && functionResult.error && functionResult.error.message
        ? functionResult.error.message
        : '放大镜服务暂时不可用，请稍后再试。';

      throw createServiceError(errorCode, message);
    }

    return functionResult.data || {};
  } catch (error) {
    const rawMessage = error && error.message ? String(error.message) : '';
    const errorCode = error && error.code ? String(error.code) : '';

    if (
      rawMessage.indexOf('FunctionName parameter could not be found') !== -1
      || rawMessage.indexOf('找不到') !== -1
      || rawMessage.indexOf('not found') !== -1
    ) {
      throw createServiceError('DEPLOY_REQUIRED', '放大镜服务尚未更新，请重新部署 consumeMagnifyingGlass 云函数。');
    }

    throw createServiceError(errorCode || 'INTERNAL_ERROR', rawMessage || '放大镜服务暂时不可用，请稍后再试。');
  }
}

function validateUsagePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw createServiceError('INVALID_INPUT', '放大镜请求参数不完整。');
  }

  const locationKey = trimString(payload.locationKey);
  const storyType = trimString(payload.storyType);
  const requestId = trimString(payload.requestId);

  if (!locationKey) {
    throw createServiceError('INVALID_INPUT', 'locationKey 不能为空。');
  }

  if (!storyType) {
    throw createServiceError('INVALID_INPUT', 'storyType 不能为空。');
  }

  if (!requestId) {
    throw createServiceError('INVALID_INPUT', 'requestId 不能为空。');
  }

  return {
    locationKey: locationKey,
    storyType: storyType,
    requestId: requestId,
  };
}

async function getCurrentUserProfile() {
  if (shouldUseLocalFallback()) {
    initCloud();
    return Promise.resolve(cloneCurrentUser());
  }

  const profile = normalizeCloudProfile(await callMagnifyingGlassFunction({
    action: 'profile',
  }));

  syncLocalCurrentUser(profile);
  return profile;
}

function getAtlasItems() {
  initCloud();
  return Promise.resolve(ATLAS_ITEMS.slice());
}

async function prepareMagnifyingGlassUsage(payload) {
  const normalizedPayload = validateUsagePayload(payload);

  if (shouldUseLocalFallback()) {
    if (CURRENT_USER.magnifyingGlass < 1) {
      throw createServiceError('MAGNIFYING_GLASS_EMPTY', '放大镜不足，暂时无法继续探索。');
    }

    return {
      duplicate: false,
      magnifyingGlass: CURRENT_USER.magnifyingGlass,
      dailyTotalCount: 0,
      locationTypeCount: 0,
    };
  }

  const profile = normalizeCloudProfile(await callMagnifyingGlassFunction({
    action: 'prepare',
    locationKey: normalizedPayload.locationKey,
    storyType: normalizedPayload.storyType,
    requestId: normalizedPayload.requestId,
  }));

  syncLocalCurrentUser(profile);
  return profile;
}

async function consumeMagnifyingGlass(payload) {
  const normalizedPayload = validateUsagePayload(payload);

  if (shouldUseLocalFallback()) {
    if (CURRENT_USER.magnifyingGlass < 1) {
      throw createServiceError('MAGNIFYING_GLASS_EMPTY', '放大镜不足，暂时无法继续探索。');
    }

    CURRENT_USER.magnifyingGlass = CURRENT_USER.magnifyingGlass - 1;
    return cloneCurrentUser();
  }

  const profile = normalizeCloudProfile(await callMagnifyingGlassFunction({
    action: 'consume',
    locationKey: normalizedPayload.locationKey,
    storyType: normalizedPayload.storyType,
    requestId: normalizedPayload.requestId,
  }));

  syncLocalCurrentUser(profile);
  return profile;
}

async function releaseMagnifyingGlassRequest(payload) {
  const normalizedPayload = validateUsagePayload(payload);

  if (shouldUseLocalFallback()) {
    return {
      released: true,
    };
  }

  return callMagnifyingGlassFunction({
    action: 'release',
    locationKey: normalizedPayload.locationKey,
    storyType: normalizedPayload.storyType,
    requestId: normalizedPayload.requestId,
  });
}

module.exports = {
  consumeMagnifyingGlass,
  getAtlasItems,
  getCurrentUserProfile,
  prepareMagnifyingGlassUsage,
  releaseMagnifyingGlassRequest,
};
