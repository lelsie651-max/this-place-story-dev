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
const USERS_COLLECTION = 'users';
const USAGE_COLLECTION = 'magnifying_glass_usage_daily';
const USER_DEFAULTS = {
  nickname: '旅途观察员',
  avatarUrl: '',
  language: 'zh-CN',
  magnifyingGlass: 5,
};
const MAGNIFYING_GLASS_RULES = {
  USER_DAILY_LIMIT: 10,
  LOCATION_TYPE_DAILY_LIMIT: 3,
  REQUEST_LOCK_WINDOW_MS: 70000,
  MAX_LOCATION_KEY_LENGTH: 160,
  MAX_REQUEST_ID_LENGTH: 80,
};
const SUPPORTED_STORY_TYPES = {
  民间传说: true,
  AI说: true,
};
const ALLOWED_ACTIONS = {
  profile: true,
  prepare: true,
  consume: true,
  release: true,
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  UNAUTHORIZED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
  MAGNIFYING_GLASS_EMPTY: true,
  MAGNIFYING_GLASS_DAILY_LIMIT: true,
  MAGNIFYING_GLASS_LOCATION_TYPE_LIMIT: true,
  MAGNIFYING_GLASS_CONCURRENT_REQUEST: true,
};

class MagnifyingGlassError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MagnifyingGlassError';
    this.code = code;
  }
}

function buildSuccess(data) {
  return {
    ok: true,
    data: data,
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

function createDigest(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}

function getDateKey(nowMs) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(typeof nowMs === 'number' ? nowMs : Date.now()));
}

function getNumericValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function createUserDocId(openId) {
  return 'user__' + createDigest(openId).slice(0, 24);
}

function createUsageDocId(dateKey, openId) {
  return 'usage__' + dateKey + '__' + createDigest(openId).slice(0, 24);
}

function createLocationTypeKey(locationKey, storyType) {
  return createDigest(locationKey + '::' + storyType).slice(0, 24);
}

function isMissingDocumentError(error) {
  const message = error && error.message ? String(error.message) : '';

  return (
    message.indexOf('does not exist') !== -1
    || message.indexOf('non-existent') !== -1
    || message.indexOf('document.get:fail') !== -1
  );
}

async function safeGetDocument(actor, collectionName, docId) {
  try {
    const result = await actor.collection(collectionName).doc(docId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isMissingDocumentError(error)) {
      return null;
    }

    throw error;
  }
}

async function findUserDocumentByOpenId(actor, openId) {
  const result = await actor
    .collection(USERS_COLLECTION)
    .where({
      openid: openId,
    })
    .limit(1)
    .get();

  const firstUser = result && Array.isArray(result.data) && result.data.length > 0
    ? result.data[0]
    : null;

  if (!firstUser) {
    return null;
  }

  return {
    _id: firstUser._id,
    data: firstUser,
  };
}

function validateAction(rawAction) {
  const action = trimString(rawAction || 'profile');

  if (!ALLOWED_ACTIONS[action]) {
    throw new MagnifyingGlassError('INVALID_INPUT', '当前请求动作不受支持');
  }

  return action;
}

function validateLocationKey(locationKey) {
  const normalizedLocationKey = trimString(locationKey);

  if (!normalizedLocationKey) {
    throw new MagnifyingGlassError('INVALID_INPUT', 'locationKey 不能为空');
  }

  if (normalizedLocationKey.length > MAGNIFYING_GLASS_RULES.MAX_LOCATION_KEY_LENGTH) {
    throw new MagnifyingGlassError('INVALID_INPUT', 'locationKey 长度超出限制');
  }

  return normalizedLocationKey;
}

function validateStoryType(storyType) {
  const normalizedStoryType = trimString(storyType);

  if (!SUPPORTED_STORY_TYPES[normalizedStoryType]) {
    throw new MagnifyingGlassError('INVALID_INPUT', 'storyType 必须是民间传说或AI说');
  }

  return normalizedStoryType;
}

function validateRequestId(requestId) {
  const normalizedRequestId = trimString(requestId);

  if (!normalizedRequestId) {
    throw new MagnifyingGlassError('INVALID_INPUT', 'requestId 不能为空');
  }

  if (normalizedRequestId.length > MAGNIFYING_GLASS_RULES.MAX_REQUEST_ID_LENGTH) {
    throw new MagnifyingGlassError('INVALID_INPUT', 'requestId 长度超出限制');
  }

  return normalizedRequestId;
}

