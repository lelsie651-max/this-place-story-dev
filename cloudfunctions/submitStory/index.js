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
const _ = db && db.command ? db.command : null;
const LOCATIONS_COLLECTION = 'locations';
const STORIES_COLLECTION = 'stories';
const TITLE_MAX_LENGTH = 40;
const CONTENT_MAX_LENGTH = 2000;
const SUMMARY_MAX_LENGTH = 80;
const EDITABLE_STATUSES = {
  pending: true,
  rejected: true,
};
const REVIEW_FIELD_CLEAR_NAMES = [
  'rejectionReason',
  'reviewedAt',
  'reviewerId',
  'reviewerName',
  'reviewReason',
  'moderationNote',
  'moderationCheckedAt',
  'moderationRiskLevel',
];
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  LOCATION_NOT_FOUND: true,
  UNAUTHORIZED: true,
  STORY_NOT_FOUND: true,
  FORBIDDEN: true,
  STATUS_NOT_EDITABLE: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class SubmitStoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SubmitStoryError';
    this.code = code;
  }
}

function buildSuccess(storyId, options) {
  const normalizedOptions = options && typeof options === 'object' ? options : {};

  return {
    ok: true,
    storyId: storyId,
    status: 'pending',
    updated: !!normalizedOptions.updated,
    message: normalizedOptions.message || '投稿已提交，审核通过后会展示。',
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

function buildManualModerationFields() {
  return {
    moderationStatus: 'manual_only',
    manualReviewRequired: true,
    moderationProvider: null,
    moderationResult: null,
    moderationReason: null,
  };
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

function validateStoryContentInput(event) {
  const title = trimString(event && event.title);
  const content = trimString(event && event.content);

  if (!title) {
    throw new SubmitStoryError('INVALID_INPUT', '标题不能为空');
  }

  if (!content) {
    throw new SubmitStoryError('INVALID_INPUT', '正文不能为空');
  }

  validateLength(title, TITLE_MAX_LENGTH, '标题');
  validateLength(content, CONTENT_MAX_LENGTH, '正文');

  return {
    title: title,
    content: content,
  };
}

function validateCreateEvent(event) {
  const isTemporary = !!(event && event.isTemporary);
  const rawLocationId = event ? event.locationId : null;
  const locationId = typeof rawLocationId === 'string' ? trimString(rawLocationId) : '';
  const placeSnapshot = validatePlaceSnapshot(event && event.placeSnapshot);
  const storyContentInput = validateStoryContentInput(event);

  if (isTemporary) {
    if (rawLocationId !== null) {
      throw new SubmitStoryError('INVALID_INPUT', '临时地点投稿时 locationId 必须为 null');
    }
  } else if (!locationId || locationId.toLowerCase() === 'null') {
    throw new SubmitStoryError('INVALID_INPUT', 'locationId 必须是有效的正式地点 ID');
  }

  if (!isTemporary) {
    validateLength(locationId, 128, 'locationId');
  }

  return {
    locationId: isTemporary ? null : locationId,
    isTemporary: isTemporary,
    placeSnapshot: placeSnapshot,
    title: storyContentInput.title,
    content: storyContentInput.content,
  };
}

function validateEditEvent(event) {
  const storyId = trimString(event && event.storyId);
  const storyContentInput = validateStoryContentInput(event);

  if (!storyId) {
    throw new SubmitStoryError('INVALID_INPUT', 'storyId 不能为空');
  }

  validateLength(storyId, 128, 'storyId');

  return {
    storyId: storyId,
    title: storyContentInput.title,
    content: storyContentInput.content,
  };
}

async function ensureLocationExistsWithActor(actor, locationId) {
  if (!actor) {
    throw new SubmitStoryError('INTERNAL_ERROR', '投稿服务暂时不可用');
  }

  try {
    const result = await actor.collection(LOCATIONS_COLLECTION).doc(locationId).get();

    if (!result || !result.data) {
      throw new SubmitStoryError('LOCATION_NOT_FOUND', '当前地点不存在或暂时不可投稿');
    }

    return result.data;
  } catch (error) {
    if (error instanceof SubmitStoryError) {
      throw error;
    }

    const message = error && error.message ? String(error.message) : '';

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new SubmitStoryError('DATABASE_ERROR', '投稿写入权限异常，请检查云开发配置');
    }

    throw new SubmitStoryError('LOCATION_NOT_FOUND', '当前地点不存在或暂时不可投稿');
  }
}

async function createTravelerStoryWithActor(actor, input, openId) {
  if (!actor) {
    throw new SubmitStoryError('INTERNAL_ERROR', '投稿服务暂时不可用');
  }

  try {
    const result = await actor.collection(STORIES_COLLECTION).add({
      data: Object.assign({
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
        createdAt: actor.serverDate(),
      }, buildManualModerationFields()),
    });

    return result && result._id ? result._id : '';
  } catch (error) {
    const message = error && error.message ? String(error.message) : '';

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new SubmitStoryError('DATABASE_ERROR', '投稿写入权限异常，请检查云开发配置');
    }

    throw new SubmitStoryError('DATABASE_ERROR', '投稿写入失败，请稍后再试');
  }
}

async function getTravelerStoryByIdWithActor(actor, storyId) {
  if (!actor) {
    throw new SubmitStoryError('INTERNAL_ERROR', '投稿服务暂时不可用');
  }

  try {
    const result = await actor.collection(STORIES_COLLECTION).doc(storyId).get();

    if (!result || !result.data) {
      throw new SubmitStoryError('STORY_NOT_FOUND', '当前投稿不存在或已不可编辑');
    }

    return result.data;
  } catch (error) {
    if (error instanceof SubmitStoryError) {
      throw error;
    }

    const message = error && error.message ? String(error.message) : '';

    if (
      message.indexOf('does not exist') !== -1
      || message.indexOf('non-existent') !== -1
      || message.indexOf('document.get:fail') !== -1
      || message.indexOf('not exist') !== -1
      || message.indexOf('not found') !== -1
    ) {
      throw new SubmitStoryError('STORY_NOT_FOUND', '当前投稿不存在或已不可编辑');
    }

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new SubmitStoryError('DATABASE_ERROR', '投稿写入权限异常，请检查云开发配置');
    }

    throw new SubmitStoryError('DATABASE_ERROR', '投稿读取失败，请稍后再试');
  }
}

