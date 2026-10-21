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
const _ = db && db.command ? db.command : null;
const STORIES_COLLECTION = 'stories';
const ADMIN_LOGIN_SECRET_ENV = 'ADMIN_LOGIN_SECRET';
const TOKEN_VERSION = 'adminv1';
const ACTION_REVIEWER_NAME = '管理员';
const ALLOWED_ACTIONS = {
  approve: true,
  reject: true,
  hide: true,
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  FORBIDDEN: true,
  TOKEN_EXPIRED: true,
  STORY_NOT_FOUND: true,
  STATUS_CHANGED: true,
  ACTION_NOT_ALLOWED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class AdminReviewStoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminReviewStoryError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSuccess(payload) {
  return Object.assign({
    ok: true,
  }, payload);
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
    throw new AdminReviewStoryError('INTERNAL_ERROR', '管理员服务尚未配置，请先设置 ADMIN_LOGIN_SECRET。');
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
    throw new AdminReviewStoryError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  if (signPayload(tokenParts[1], adminSecret) !== tokenParts[2]) {
    throw new AdminReviewStoryError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  let payload = null;

  try {
    payload = JSON.parse(decodeBase64Url(tokenParts[1]));
  } catch (error) {
    throw new AdminReviewStoryError('FORBIDDEN', '管理员会话无效，请重新登录。');
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
    throw new AdminReviewStoryError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  if (!Number.isFinite(expiresAt) || expiresAt <= currentNow) {
    throw new AdminReviewStoryError('TOKEN_EXPIRED', '管理员会话已过期，请重新登录。');
  }

  return {
    reviewerId: reviewerId,
    expiresAt: expiresAt,
  };
}

function validateStoryId(event) {
  const storyId = trimString(event && event.storyId);

  if (!storyId) {
    throw new AdminReviewStoryError('INVALID_INPUT', 'storyId 不能为空。');
  }

  if (storyId.length > 128) {
    throw new AdminReviewStoryError('INVALID_INPUT', 'storyId 格式无效。');
  }

  return storyId;
}

function validateReason(action, reason) {
  const normalizedReason = trimString(reason);

  if ((action === 'reject' || action === 'hide') && !normalizedReason) {
    throw new AdminReviewStoryError('INVALID_INPUT', '打回或下架时必须填写原因。');
  }

  if (normalizedReason.length > 200) {
    throw new AdminReviewStoryError('INVALID_INPUT', '审核原因不能超过 200 个字符。');
  }

  return normalizedReason;
}

function resolveAction(action, expectedStatus, reason) {
  const normalizedAction = trimString(action);
  const normalizedExpectedStatus = trimString(expectedStatus);
  const normalizedReason = validateReason(normalizedAction, reason);

  if (!ALLOWED_ACTIONS[normalizedAction]) {
    throw new AdminReviewStoryError('INVALID_INPUT', '审核动作无效。');
  }

  if (normalizedAction === 'approve') {
    if (normalizedExpectedStatus !== 'pending') {
      throw new AdminReviewStoryError('ACTION_NOT_ALLOWED', '只有待审核投稿才能通过。');
    }

    return {
      action: normalizedAction,
      expectedStatus: normalizedExpectedStatus,
      newStatus: 'published',
      reason: '',
    };
  }

  if (normalizedAction === 'reject') {
    if (normalizedExpectedStatus !== 'pending') {
      throw new AdminReviewStoryError('ACTION_NOT_ALLOWED', '只有待审核投稿才能打回。');
    }

    return {
      action: normalizedAction,
      expectedStatus: normalizedExpectedStatus,
      newStatus: 'rejected',
      reason: normalizedReason,
    };
  }

  if (normalizedExpectedStatus !== 'published') {
    throw new AdminReviewStoryError('ACTION_NOT_ALLOWED', '只有已通过投稿才能下架。');
  }

  return {
    action: normalizedAction,
    expectedStatus: normalizedExpectedStatus,
    newStatus: 'hidden',
    reason: normalizedReason,
  };
}

async function getStoryById(actor, storyId) {
  if (!actor) {
    throw new AdminReviewStoryError('INTERNAL_ERROR', '管理员审核服务暂时不可用。');
  }

  try {
    const result = await actor.collection(STORIES_COLLECTION).doc(storyId).get();
    const story = result && result.data ? result.data : null;

    if (!story) {
      throw new AdminReviewStoryError('STORY_NOT_FOUND', '当前投稿不存在。');
    }

    if (trimString(story.source) !== 'user' || trimString(story.type) !== 'traveler') {
      throw new AdminReviewStoryError('FORBIDDEN', '当前内容不属于可审核的网友投稿。');
    }

    return story;
  } catch (error) {
    if (error instanceof AdminReviewStoryError) {
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
      throw new AdminReviewStoryError('STORY_NOT_FOUND', '当前投稿不存在。');
    }

    throw new AdminReviewStoryError('DATABASE_ERROR', '投稿读取失败，请稍后再试。');
  }
}

function buildClearField(command) {
  if (command && typeof command.remove === 'function') {
    return command.remove();
  }

  return null;
}

function buildReviewUpdateData(actor, command, transition, authInfo) {
  const clearField = buildClearField(command);
  const serverDate = actor && typeof actor.serverDate === 'function'
    ? actor.serverDate.bind(actor)
    : function fallbackServerDate() {
      return new Date();
    };
  const updateData = {
    status: transition.newStatus,
    reviewedAt: serverDate(),
    reviewerId: authInfo.reviewerId,
    reviewerName: ACTION_REVIEWER_NAME,
    updatedAt: serverDate(),
    moderationStatus: 'manual_only',
    manualReviewRequired: false,
    moderationProvider: null,
    moderationResult: null,
    moderationReason: transition.reason || null,
  };

  if (transition.action === 'reject') {
    updateData.rejectionReason = transition.reason;
    return updateData;
  }

  updateData.rejectionReason = clearField;
  return updateData;
}

async function updateStoryWithExpectedStatus(actor, command, options) {
  const updateData = buildReviewUpdateData(actor, command, options.transition, options.authInfo);

  try {
    const result = await actor.collection(STORIES_COLLECTION).where({
      _id: options.storyId,
      source: 'user',
      type: 'traveler',
      status: options.transition.expectedStatus,
    }).update({
      data: updateData,
    });
    const updatedCount = Number(
      result && result.stats && typeof result.stats.updated !== 'undefined'
        ? result.stats.updated
        : 0
    );

    if (updatedCount < 1) {
      throw new AdminReviewStoryError('STATUS_CHANGED', '投稿状态已变化，请刷新后重试。');
    }
  } catch (error) {
    if (error instanceof AdminReviewStoryError) {
      throw error;
    }

    throw new AdminReviewStoryError('DATABASE_ERROR', '审核提交失败，请稍后再试。');
  }
}

function assertStoryCanTransition(story, transition) {
  const currentStatus = trimString(story && story.status);

  if (currentStatus === 'deleted') {
    throw new AdminReviewStoryError('STATUS_CHANGED', '投稿状态已变化，请刷新后重试。');
  }

  if (currentStatus !== transition.expectedStatus) {
    throw new AdminReviewStoryError('STATUS_CHANGED', '投稿状态已变化，请刷新后重试。');
  }

  if (currentStatus === transition.newStatus) {
    throw new AdminReviewStoryError('ACTION_NOT_ALLOWED', '当前状态无需重复执行该操作。');
  }
}

exports.main = async function main(event) {
  try {
    const adminSecret = getAdminSecret();
    const authInfo = verifyAdminToken(event && event.token, adminSecret);
    const storyId = validateStoryId(event);
    const transition = resolveAction(event && event.action, event && event.expectedStatus, event && event.reason);
    const story = await getStoryById(db, storyId);

    assertStoryCanTransition(story, transition);
    await updateStoryWithExpectedStatus(db, _, {
      storyId: storyId,
      transition: transition,
      authInfo: authInfo,
    });

    return buildSuccess({
      storyId: storyId,
      oldStatus: transition.expectedStatus,
      newStatus: transition.newStatus,
      reviewedAt: new Date().toISOString(),
      reviewerId: authInfo.reviewerId,
    });
  } catch (error) {
    if (error instanceof AdminReviewStoryError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[adminReviewStory] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '审核提交失败，请稍后再试。');
  }
};

module.exports._private = {
  ACTION_REVIEWER_NAME: ACTION_REVIEWER_NAME,
  ALLOWED_ACTIONS: ALLOWED_ACTIONS,
  assertStoryCanTransition: assertStoryCanTransition,
  buildReviewUpdateData: buildReviewUpdateData,
  createReviewerId: createReviewerId,
  getAdminSecret: getAdminSecret,
  getStoryById: getStoryById,
  resolveAction: resolveAction,
  signPayload: signPayload,
  updateStoryWithExpectedStatus: updateStoryWithExpectedStatus,
  validateReason: validateReason,
  validateStoryId: validateStoryId,
  verifyAdminToken: verifyAdminToken,
};
