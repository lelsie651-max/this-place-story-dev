const crypto = require('crypto');

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
  };
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database ? cloud.database() : null;
const STORIES_COLLECTION = 'stories';
const LOCATIONS_COLLECTION = 'locations';
const ADMIN_LOGIN_SECRET_ENV = 'ADMIN_LOGIN_SECRET';
const TOKEN_VERSION = 'adminv1';
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  FORBIDDEN: true,
  TOKEN_EXPIRED: true,
  STORY_NOT_FOUND: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class AdminGetStoryByIdError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminGetStoryByIdError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSuccess(payload) {
  return {
    ok: true,
    story: payload,
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

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function getAdminSecret() {
  const secret = trimString(process.env[ADMIN_LOGIN_SECRET_ENV]);

  if (!secret) {
    throw new AdminGetStoryByIdError('INTERNAL_ERROR', '管理员服务尚未配置，请先设置 ADMIN_LOGIN_SECRET。');
  }

  return secret;
}

function createReviewerId(adminSecret) {
  return 'admin_' + crypto.createHash('sha256').update(adminSecret, 'utf8').digest('hex').slice(0, 12);
}

function signPayload(payloadText, adminSecret) {
  return crypto.createHmac('sha256', adminSecret).update(payloadText, 'utf8').digest('hex');
}

function verifyAdminToken(token, adminSecret, nowMs) {
  const normalizedToken = trimString(token);
  const tokenParts = normalizedToken.split('.');

  if (tokenParts.length !== 3 || tokenParts[0] !== TOKEN_VERSION) {
    throw new AdminGetStoryByIdError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  if (signPayload(tokenParts[1], adminSecret) !== tokenParts[2]) {
    throw new AdminGetStoryByIdError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  let payload = null;

  try {
    payload = JSON.parse(decodeBase64Url(tokenParts[1]));
  } catch (error) {
    throw new AdminGetStoryByIdError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  const reviewerId = trimString(payload && payload.reviewerId);
  const expiresAt = Number(payload && payload.expiresAt);
  const currentNow = typeof nowMs === 'number' ? nowMs : Date.now();

  if (
    !payload
    || payload.version !== TOKEN_VERSION
    || payload.scope !== 'admin_review'
    || reviewerId !== createReviewerId(adminSecret)
  ) {
    throw new AdminGetStoryByIdError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  if (!Number.isFinite(expiresAt) || expiresAt <= currentNow) {
    throw new AdminGetStoryByIdError('TOKEN_EXPIRED', '管理员会话已过期，请重新登录。');
  }

  return {
    reviewerId: reviewerId,
    expiresAt: expiresAt,
  };
}

function validateStoryId(event) {
  const storyId = trimString(event && event.storyId);

  if (!storyId) {
    throw new AdminGetStoryByIdError('INVALID_INPUT', 'storyId 不能为空。');
  }

  if (storyId.length > 128) {
    throw new AdminGetStoryByIdError('INVALID_INPUT', 'storyId 格式无效。');
  }

  return storyId;
}

function buildAuthorDisplayId(authorId) {
  const normalized = trimString(authorId);

  if (!normalized) {
    return '投稿者#未知';
  }

  return '投稿者#' + crypto.createHash('sha1').update(normalized, 'utf8').digest('hex').slice(0, 8);
}

function getAdminStatusLabel(status) {
  if (status === 'published') {
    return '已通过';
  }

  if (status === 'rejected') {
    return '已打回';
  }

  if (status === 'hidden') {
    return '已下架';
  }

  if (status === 'deleted') {
    return '已删除';
  }

  return '待人工审核';
}

function normalizeModerationStatus(value) {
  return trimString(value) || 'manual_only';
}

function normalizeManualReviewRequired(value) {
  return typeof value === 'boolean' ? value : true;
}

async function getStoryById(actor, storyId) {
  if (!actor) {
    throw new AdminGetStoryByIdError('INTERNAL_ERROR', '管理员详情服务暂时不可用。');
  }

  try {
    const result = await actor.collection(STORIES_COLLECTION).doc(storyId).get();
    const story = result && result.data ? result.data : null;

    if (!story) {
      throw new AdminGetStoryByIdError('STORY_NOT_FOUND', '当前投稿不存在。');
    }

    if (trimString(story.source) !== 'user' || trimString(story.type) !== 'traveler') {
      throw new AdminGetStoryByIdError('FORBIDDEN', '当前内容不属于可审核的网友投稿。');
    }

    if (trimString(story.status) === 'deleted') {
      throw new AdminGetStoryByIdError('STORY_NOT_FOUND', '当前投稿不存在。');
    }

    return story;
  } catch (error) {
    if (error instanceof AdminGetStoryByIdError) {
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
      throw new AdminGetStoryByIdError('STORY_NOT_FOUND', '当前投稿不存在。');
    }

    throw new AdminGetStoryByIdError('DATABASE_ERROR', '投稿详情读取失败，请稍后再试。');
  }
}

async function getLocationName(actor, locationId) {
  const normalizedLocationId = trimString(locationId);

  if (!actor || !normalizedLocationId) {
    return '';
  }

  try {
    const result = await actor.collection(LOCATIONS_COLLECTION).doc(normalizedLocationId).get();
    return trimString(result && result.data && result.data.name);
  } catch (error) {
    return '';
  }
}

async function normalizeStoryDetail(actor, doc) {
  const placeSnapshot = doc && doc.placeSnapshot && typeof doc.placeSnapshot === 'object'
    ? doc.placeSnapshot
    : null;
  const locationId = trimString(doc && doc.locationId);
  const locationName = trimString(placeSnapshot && placeSnapshot.name) || await getLocationName(actor, locationId);
  const status = trimString(doc && doc.status) || 'pending';

  return {
    storyId: trimString(doc && doc._id),
    title: trimString(doc && doc.title),
    summary: trimString(doc && doc.summary),
    content: trimString(doc && doc.content),
    locationName: locationName,
    placeSnapshot: placeSnapshot,
    locationId: locationId || null,
    isTemporary: !!(doc && doc.isTemporary),
    authorDisplayId: buildAuthorDisplayId(doc && doc.authorId),
    status: status,
    statusLabel: getAdminStatusLabel(status),
    moderationStatus: normalizeModerationStatus(doc && doc.moderationStatus),
    manualReviewRequired: normalizeManualReviewRequired(doc && doc.manualReviewRequired),
    moderationProvider: doc && Object.prototype.hasOwnProperty.call(doc, 'moderationProvider')
      ? doc.moderationProvider
      : null,
    moderationResult: doc && Object.prototype.hasOwnProperty.call(doc, 'moderationResult')
      ? doc.moderationResult
      : null,
    moderationReason: doc && Object.prototype.hasOwnProperty.call(doc, 'moderationReason')
      ? doc.moderationReason
      : null,
    rejectionReason: trimString(doc && doc.rejectionReason),
    createdAt: typeof (doc && doc.createdAt) === 'undefined' ? null : doc.createdAt,
    updatedAt: typeof (doc && doc.updatedAt) === 'undefined' ? null : doc.updatedAt,
    reviewedAt: typeof (doc && doc.reviewedAt) === 'undefined' ? null : doc.reviewedAt,
    reviewerId: trimString(doc && doc.reviewerId),
    reviewerName: trimString(doc && doc.reviewerName),
  };
}

exports.main = async function main(event) {
  try {
    const adminSecret = getAdminSecret();

    verifyAdminToken(event && event.token, adminSecret);

    const storyId = validateStoryId(event);
    const story = await getStoryById(db, storyId);

    return buildSuccess(await normalizeStoryDetail(db, story));
  } catch (error) {
    if (error instanceof AdminGetStoryByIdError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[adminGetStoryById] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '投稿详情读取失败，请稍后再试。');
  }
};

module.exports._private = {
  buildAuthorDisplayId: buildAuthorDisplayId,
  createReviewerId: createReviewerId,
  getAdminSecret: getAdminSecret,
  getAdminStatusLabel: getAdminStatusLabel,
  getLocationName: getLocationName,
  getStoryById: getStoryById,
  normalizeManualReviewRequired: normalizeManualReviewRequired,
  normalizeModerationStatus: normalizeModerationStatus,
  normalizeStoryDetail: normalizeStoryDetail,
  signPayload: signPayload,
  validateStoryId: validateStoryId,
  verifyAdminToken: verifyAdminToken,
};