function validateEvent(event) {
  if (typeof event === 'undefined' || event === null) {
    return {
      action: 'profile',
    };
  }

  if (!isPlainObject(event)) {
    throw new MagnifyingGlassError('INVALID_INPUT', '参数格式不正确');
  }

  const action = validateAction(event.action);
  const normalizedEvent = {
    action: action,
  };

  if (action === 'profile') {
    return normalizedEvent;
  }

  normalizedEvent.locationKey = validateLocationKey(event.locationKey);
  normalizedEvent.storyType = validateStoryType(event.storyType);
  normalizedEvent.requestId = validateRequestId(event.requestId);

  return normalizedEvent;
}

function buildUserDocument(openId, existingUser, magnifyingGlass) {
  const currentUser = isPlainObject(existingUser) ? existingUser : {};

  return {
    openid: openId,
    nickname: trimString(currentUser.nickname) || USER_DEFAULTS.nickname,
    avatarUrl: trimString(currentUser.avatarUrl) || USER_DEFAULTS.avatarUrl,
    language: trimString(currentUser.language) || USER_DEFAULTS.language,
    magnifyingGlass: typeof magnifyingGlass === 'number'
      ? magnifyingGlass
      : getNumericValue(currentUser.magnifyingGlass || USER_DEFAULTS.magnifyingGlass),
    updatedAt: db.serverDate(),
  };
}

function buildUsageDocument(options) {
  const existingUsage = isPlainObject(options.existingUsage) ? options.existingUsage : {};
  const locationTypeCounts = isPlainObject(existingUsage.locationTypeCounts)
    ? Object.assign({}, existingUsage.locationTypeCounts)
    : {};
  const recentRequestIds = Array.isArray(existingUsage.recentRequestIds)
    ? existingUsage.recentRequestIds.slice(0, 20)
    : [];

  if (options.locationTypeCountKey) {
    locationTypeCounts[options.locationTypeCountKey] = {
      locationKey: options.locationKey,
      storyType: options.storyType,
      count: typeof options.locationTypeCount === 'number'
        ? options.locationTypeCount
        : getNumericValue(locationTypeCounts[options.locationTypeCountKey] && locationTypeCounts[options.locationTypeCountKey].count),
    };
  }

  const usageDoc = {
    date: options.dateKey,
    userId: options.userId,
    totalCount: typeof options.totalCount === 'number'
      ? options.totalCount
      : getNumericValue(existingUsage.totalCount),
    locationTypeCounts: locationTypeCounts,
    recentRequestIds: recentRequestIds,
    activeRequestId: typeof options.activeRequestId === 'string'
      ? options.activeRequestId
      : trimString(existingUsage.activeRequestId),
    activeLocationKey: typeof options.activeLocationKey === 'string'
      ? options.activeLocationKey
      : trimString(existingUsage.activeLocationKey),
    activeStoryType: typeof options.activeStoryType === 'string'
      ? options.activeStoryType
      : trimString(existingUsage.activeStoryType),
    requestLockUntil: typeof options.requestLockUntil === 'number'
      ? options.requestLockUntil
      : getNumericValue(existingUsage.requestLockUntil),
    lastPreparedAt: typeof options.lastPreparedAt === 'number'
      ? options.lastPreparedAt
      : getNumericValue(existingUsage.lastPreparedAt),
    lastConsumedAt: typeof options.lastConsumedAt === 'number'
      ? options.lastConsumedAt
      : getNumericValue(existingUsage.lastConsumedAt),
    updatedAt: db.serverDate(),
  };

  return usageDoc;
}

function appendRecentRequestId(recentRequestIds, requestId) {
  const filteredRequestIds = (Array.isArray(recentRequestIds) ? recentRequestIds : [])
    .filter(Boolean)
    .filter(function filterDuplicate(existingRequestId) {
      return existingRequestId !== requestId;
    });

  filteredRequestIds.unshift(requestId);
  return filteredRequestIds.slice(0, 20);
}