function assertEditableTravelerStory(doc, openId) {
  const normalizedOpenId = trimString(openId);

  if (!doc || typeof doc !== 'object') {
    throw new SubmitStoryError('STORY_NOT_FOUND', '当前投稿不存在或已不可编辑');
  }

  if (trimString(doc.source) !== 'user' || trimString(doc.type) !== 'traveler') {
    throw new SubmitStoryError('FORBIDDEN', '当前投稿暂不支持编辑');
  }

  if (trimString(doc.authorId) !== normalizedOpenId) {
    throw new SubmitStoryError('FORBIDDEN', '当前投稿暂不支持编辑');
  }

  if (!EDITABLE_STATUSES[trimString(doc.status)]) {
    throw new SubmitStoryError('STATUS_NOT_EDITABLE', '当前状态暂不支持编辑');
  }

  return doc;
}

function buildReviewFieldClearData(command) {
  if (!command || typeof command.remove !== 'function') {
    throw new SubmitStoryError('INTERNAL_ERROR', '投稿服务暂时不可用');
  }

  return REVIEW_FIELD_CLEAR_NAMES.reduce(function assignField(result, fieldName) {
    result[fieldName] = command.remove();
    return result;
  }, {});
}

async function updateTravelerStoryWithActor(actor, command, storyId, input) {
  if (!actor) {
    throw new SubmitStoryError('INTERNAL_ERROR', '投稿服务暂时不可用');
  }

  const reviewFieldClearData = buildReviewFieldClearData(command);

  try {
    await actor.collection(STORIES_COLLECTION).doc(storyId).update({
      data: Object.assign({
        title: input.title,
        summary: buildSummary(input.content),
        content: input.content,
        status: 'pending',
        updatedAt: actor.serverDate(),
      }, buildManualModerationFields(), reviewFieldClearData),
    });
  } catch (error) {
    const message = error && error.message ? String(error.message) : '';

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new SubmitStoryError('DATABASE_ERROR', '投稿写入权限异常，请检查云开发配置');
    }

    throw new SubmitStoryError('DATABASE_ERROR', '投稿写入失败，请稍后再试');
  }
}

exports.main = async function main(event) {
  try {
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new SubmitStoryError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试');
    }

    const storyId = trimString(event && event.storyId);

    if (storyId) {
      const input = validateEditEvent(event);
      const existingStory = await getTravelerStoryByIdWithActor(db, input.storyId);

      assertEditableTravelerStory(existingStory, openId);
      await updateTravelerStoryWithActor(db, _, input.storyId, input);

      return buildSuccess(input.storyId, {
        updated: true,
        message: '修改已提交，审核通过后会展示。',
      });
    }

    const input = validateCreateEvent(event);

    if (!input.isTemporary) {
      await ensureLocationExistsWithActor(db, input.locationId);
    }

    const createdStoryId = await createTravelerStoryWithActor(db, input, openId);

    if (!createdStoryId) {
      throw new SubmitStoryError('DATABASE_ERROR', '投稿写入失败，请稍后再试');
    }

    return buildSuccess(createdStoryId);
  } catch (error) {
    if (error instanceof SubmitStoryError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[submitStory] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '投稿提交失败，请稍后再试');
  }
};

module.exports._private = {
  EDITABLE_STATUSES: EDITABLE_STATUSES,
  REVIEW_FIELD_CLEAR_NAMES: REVIEW_FIELD_CLEAR_NAMES,
  buildSummary: buildSummary,
  buildManualModerationFields: buildManualModerationFields,
  validateCreateEvent: validateCreateEvent,
  validateEditEvent: validateEditEvent,
  createTravelerStoryWithActor: createTravelerStoryWithActor,
  getTravelerStoryByIdWithActor: getTravelerStoryByIdWithActor,
  assertEditableTravelerStory: assertEditableTravelerStory,
  updateTravelerStoryWithActor: updateTravelerStoryWithActor,
  buildReviewFieldClearData: buildReviewFieldClearData,
};
