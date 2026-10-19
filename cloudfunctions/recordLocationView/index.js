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
const command = db && db.command ? db.command : {
  inc: function inc(value) {
    return {
      $inc: value,
    };
  },
};
const LOCATIONS_COLLECTION = 'locations';
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  LOCATION_NOT_FOUND: true,
  LOCATION_NOT_PUBLISHED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class RecordLocationViewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RecordLocationViewError';
    this.code = code;
  }
}

function buildSuccess(locationId, viewCount) {
  const normalizedViewCount = normalizeViewCount(viewCount);

  return {
    ok: true,
    locationId: locationId,
    viewCount: normalizedViewCount,
    isHot: normalizedViewCount > 1000,
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

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeViewCount(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.floor(numericValue);
}

function isTemporaryLocationId(locationId) {
  const normalizedLocationId = trimString(locationId).toLowerCase();

  return (
    normalizedLocationId.indexOf('temporary:') === 0
    || normalizedLocationId.indexOf('transient:') === 0
    || normalizedLocationId === 'temporary'
    || normalizedLocationId === 'transient'
  );
}

function validateEvent(event) {
  if (!isPlainObject(event)) {
    throw new RecordLocationViewError('INVALID_INPUT', '地点信息无效，请重新选择地点。');
  }

  const locationId = trimString(event.locationId);
  const lowerCaseLocationId = locationId.toLowerCase();

  if (!locationId || lowerCaseLocationId === 'null') {
    throw new RecordLocationViewError('INVALID_INPUT', '地点信息无效，请重新选择地点。');
  }

  if (isTemporaryLocationId(locationId)) {
    throw new RecordLocationViewError('INVALID_INPUT', '临时地点不参与推荐地点热度统计。');
  }

  return {
    locationId: locationId,
  };
}

function isMissingDocumentError(error) {
  const message = error && error.message ? String(error.message) : '';

  return (
    message.indexOf('does not exist') !== -1
    || message.indexOf('non-existent') !== -1
    || message.indexOf('document.get:fail') !== -1
    || message.indexOf('not exist') !== -1
  );
}

async function safeGetLocation(actor, locationId) {
  try {
    const result = await actor.collection(LOCATIONS_COLLECTION).doc(locationId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isMissingDocumentError(error)) {
      return null;
    }

    throw error;
  }
}

function buildDatabaseError() {
  return new RecordLocationViewError('DATABASE_ERROR', '地点热度统计暂时不可用，请稍后再试。');
}

async function incrementLocationView(actor, locationId) {
  const locationDoc = await safeGetLocation(actor, locationId);

  if (!locationDoc) {
    throw new RecordLocationViewError('LOCATION_NOT_FOUND', '当前地点不存在或已下线。');
  }

  if (trimString(locationDoc.status) !== 'published') {
    throw new RecordLocationViewError('LOCATION_NOT_PUBLISHED', '当前地点暂未公开展示。');
  }

  await actor.collection(LOCATIONS_COLLECTION).doc(locationId).update({
    data: {
      viewCount: command.inc(1),
    },
  });

  const updatedLocationDoc = await safeGetLocation(actor, locationId);

  if (!updatedLocationDoc) {
    throw new RecordLocationViewError('LOCATION_NOT_FOUND', '当前地点不存在或已下线。');
  }

  return buildSuccess(locationId, updatedLocationDoc.viewCount);
}

exports.main = async function main(event) {
  try {
    if (!db) {
      throw new RecordLocationViewError('INTERNAL_ERROR', '地点热度统计暂时不可用，请稍后再试。');
    }

    const input = validateEvent(event);
    return await incrementLocationView(db, input.locationId);
  } catch (error) {
    console.error('[recordLocationView] request failed', {
      code: error && error.code ? error.code : 'INTERNAL_ERROR',
      message: error && error.message ? error.message : '',
    });

    if (error instanceof RecordLocationViewError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    return buildError('INTERNAL_ERROR', '地点热度统计暂时不可用，请稍后再试。');
  }
};

module.exports._private = {
  LOCATIONS_COLLECTION: LOCATIONS_COLLECTION,
  buildSuccess: buildSuccess,
  incrementLocationView: incrementLocationView,
  isTemporaryLocationId: isTemporaryLocationId,
  normalizeViewCount: normalizeViewCount,
  safeGetLocation: safeGetLocation,
  validateEvent: validateEvent,
};