function getLocationTypeCount(usageDoc, locationTypeCountKey) {
  if (!usageDoc || !isPlainObject(usageDoc.locationTypeCounts)) {
    return 0;
  }

  const counter = usageDoc.locationTypeCounts[locationTypeCountKey];
  return getNumericValue(counter && counter.count);
}

function buildProfilePayload(userDoc, usageDoc, locationTypeCountKey) {
  return {
    openid: trimString(userDoc && userDoc.openid),
    nickname: trimString(userDoc && userDoc.nickname),
    avatarUrl: trimString(userDoc && userDoc.avatarUrl),
    language: trimString(userDoc && userDoc.language) || USER_DEFAULTS.language,
    magnifyingGlass: getNumericValue(userDoc && userDoc.magnifyingGlass),
    dailyTotalCount: getNumericValue(usageDoc && usageDoc.totalCount),
    locationTypeCount: locationTypeCountKey ? getLocationTypeCount(usageDoc, locationTypeCountKey) : 0,
  };
}

function assertUsageAllowed(userDoc, usageDoc, locationTypeCountKey) {
  const magnifyingGlass = getNumericValue(userDoc && userDoc.magnifyingGlass);
  const totalCount = getNumericValue(usageDoc && usageDoc.totalCount);
  const locationTypeCount = getLocationTypeCount(usageDoc, locationTypeCountKey);

  if (magnifyingGlass < 1) {
    throw new MagnifyingGlassError('MAGNIFYING_GLASS_EMPTY', '放大镜不足，暂时无法继续探索。');
  }

  if (totalCount >= MAGNIFYING_GLASS_RULES.USER_DAILY_LIMIT) {
    throw new MagnifyingGlassError('MAGNIFYING_GLASS_DAILY_LIMIT', '今天的探索次数已用完，请明天再来。');
  }

  if (locationTypeCount >= MAGNIFYING_GLASS_RULES.LOCATION_TYPE_DAILY_LIMIT) {
    throw new MagnifyingGlassError('MAGNIFYING_GLASS_LOCATION_TYPE_LIMIT', '这个地点的该类故事今天已经探索 3 次了。');
  }
}

async function ensureUserDocument(actor, openId) {
  const existingUserRecord = await findUserDocumentByOpenId(actor, openId);
  const userDocId = existingUserRecord && existingUserRecord._id
    ? existingUserRecord._id
    : createUserDocId(openId);
  const existingUser = existingUserRecord && existingUserRecord.data
    ? existingUserRecord.data
    : null;

  if (existingUserRecord) {
    return {
      userDocId: userDocId,
      userDoc: existingUser,
      isNew: false,
    };
  }

  const userDoc = buildUserDocument(openId, null, USER_DEFAULTS.magnifyingGlass);

  return {
    userDocId: userDocId,
    userDoc: userDoc,
    isNew: true,
  };
}

async function getProfile(openId) {
  if (!db) {
    throw new MagnifyingGlassError('INTERNAL_ERROR', '放大镜服务暂时不可用');
  }

  const dateKey = getDateKey();
  const usageDocId = createUsageDocId(dateKey, openId);

  try {
    const userState = await ensureUserDocument(db, openId);
    const usageDoc = await safeGetDocument(db, USAGE_COLLECTION, usageDocId);

    if (userState.isNew) {
      await db.collection(USERS_COLLECTION).doc(userState.userDocId).set({
        data: Object.assign({
          createdAt: db.serverDate(),
        }, userState.userDoc),
      });
    }

    return buildProfilePayload(userState.userDoc, usageDoc);
  } catch (error) {
    if (error instanceof MagnifyingGlassError) {
      throw error;
    }

    throw new MagnifyingGlassError('DATABASE_ERROR', '放大镜信息读取失败，请稍后再试');
  }
}

