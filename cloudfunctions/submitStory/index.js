let cloud = null;

try {
  cloud = require('wx-server-sdk');
} catch (error) {
  cloud = {
    DYNAMIC_CURRENT_ENV: '',
    init: function init() {},
    database: function database() {
      return null;
    },
    getWXContext: function getWXContext() {
      return {};
    },
  };
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database ? cloud.database() : null;
const LOCATIONS_COLLECTION = 'locations';
const STORIES_COLLECTION = 'stories';
const TITLE_MAX_LENGTH = 40;
const CONTENT_MAX_LENGTH = 2000;
const SUMMARY_MAX_LENGTH = 80;
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  LOCATION_NOT_FOUND: true,
  UNAUTHORIZED: true,
  SYSTEM_ERROR: true,
};

class SubmitStoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SubmitStoryError';
    this.code = code;
  }
}

function buildSuccess(storyId) {
  return {
    ok: true,
    storyId: storyId,
    message: '投稿已提交，审核通过后会展示。',
  };
}

function buildError(code, message) {
  return {
    ok: false,
    error: {
      code: code,
      message: message,
    },
  };
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalCoordinate(value) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new SubmitStoryError('INVALID_INPUT', '地点坐标格式不正确');
  }

  return numericValue;
}

function validateLength(value, maxLength, fieldLabel) {
  if (value.length > maxLength) {
    throw new SubmitStoryError('INVALID_INPUT', fieldLabel + '长度不能超过 ' + maxLength + ' 个字符');
  }
}

function buildSummary(content) {
  const normalized = trimString(content).replace(/\s+/g, ' ');

  if (normalized.length <= SUMMARY_MAX_LENGTH) {
    return normalized;
  }

  return normalized.slice(0, SUMMARY_MAX_LENGTH) + '...';
}

function validatePlaceSnapshot(placeSnapshot) {
  if (!placeSnapshot || typeof placeSnapshot !== 'object') {
    throw new SubmitStoryError('INVALID_INPUT', 'placeSnapshot 缺失');
  }

  const name = trimString(placeSnapshot.name);

  if (!name) {
    throw new SubmitStoryError('INVALID_INPUT', 'placeSnapshot.name 不能为空');
  }

  const latitude = normalizeOptionalCoordinate(placeSnapshot.latitude);
  const longitude = normalizeOptionalCoordinate(placeSnapshot.longitude);

  return {
    name: name,
    address: trimString(placeSnapshot.address),
    latitude: latitude,
    longitude: longitude,
    poiid: trimString(placeSnapshot.poiid),
  };
}

function validateEvent(event) {
  const isTemporary = !!(event && event.isTemporary);
  const rawLocationId = event ? event.locationId : null;
  const locationId = typeof rawLocationId === 'string' ? trimString(rawLocationId) : '';
  const title = trimString(event && event.title);
  const content = trimString(event && event.content);
  const placeSnapshot = validatePlaceSnapshot(event && event.placeSnapshot);

  if (isTemporary) {
    if (rawLocationId !== null) {
      throw new SubmitStoryError('INVALID_INPUT', '临时地点投稿时 locationId 必须为 null');
    }
  } else if (!locationId || locationId.toLowerCase() === 'null') {
    throw new SubmitStoryError('INVALID_INPUT', 'locationId 必须是有效的正式地点 ID');
  }

  if (!title) {
    throw new SubmitStoryError('INVALID_INPUT', '标题不能为空');
  }

  if (!content) {
    throw new SubmitStoryError('INVALID_INPUT', '正文不能为空');
  }

  if (!isTemporary) {
    validateLength(locationId, 128, 'locationId');
  }
  validateLength(title, TITLE_MAX_LENGTH, '标题');
  validateLength(content, CONTENT_MAX_LENGTH, '正文');

  return {
    locationId: isTemporary ? null : locationId,
    isTemporary: isTemporary,
    placeSnapshot: placeSnapshot,
    title: title,
    content: content,
  };
}

async function ensureLocationExists(locationId) {
  if (!db) {
    throw new SubmitStoryError('SYSTEM_ERROR', '投稿服务暂时不可用');
  }

  try {
    const result = await db.collection(LOCATIONS_COLLECTION).doc(locationId).get();

    if (!result || !result.data) {
      throw new SubmitStoryError('LOCATION_NOT_FOUND', '当前地点不存在或暂时不可投稿');
    }

    return result.data;
  } catch (error) {
    if (error instanceof SubmitStoryError) {
      throw error;
    }

    throw new SubmitStoryError('LOCATION_NOT_FOUND', '当前地点不存在或暂时不可投稿');
  }
}

async function createTravelerStory(input, openId) {
  if (!db) {
    throw new SubmitStoryError('SYSTEM_ERROR', '投稿服务暂时不可用');
  }

  const result = await db.collection(STORIES_COLLECTION).add({
    data: {
      locationId: input.locationId,
      isTemporary: !!input.isTemporary,
      placeSnapshot: input.placeSnapshot,
      title: input.title,
      summary: buildSummary(input.content),
      content: input.content,
      type: 'traveler',
      source: 'user',
      status: 'pending',
      language: 'zh-CN',
      authorId: openId,
      createdAt: db.serverDate(),
    },
  });

  return result && result._id ? result._id : '';
}

exports.main = async function main(event) {
  try {
    const input = validateEvent(event);
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new SubmitStoryError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试');
    }

    if (!input.isTemporary) {
      await ensureLocationExists(input.locationId);
    }

    const storyId = await createTravelerStory(input, openId);

    if (!storyId) {
      throw new SubmitStoryError('SYSTEM_ERROR', '投稿提交失败，请稍后再试');
    }

    return buildSuccess(storyId);
  } catch (error) {
    if (error instanceof SubmitStoryError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[submitStory] Unexpected error', error);
    return buildError('SYSTEM_ERROR', '投稿提交失败，请稍后再试');
  }
};

module.exports._private = {
  buildSummary: buildSummary,
  validateEvent: validateEvent,
};
