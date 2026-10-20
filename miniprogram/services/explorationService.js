const { initCloud } = require('./cloud');

const ALLOWED_STORY_TYPES = {
  folk: true,
  ai_comment: true,
  traveler: true,
};

const STORY_TYPE_LABELS = {
  folk: '民间传说',
  ai_comment: '懦词怪说',
  traveler: '街谈巷说',
};

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createServiceError(code, message) {
  const error = new Error(message);

  if (code) {
    error.code = code;
  }

  return error;
}

function normalizeDateValue(value) {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (typeof value === 'object') {
    if (typeof value.$date !== 'undefined') {
      return normalizeDateValue(value.$date);
    }

    if (typeof value.toDate === 'function') {
      return normalizeDateValue(value.toDate());
    }

    if (typeof value.seconds === 'number') {
      return normalizeDateValue(value.seconds * 1000);
    }

    if (typeof value._seconds === 'number') {
      return normalizeDateValue(value._seconds * 1000);
    }
  }

  return 0;
}

function getStoryTypeLabel(storyType) {
  const normalizedType = trimString(storyType);
  return STORY_TYPE_LABELS[normalizedType] || '';
}

function validateStoryType(storyType) {
  const normalizedType = trimString(storyType);

  if (!ALLOWED_STORY_TYPES[normalizedType]) {
    throw createServiceError('INVALID_INPUT', '故事类型无效，暂时无法记录足迹。');
  }

  return normalizedType;
}

function validateLocationId(locationId) {
  const normalizedLocationId = trimString(locationId);

  if (!normalizedLocationId || normalizedLocationId.toLowerCase() === 'null') {
    throw createServiceError('INVALID_INPUT', '正式地点缺少有效 locationId。');
  }

  return normalizedLocationId;
}

function validateLocationName(locationName) {
  const normalizedLocationName = trimString(locationName);

  if (!normalizedLocationName) {
    throw createServiceError('INVALID_INPUT', '正式地点缺少有效地点名称。');
  }

  return normalizedLocationName;
}

function validateRecordPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw createServiceError('INVALID_INPUT', '足迹记录参数无效。');
  }

  if (typeof payload.userId !== 'undefined') {
    throw createServiceError('INVALID_INPUT', '足迹记录不接受前端 userId。');
  }

  return {
    locationId: validateLocationId(payload.locationId),
    locationName: validateLocationName(payload.locationName),
    storyType: validateStoryType(payload.storyType),
  };
}

function normalizeExplorationItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const locationId = trimString(item.locationId);
  const locationName = trimString(item.locationName);
  const storyType = trimString(item.storyType);

  if (!locationId || !locationName || !ALLOWED_STORY_TYPES[storyType]) {
    return null;
  }

  return {
    id: trimString(item._id || item.id || item.explorationId),
    userId: trimString(item.userId),
    locationId: locationId,
    locationName: locationName,
    storyType: storyType,
    storyTypeLabel: getStoryTypeLabel(storyType),
    lastExploredAt: normalizeDateValue(item.lastExploredAt),
    createdAt: normalizeDateValue(item.createdAt),
    updatedAt: normalizeDateValue(item.updatedAt),
  };
}

async function callCloudFunction(name, data, deployMessage) {
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    throw createServiceError('DEPLOY_REQUIRED', deployMessage);
  }

  initCloud();

  try {
    const result = await new Promise(function callFunction(resolve, reject) {
      wx.cloud.callFunction({
        name: name,
        data: data || {},
        success: resolve,
        fail: reject,
      });
    });
    const functionResult = result && result.result ? result.result : null;

    if (!functionResult || typeof functionResult.ok !== 'boolean') {
      throw createServiceError('DEPLOY_REQUIRED', deployMessage);
    }

    if (functionResult.ok !== true) {
      const errorCode = functionResult && functionResult.error && functionResult.error.code
        ? functionResult.error.code
        : 'INTERNAL_ERROR';
      const message = functionResult && functionResult.error && functionResult.error.message
        ? functionResult.error.message
        : '服务暂时不可用，请稍后再试。';
      throw createServiceError(errorCode, message);
    }

    return functionResult;
  } catch (error) {
    const rawMessage = error && error.message ? String(error.message) : '';
    const errorCode = error && error.code ? String(error.code) : '';

    if (
      rawMessage.indexOf('FunctionName parameter could not be found') !== -1
      || rawMessage.indexOf('找不到') !== -1
      || rawMessage.indexOf('not found') !== -1
    ) {
      throw createServiceError('DEPLOY_REQUIRED', deployMessage);
    }

    throw createServiceError(errorCode || 'INTERNAL_ERROR', rawMessage || '服务暂时不可用，请稍后再试。');
  }
}

async function recordExploration(payload) {
  const normalizedPayload = validateRecordPayload(payload);
  const result = await callCloudFunction(
    'recordExploration',
    normalizedPayload,
    '足迹记录服务尚未更新，请重新部署 recordExploration 云函数。'
  );

  return {
    explorationId: trimString(result.explorationId),
    created: !!result.created,
    item: normalizeExplorationItem(result.item),
  };
}

async function getMyExplorations() {
  const result = await callCloudFunction(
    'getMyExplorations',
    {},
    '足迹读取服务尚未更新，请重新部署 getMyExplorations 云函数。'
  );
  const items = Array.isArray(result.items) ? result.items : [];

  return items
    .map(normalizeExplorationItem)
    .filter(Boolean);
}

module.exports = {
  getMyExplorations,
  getStoryTypeLabel,
  recordExploration,
};