async function prepareUsage(event, openId) {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new MagnifyingGlassError('INTERNAL_ERROR', '放大镜服务暂时不可用');
  }

  const nowMs = Date.now();
  const dateKey = getDateKey(nowMs);
  const usageDocId = createUsageDocId(dateKey, openId);
  const locationTypeCountKey = createLocationTypeKey(event.locationKey, event.storyType);

  try {
    return await db.runTransaction(async function prepareTransaction(transaction) {
      const userState = await ensureUserDocument(transaction, openId);
      const existingUsage = await safeGetDocument(transaction, USAGE_COLLECTION, usageDocId);
      const requestLockUntil = getNumericValue(existingUsage && existingUsage.requestLockUntil);
      const activeRequestId = trimString(existingUsage && existingUsage.activeRequestId);

      if (
        activeRequestId
        && activeRequestId !== event.requestId
        && requestLockUntil > nowMs
      ) {
        throw new MagnifyingGlassError('MAGNIFYING_GLASS_CONCURRENT_REQUEST', '当前探索处理中，请稍后再试。');
      }

      assertUsageAllowed(userState.userDoc, existingUsage, locationTypeCountKey);

      const usageDoc = buildUsageDocument({
        existingUsage: existingUsage,
        dateKey: dateKey,
        userId: openId,
        locationTypeCountKey: locationTypeCountKey,
        locationKey: event.locationKey,
        storyType: event.storyType,
        activeRequestId: event.requestId,
        activeLocationKey: event.locationKey,
        activeStoryType: event.storyType,
        requestLockUntil: nowMs + MAGNIFYING_GLASS_RULES.REQUEST_LOCK_WINDOW_MS,
        lastPreparedAt: nowMs,
      });

      if (userState.isNew) {
        await transaction.collection(USERS_COLLECTION).doc(userState.userDocId).set({
          data: Object.assign({
            createdAt: db.serverDate(),
          }, userState.userDoc),
        });
      }

      if (existingUsage) {
        await transaction.collection(USAGE_COLLECTION).doc(usageDocId).update({
          data: usageDoc,
        });
      } else {
        await transaction.collection(USAGE_COLLECTION).doc(usageDocId).set({
          data: Object.assign({
            createdAt: db.serverDate(),
          }, usageDoc),
        });
      }

      return buildProfilePayload(userState.userDoc, usageDoc, locationTypeCountKey);
    });
  } catch (error) {
    if (error instanceof MagnifyingGlassError) {
      throw error;
    }

    throw new MagnifyingGlassError('DATABASE_ERROR', '放大镜状态更新失败，请稍后再试');
  }
}

async function consumeUsage(event, openId) {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new MagnifyingGlassError('INTERNAL_ERROR', '放大镜服务暂时不可用');
  }

  const nowMs = Date.now();
  const dateKey = getDateKey(nowMs);
  const usageDocId = createUsageDocId(dateKey, openId);
  const locationTypeCountKey = createLocationTypeKey(event.locationKey, event.storyType);

  try {
    return await db.runTransaction(async function consumeTransaction(transaction) {
      const userState = await ensureUserDocument(transaction, openId);
      const existingUsage = await safeGetDocument(transaction, USAGE_COLLECTION, usageDocId);
      const recentRequestIds = Array.isArray(existingUsage && existingUsage.recentRequestIds)
        ? existingUsage.recentRequestIds
        : [];
      const activeRequestId = trimString(existingUsage && existingUsage.activeRequestId);
      const requestLockUntil = getNumericValue(existingUsage && existingUsage.requestLockUntil);

      if (recentRequestIds.indexOf(event.requestId) !== -1) {
        return Object.assign({
          duplicate: true,
        }, buildProfilePayload(userState.userDoc, existingUsage, locationTypeCountKey));
      }

      if (
        activeRequestId
        && activeRequestId !== event.requestId
        && requestLockUntil > nowMs
      ) {
        throw new MagnifyingGlassError('MAGNIFYING_GLASS_CONCURRENT_REQUEST', '当前探索处理中，请稍后再试。');
      }

      if (!activeRequestId || activeRequestId !== event.requestId) {
        throw new MagnifyingGlassError('MAGNIFYING_GLASS_CONCURRENT_REQUEST', '当前探索请求已失效，请重新选择。');
      }

      assertUsageAllowed(userState.userDoc, existingUsage, locationTypeCountKey);

      const nextMagnifyingGlass = getNumericValue(userState.userDoc.magnifyingGlass) - 1;
      const nextTotalCount = getNumericValue(existingUsage && existingUsage.totalCount) + 1;
      const nextLocationTypeCount = getLocationTypeCount(existingUsage, locationTypeCountKey) + 1;
      const nextUserDoc = buildUserDocument(openId, userState.userDoc, nextMagnifyingGlass);
      const nextUsageDoc = buildUsageDocument({
        existingUsage: existingUsage,
        dateKey: dateKey,
        userId: openId,
        totalCount: nextTotalCount,
        locationTypeCountKey: locationTypeCountKey,
        locationKey: event.locationKey,
        storyType: event.storyType,
        locationTypeCount: nextLocationTypeCount,
        activeRequestId: '',
        activeLocationKey: '',
        activeStoryType: '',
        requestLockUntil: 0,
        lastConsumedAt: nowMs,
      });

      nextUsageDoc.recentRequestIds = appendRecentRequestId(recentRequestIds, event.requestId);

      if (userState.isNew) {
        await transaction.collection(USERS_COLLECTION).doc(userState.userDocId).set({
          data: Object.assign({
            createdAt: db.serverDate(),
          }, nextUserDoc),
        });
      } else {
        await transaction.collection(USERS_COLLECTION).doc(userState.userDocId).update({
          data: nextUserDoc,
        });
      }

      if (existingUsage) {
        await transaction.collection(USAGE_COLLECTION).doc(usageDocId).update({
          data: nextUsageDoc,
        });
      } else {
        await transaction.collection(USAGE_COLLECTION).doc(usageDocId).set({
          data: Object.assign({
            createdAt: db.serverDate(),
          }, nextUsageDoc),
        });
      }

      return Object.assign({
        duplicate: false,
      }, buildProfilePayload(nextUserDoc, nextUsageDoc, locationTypeCountKey));
    });
  } catch (error) {
    if (error instanceof MagnifyingGlassError) {
      throw error;
    }

    throw new MagnifyingGlassError('DATABASE_ERROR', '放大镜扣减失败，请稍后再试');
  }
}

