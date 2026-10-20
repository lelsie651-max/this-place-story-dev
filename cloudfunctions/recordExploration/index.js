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
const LOCATIONS_COLLECTION = 'locations';
const MAX_LOCATION_ID_LENGTH = 128;
const MAX_LOCATION_NAME_LENGTH = 80;
const ALLOWED_STORY_TYPES = {
  folk: true,
  ai_comment: true,
  traveler: true,
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  UNAUTHORIZED: true,
  LOCATION_NOT_FOUND: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class RecordExplorationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RecordExplorationError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createDigest(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}

function buildSuccess(result) {
  return Object.assign({
    ok: true,
  }, result);
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

function getServerDateValue(database) {
  if (database && typeof database.serverDate === 'function') {
    return database.serverDate();
  }

  return new Date();
}

function validateEvent(event) {
  const payload = event && typeof event === 'object' ? event : {};
  const locationId = trimString(payload.locationId);
  const locationName = trimString(payload.locationName);
  const storyType = trimString(payload.storyType);

  if (typeof payload.userId !== 'undefined') {
    throw new RecordExplorationError('INVALID_INPUT', '足迹记录不接受前端 userId。');
  }

  if (payload && payload.isTemporary === true) {
    throw new RecordExplorationError('INVALID_INPUT', '临时地点暂不记录足迹。');
  }

  if (!locationId || locationId.toLowerCase() === 'null' || locationId.indexOf('temporary:') === 0) {
    throw new RecordExplorationError('INVALID_INPUT', '正式地点缺少有效 locationId。');
  }

  if (locationId.length > MAX_LOCATION_ID_LENGTH) {
    throw new RecordExplorationError('INVALID_INPUT', 'locationId 长度超出限制。');
  }

  if (!locationName) {
    throw new RecordExplorationError('INVALID_INPUT', '正式地点缺少有效地点名称。');
  }

  if (locationName.length > MAX_LOCATION_NAME_LENGTH) {
    throw new RecordExplorationError('INVALID_INPUT', '地点名称长度超出限制。');
  }

  if (!ALLOWED_STORY_TYPES[storyType]) {
    throw new RecordExplorationError('INVALID_INPUT', '故事类型无效，暂时无法记录足迹。');
  }

  return {
    locationId: locationId,
    locationName: locationName,
    storyType: storyType,
  };
}

function createExplorationId(openId, locationId, storyType) {
  return 'exp_' + createDigest([
    trimString(openId),
    trimString(locationId),
    trimString(storyType),
  ].join('|'));
}

async function safeGetDocument(actor, collectionName, docId) {
  try {
    const result = await actor.collection(collectionName).doc(docId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    const message = error && error.message ? String(error.message) : '';

    if (message.indexOf('document.get:fail') !== -1 || message.indexOf('not found') !== -1) {
      return null;
    }

    throw error;
  }
}

async function ensureLocationExists(actor, locationId) {
  if (!locationId) {
    throw new RecordExplorationError('INVALID_INPUT', '正式地点缺少有效 locationId。');
  }

  try {
    const result = await actor.collection(LOCATIONS_COLLECTION).doc(locationId).get();

    if (!result || !result.data) {
      throw new RecordExplorationError('LOCATION_NOT_FOUND', '当前地点不存在，暂时无法记录足迹。');
    }

    return result.data;
  } catch (error) {
    if (error instanceof RecordExplorationError) {
      throw error;
    }

    const message = error && error.message ? String(error.message) : '';

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new RecordExplorationError('DATABASE_ERROR', '足迹写入权限异常，请检查云开发配置。');
    }

    throw new RecordExplorationError('LOCATION_NOT_FOUND', '当前地点不存在，暂时无法记录足迹。');
  }
}

function normalizeExplorationDoc(doc) {
  return {
    _id: doc._id || '',
    userId: trimString(doc.userId),
    locationId: trimString(doc.locationId),
    locationName: trimString(doc.locationName),
    storyType: trimString(doc.storyType),
    lastExploredAt: doc.lastExploredAt || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

async function upsertExplorationWithActor(actor, database, openId, input) {
  try {
    const explorationId = createExplorationId(openId, input.locationId, input.storyType);
    const existingDoc = await safeGetDocument(actor, EXPLORATIONS_COLLECTION, explorationId);
    const serverDate = getServerDateValue(database);

    if (existingDoc) {
      await actor.collection(EXPLORATIONS_COLLECTION).doc(explorationId).update({
        data: {
          lastExploredAt: serverDate,
          updatedAt: serverDate,
        },
      });
    } else {
      await actor.collection(EXPLORATIONS_COLLECTION).doc(explorationId).set({
        data: {
          userId: openId,
          locationId: input.locationId,
          locationName: input.locationName,
          storyType: input.storyType,
          lastExploredAt: serverDate,
          createdAt: serverDate,
          updatedAt: serverDate,
        },
      });
    }

    const savedDoc = await safeGetDocument(actor, EXPLORATIONS_COLLECTION, explorationId);

    if (!savedDoc) {
      throw new RecordExplorationError('DATABASE_ERROR', '足迹写入失败，请稍后再试。');
    }

    return {
      explorationId: explorationId,
      created: !existingDoc,
      item: normalizeExplorationDoc(Object.assign({
        _id: explorationId,
      }, savedDoc)),
    };
  } catch (error) {
    if (error instanceof RecordExplorationError) {
      throw error;
    }

    throw new RecordExplorationError('DATABASE_ERROR', '足迹写入失败，请稍后再试。');
  }
}

exports.main = async function main(event) {
  try {
    if (!db) {
      throw new RecordExplorationError('INTERNAL_ERROR', '足迹记录服务暂时不可用。');
    }

    const input = validateEvent(event);
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new RecordExplorationError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试。');
    }

    await ensureLocationExists(db, input.locationId);

    return buildSuccess(await upsertExplorationWithActor(db, db, openId, input));
  } catch (error) {
    if (error instanceof RecordExplorationError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[recordExploration] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '足迹记录失败，请稍后再试。');
  }
};

module.exports._private = {
  createExplorationId: createExplorationId,
  ensureLocationExists: ensureLocationExists,
  normalizeExplorationDoc: normalizeExplorationDoc,
  safeGetDocument: safeGetDocument,
  upsertExplorationWithActor: upsertExplorationWithActor,
  validateEvent: validateEvent,
};
