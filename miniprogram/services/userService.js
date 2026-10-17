const { initCloud } = require('./cloud');

const CURRENT_USER = {
  openid: 'mock-user-001',
  nickname: '旅途观察员',
  avatarUrl: '',
  language: 'zh-CN',
  magnifyingGlass: 5,
  createdAt: '2026-10-12T10:10:00.000Z',
};
const AD_REWARD_DAILY_LIMIT = 3;

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

// #region debug-point mg-update-client-debug
function summarizeCloudFunctionData(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const locationKey = trimString(payload.locationKey);
  const requestId = trimString(payload.requestId);

  return {
    action: trimString(payload.action),
    storyType: trimString(payload.storyType),
    locationKey: locationKey,
    locationKeyLength: locationKey.length,
    requestId: requestId,
    requestIdLength: requestId.length,
    rewardRequestId: trimString(payload.rewardRequestId),
    adUnitId: trimString(payload.adUnitId),
  };
}
// #endregion debug-point mg-update-client-debug

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

function callCloudFunction(name, data, deployCode, deployMessage) {
  initCloud();

  if (shouldUseLocalFallback()) {
    throw createServiceError('LOCAL_ONLY', '当前环境不支持云函数调用');
  }

  return new Promise(function executor(resolve, reject) {
    console.warn('[userService][debug] callCloudFunction request', {
      name: name,
      data: summarizeCloudFunctionData(data),
    });

    wx.cloud.callFunction({
      name: name,
      data: data,
      success: function onSuccess(result) {
        const functionResult = result && result.result ? result.result : null;

        console.warn('[userService][debug] callCloudFunction response', {
          name: name,
          data: summarizeCloudFunctionData(data),
          ok: functionResult && functionResult.ok,
          code: functionResult && functionResult.error ? functionResult.error.code : '',
          message: functionResult && functionResult.error ? functionResult.error.message : '',
        });

        if (!functionResult || typeof functionResult.ok !== 'boolean') {
          reject(createServiceError(deployCode, deployMessage));
          return;
        }

        if (functionResult.ok !== true) {
          const errorCode = functionResult && functionResult.error && functionResult.error.code
            ? functionResult.error.code
            : 'INTERNAL_ERROR';
          const message = functionResult && functionResult.error && functionResult.error.message
            ? functionResult.error.message
            : '服务暂时不可用，请稍后再试。';

          reject(createServiceError(errorCode, message));
          return;
        }

        resolve(functionResult.data || {});
      },
      fail: function onFail(error) {
        const rawMessage = error && error.message ? String(error.message) : '';

        console.error('[userService][debug] callCloudFunction transport failed', {
          name: name,
          data: summarizeCloudFunctionData(data),
          code: error && error.code ? String(error.code) : '',
          message: rawMessage,
        });

        if (
          rawMessage.indexOf('FunctionName parameter could not be found') !== -1
          || rawMessage.indexOf('找不到') !== -1
          || rawMessage.indexOf('not found') !== -1
        ) {
          reject(createServiceError(deployCode, deployMessage));
          return;
        }

        reject(createServiceError(error && error.code ? String(error.code) : 'INTERNAL_ERROR', rawMessage || '服务暂时不可用，请稍后再试。'));
      },
    });
  });
}

async function callMagnifyingGlassFunction(data) {
  return callCloudFunction(
    'consumeMagnifyingGlass',
    data,
    'DEPLOY_REQUIRED',
    '放大镜服务尚未更新，请重新部署 consumeMagnifyingGlass 云函数。'
  );
}

function normalizeAdRewardStatus(rawData) {
  const status = rawData && typeof rawData === 'object' ? rawData : {};

  return {
    magnifyingGlass: typeof status.magnifyingGlass === 'number' ? status.magnifyingGlass : CURRENT_USER.magnifyingGlass,
    todayRewardCount: typeof status.todayRewardCount === 'number' ? status.todayRewardCount : 0,
    dailyRewardLimit: typeof status.dailyRewardLimit === 'number' ? status.dailyRewardLimit : AD_REWARD_DAILY_LIMIT,
    rewardAmount: typeof status.rewardAmount === 'number' ? status.rewardAmount : 1,
    duplicate: !!status.duplicate,
  };
}

function validateRewardPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw createServiceError('INVALID_INPUT', '广告奖励请求参数不完整。');
  }

  const rewardRequestId = trimString(payload.rewardRequestId);
  const adUnitId = trimString(payload.adUnitId);

  if (!rewardRequestId) {
    throw createServiceError('INVALID_INPUT', 'rewardRequestId 不能为空。');
  }

  if (!adUnitId) {
    throw createServiceError('INVALID_INPUT', 'adUnitId 不能为空。');
  }

  return {
    rewardRequestId: rewardRequestId,
    adUnitId: adUnitId,
  };
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

async function getAdRewardStatus() {
  if (shouldUseLocalFallback()) {
    return {
      magnifyingGlass: CURRENT_USER.magnifyingGlass,
      todayRewardCount: 0,
      dailyRewardLimit: AD_REWARD_DAILY_LIMIT,
      rewardAmount: 1,
      duplicate: false,
    };
  }

  const status = normalizeAdRewardStatus(await callCloudFunction(
    'claimAdReward',
    {
      action: 'status',
    },
    'DEPLOY_REQUIRED',
    '广告奖励服务尚未更新，请重新部署 claimAdReward 云函数。'
  ));

  CURRENT_USER.magnifyingGlass = status.magnifyingGlass;
  return status;
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

async function claimAdReward(payload) {
  const normalizedPayload = validateRewardPayload(payload);

  if (shouldUseLocalFallback()) {
    throw createServiceError('AD_REWARD_UNAVAILABLE', '广告奖励暂时不可用，请稍后再试');
  }

  const status = normalizeAdRewardStatus(await callCloudFunction(
    'claimAdReward',
    {
      action: 'claim',
      rewardRequestId: normalizedPayload.rewardRequestId,
      adUnitId: normalizedPayload.adUnitId,
    },
    'DEPLOY_REQUIRED',
    '广告奖励服务尚未更新，请重新部署 claimAdReward 云函数。'
  ));

  CURRENT_USER.magnifyingGlass = status.magnifyingGlass;
  return status;
}

module.exports = {
  claimAdReward,
  consumeMagnifyingGlass,
  getAdRewardStatus,
  getAtlasItems,
  getCurrentUserProfile,
  prepareMagnifyingGlassUsage,
  releaseMagnifyingGlassRequest,
};