async function releaseUsage(event, openId) {
  if (!db) {
    throw new MagnifyingGlassError('INTERNAL_ERROR', '放大镜服务暂时不可用');
  }

  const dateKey = getDateKey();
  const usageDocId = createUsageDocId(dateKey, openId);

  try {
    const usageDoc = await safeGetDocument(db, USAGE_COLLECTION, usageDocId);

    if (!usageDoc || trimString(usageDoc.activeRequestId) !== event.requestId) {
      return {
        released: false,
      };
    }

    await db.collection(USAGE_COLLECTION).doc(usageDocId).update({
      data: {
        activeRequestId: '',
        activeLocationKey: '',
        activeStoryType: '',
        requestLockUntil: 0,
        updatedAt: db.serverDate(),
      },
    });

    return {
      released: true,
    };
  } catch (error) {
    if (error instanceof MagnifyingGlassError) {
      throw error;
    }

    throw new MagnifyingGlassError('DATABASE_ERROR', '放大镜状态释放失败，请稍后再试');
  }
}

exports.main = async function main(event) {
  try {
    const input = validateEvent(event);
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new MagnifyingGlassError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试');
    }

    if (input.action === 'profile') {
      return buildSuccess(await getProfile(openId));
    }

    if (input.action === 'prepare') {
      return buildSuccess(await prepareUsage(input, openId));
    }

    if (input.action === 'consume') {
      return buildSuccess(await consumeUsage(input, openId));
    }

    if (input.action === 'release') {
      return buildSuccess(await releaseUsage(input, openId));
    }

    throw new MagnifyingGlassError('INVALID_INPUT', '当前请求动作不受支持');
  } catch (error) {
    if (error instanceof MagnifyingGlassError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[consumeMagnifyingGlass] Unexpected error', {
      name: error && error.name ? error.name : 'Error',
    });
    return buildError('INTERNAL_ERROR', '放大镜服务暂时不可用，请稍后再试');
  }
};

module.exports._private = {
  MAGNIFYING_GLASS_RULES: MAGNIFYING_GLASS_RULES,
  USERS_COLLECTION: USERS_COLLECTION,
  USAGE_COLLECTION: USAGE_COLLECTION,
  buildProfilePayload: buildProfilePayload,
  buildUsageDocument: buildUsageDocument,
  createLocationTypeKey: createLocationTypeKey,
  createUsageDocId: createUsageDocId,
  createUserDocId: createUserDocId,
  getDateKey: getDateKey,
  validateEvent: validateEvent,
};
