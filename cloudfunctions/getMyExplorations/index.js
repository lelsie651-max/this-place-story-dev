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
const EXPLORATIONS_COLLECTION = 'explorations';
const MAX_QUERY_LIMIT = 100;
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  UNAUTHORIZED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class GetMyExplorationsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GetMyExplorationsError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSuccess(items) {
  return {
    ok: true,
    items: items,
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

function validateEvent(event) {
  if (event && typeof event === 'object' && typeof event.userId !== 'undefined') {
    throw new GetMyExplorationsError('INVALID_INPUT', '足迹查询不接受前端 userId。');
  }

  return {};
}

function normalizeExplorationDoc(doc) {
  return {
    _id: trimString(doc && doc._id),
    userId: trimString(doc && doc.userId),
    locationId: trimString(doc && doc.locationId),
    locationName: trimString(doc && doc.locationName),
    storyType: trimString(doc && doc.storyType),
    lastExploredAt: doc && doc.lastExploredAt ? doc.lastExploredAt : null,
    createdAt: doc && doc.createdAt ? doc.createdAt : null,
    updatedAt: doc && doc.updatedAt ? doc.updatedAt : null,
  };
}

async function listExplorationsByUser(actor, openId, limit) {
  if (!actor) {
    throw new GetMyExplorationsError('INTERNAL_ERROR', '足迹读取服务暂时不可用。');
  }

  try {
    const result = await actor
      .collection(EXPLORATIONS_COLLECTION)
      .where({
        userId: openId,
      })
      .orderBy('lastExploredAt', 'desc')
      .limit(limit)
      .get();
    const items = result && Array.isArray(result.data) ? result.data : [];

    return items.map(normalizeExplorationDoc);
  } catch (error) {
    throw new GetMyExplorationsError('DATABASE_ERROR', '足迹读取失败，请稍后再试。');
  }
}

exports.main = async function main(event) {
  try {
    validateEvent(event);

    if (!db) {
      throw new GetMyExplorationsError('INTERNAL_ERROR', '足迹读取服务暂时不可用。');
    }

    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new GetMyExplorationsError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试。');
    }

    return buildSuccess(await listExplorationsByUser(db, openId, MAX_QUERY_LIMIT));
  } catch (error) {
    if (error instanceof GetMyExplorationsError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[getMyExplorations] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '足迹读取失败，请稍后再试。');
  }
};

module.exports._private = {
  listExplorationsByUser: listExplorationsByUser,
  normalizeExplorationDoc: normalizeExplorationDoc,
  validateEvent: validateEvent,
};
