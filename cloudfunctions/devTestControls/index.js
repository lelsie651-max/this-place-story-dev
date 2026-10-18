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
const SUPPORTED_STORY_TYPES = {
  民间传说: true,
  AI说: true,
};
const ALLOWED_ACTIONS = {
  get_status: true,
  set_magnifying_glass: true,
  set_daily_total_count: true,
  set_location_type_count: true,
  clear_all_location_type_counts: true,
  clear_location_type_count: true,
  clear_request_lock: true,
  reset_today_state: true,
};
const ALLOWED_ERROR_CODES = {
  DEV_TOOLS_DISABLED: true,
  DEV_TOOLS_FORBIDDEN: true,
  INVALID_INPUT: true,
  UNAUTHORIZED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class DevToolsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DevToolsError';
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

function getServerDateValue() {
  if (db && typeof db.serverDate === 'function') {
    return db.serverDate();
  }

  return new Date();
}

function parseBooleanEnv(value) {
  const normalizedValue = trimString(value).toLowerCase();

  return (
    normalizedValue === '1'
    || normalizedValue === 'true'
    || normalizedValue === 'on'
    || normalizedValue === 'yes'
  );
}

function parseAdminOpenIds(value) {
  return trimString(value)
    .split(/[\s,;]+/)
    .map(function mapOpenId(item) {
      return trimString(item);
    })
    .filter(Boolean);
}

function maskOpenId(openId) {
  if (!openId) {
    return '';
  }

  const normalizedOpenId = String(openId);

  if (normalizedOpenId.length <= 6) {
    return normalizedOpenId.slice(0, 1) + '***';
  }

  return normalizedOpenId.slice(0, 3) + '***' + normalizedOpenId.slice(-2);
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

function createDatabaseError(error) {
  return new DevToolsError(
    'DATABASE_ERROR',
    '开发测试工具暂时不可用，请稍后再试。'
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

async function resolveUserDocumentState(openId) {
  const stableUserDocId = createUserDocId(openId);
  const stableUserDoc = await safeGetDocument(db, USERS_COLLECTION, stableUserDocId);

  if (stableUserDoc && trimString(stableUserDoc.openid) === openId) {
    return {
      userDocId: stableUserDocId,
      userDoc: stableUserDoc,
      isNew: false,
    };
  }

  const existingUserRecord = await findUserDocumentByOpenId(db, openId);

  if (existingUserRecord && existingUserRecord._id) {
    return {
      userDocId: existingUserRecord._id,
      userDoc: existingUserRecord.data,
      isNew: false,
    };
  }

  return {
    userDocId: stableUserDocId,
    userDoc: null,
    isNew: true,
  };
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
    updatedAt: getServerDateValue(),
  };
}

function cloneLocationTypeCounts(locationTypeCounts) {
  const source = isPlainObject(locationTypeCounts) ? locationTypeCounts : {};
  const nextCounts = {};

  Object.keys(source).forEach(function copyEntry(key) {
    const entry = isPlainObject(source[key]) ? source[key] : {};

    nextCounts[key] = {
      locationKey: trimString(entry.locationKey),
      storyType: trimString(entry.storyType),
      count: getNumericValue(entry.count),
    };
  });

  return nextCounts;
}

function buildUsageDocument(options) {
  const existingUsage = isPlainObject(options.existingUsage) ? options.existingUsage : {};

  return {
    date: options.dateKey,
    userId: options.userId,
    totalCount: typeof options.totalCount === 'number'
      ? options.totalCount
      : getNumericValue(existingUsage.totalCount),
    locationTypeCounts: cloneLocationTypeCounts(existingUsage.locationTypeCounts),
    recentRequestIds: Array.isArray(existingUsage.recentRequestIds)
      ? existingUsage.recentRequestIds.slice(0, 20)
      : [],
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
    lastPreparedAt: getNumericValue(existingUsage.lastPreparedAt),
    lastConsumedAt: getNumericValue(existingUsage.lastConsumedAt),
    updatedAt: getServerDateValue(),
  };
}

function normalizeLocationSelector(locationKey, storyType, required) {
  const normalizedLocationKey = trimString(locationKey);
  const normalizedStoryType = trimString(storyType);

  if (!normalizedLocationKey && !normalizedStoryType) {
    if (required) {
      throw new DevToolsError('INVALID_INPUT', 'locationKey 和 storyType 不能为空。');
    }

    return null;
  }

  if (!normalizedLocationKey || !normalizedStoryType) {
    throw new DevToolsError('INVALID_INPUT', 'locationKey 和 storyType 必须同时提供。');
  }

  if (!SUPPORTED_STORY_TYPES[normalizedStoryType]) {
    throw new DevToolsError('INVALID_INPUT', 'storyType 必须是民间传说或AI说。');
  }

  return {
    locationKey: normalizedLocationKey,
    storyType: normalizedStoryType,
    key: createLocationTypeKey(normalizedLocationKey, normalizedStoryType),
  };
}

function validateNonNegativeInteger(value, fieldName, maxValue) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0 || Math.floor(numericValue) !== numericValue) {
    throw new DevToolsError('INVALID_INPUT', fieldName + ' 必须是非负整数。');
  }

  if (typeof maxValue === 'number' && numericValue > maxValue) {
    throw new DevToolsError('INVALID_INPUT', fieldName + ' 超出允许范围。');
  }

  return numericValue;
}

function validateAction(rawAction) {
  const action = trimString(rawAction);

  if (!ALLOWED_ACTIONS[action]) {
    throw new DevToolsError('INVALID_INPUT', '当前请求动作不受支持。');
  }

  return action;
}

function validateEvent(event) {
  if (!isPlainObject(event)) {
    throw new DevToolsError('INVALID_INPUT', '参数格式不正确。');
  }

  const action = validateAction(event.action);
  const input = {
    action: action,
  };

  if (
    action === 'get_status'
    || action === 'set_location_type_count'
    || action === 'clear_location_type_count'
  ) {
    input.selector = normalizeLocationSelector(
      event.locationKey,
      event.storyType,
      action !== 'get_status'
    );
  } else {
    input.selector = normalizeLocationSelector(event.locationKey, event.storyType, false);
  }

  if (action === 'set_magnifying_glass') {
    input.magnifyingGlass = validateNonNegativeInteger(event.magnifyingGlass, 'magnifyingGlass');
  }

  if (action === 'set_daily_total_count') {
    input.dailyTotalCount = validateNonNegativeInteger(event.dailyTotalCount, 'dailyTotalCount', 10);
  }

  if (action === 'set_location_type_count') {
    input.locationTypeCount = validateNonNegativeInteger(event.locationTypeCount, 'locationTypeCount', 3);
  }

  if (action === 'reset_today_state') {
    input.magnifyingGlass = validateNonNegativeInteger(event.magnifyingGlass, 'magnifyingGlass');
  }

  return input;
}

function authorizeRequest(openId) {
  if (!parseBooleanEnv(process.env.ENABLE_DEV_TEST_TOOLS)) {
    throw new DevToolsError('DEV_TOOLS_DISABLED', '开发测试工具未开启');
  }

  if (!openId) {
    throw new DevToolsError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试。');
  }

  const adminOpenIds = parseAdminOpenIds(process.env.DEV_TEST_ADMIN_OPENIDS);

  if (adminOpenIds.indexOf(openId) === -1) {
    throw new DevToolsError('DEV_TOOLS_FORBIDDEN', '当前账号无权使用开发测试工具。');
  }
}

function getLocationTypeCount(usageDoc, selector) {
  if (!selector || !usageDoc || !isPlainObject(usageDoc.locationTypeCounts)) {
    return 0;
  }

  const entry = usageDoc.locationTypeCounts[selector.key];

  return getNumericValue(entry && entry.count);
}

function buildStatePayload(userDoc, usageDoc, selector) {
  return {
    magnifyingGlass: getNumericValue(userDoc && userDoc.magnifyingGlass),
    dailyTotalCount: getNumericValue(usageDoc && usageDoc.totalCount),
    locationTypeCount: getLocationTypeCount(usageDoc, selector),
    requestLockUntil: getNumericValue(usageDoc && usageDoc.requestLockUntil),
    activeLocationKey: trimString(usageDoc && usageDoc.activeLocationKey),
    activeStoryType: trimString(usageDoc && usageDoc.activeStoryType),
    hasRequestLock: !!trimString(usageDoc && usageDoc.activeRequestId) && getNumericValue(usageDoc && usageDoc.requestLockUntil) > 0,
  };
}

function applyActionToState(actionInput, openId, dateKey, currentState) {
  const currentUserDoc = currentState && currentState.userDoc ? currentState.userDoc : null;
  const currentUsageDoc = currentState && currentState.usageDoc ? currentState.usageDoc : null;
  const nextUserDoc = buildUserDocument(
    openId,
    currentUserDoc,
    currentUserDoc ? getNumericValue(currentUserDoc.magnifyingGlass) : USER_DEFAULTS.magnifyingGlass
  );
  let nextUsageDoc = buildUsageDocument({
    existingUsage: currentUsageDoc,
    dateKey: dateKey,
    userId: openId,
  });

  if (actionInput.action === 'get_status') {
    return {
      userDoc: nextUserDoc,
      usageDoc: nextUsageDoc,
      persistUser: !currentUserDoc,
      persistUsage: false,
      state: buildStatePayload(nextUserDoc, currentUsageDoc || nextUsageDoc, actionInput.selector),
    };
  }

  if (actionInput.action === 'set_magnifying_glass') {
    return {
      userDoc: buildUserDocument(openId, currentUserDoc, actionInput.magnifyingGlass),
      usageDoc: nextUsageDoc,
      persistUser: true,
      persistUsage: false,
      state: buildStatePayload(
        buildUserDocument(openId, currentUserDoc, actionInput.magnifyingGlass),
        currentUsageDoc || nextUsageDoc,
        actionInput.selector
      ),
    };
  }

  if (actionInput.action === 'set_daily_total_count') {
    nextUsageDoc.totalCount = actionInput.dailyTotalCount;
  } else if (actionInput.action === 'set_location_type_count') {
    nextUsageDoc.locationTypeCounts[actionInput.selector.key] = {
      locationKey: actionInput.selector.locationKey,
      storyType: actionInput.selector.storyType,
      count: actionInput.locationTypeCount,
    };
  } else if (actionInput.action === 'clear_all_location_type_counts') {
    nextUsageDoc.locationTypeCounts = {};
  } else if (actionInput.action === 'clear_location_type_count') {
    delete nextUsageDoc.locationTypeCounts[actionInput.selector.key];
  } else if (actionInput.action === 'clear_request_lock') {
    nextUsageDoc.activeRequestId = '';
    nextUsageDoc.activeLocationKey = '';
    nextUsageDoc.activeStoryType = '';
    nextUsageDoc.requestLockUntil = 0;
  } else if (actionInput.action === 'reset_today_state') {
    nextUsageDoc.totalCount = 0;
    nextUsageDoc.locationTypeCounts = {};
    nextUsageDoc.recentRequestIds = [];
    nextUsageDoc.activeRequestId = '';
    nextUsageDoc.activeLocationKey = '';
    nextUsageDoc.activeStoryType = '';
    nextUsageDoc.requestLockUntil = 0;

    return {
      userDoc: buildUserDocument(openId, currentUserDoc, actionInput.magnifyingGlass),
      usageDoc: nextUsageDoc,
      persistUser: true,
      persistUsage: true,
      state: buildStatePayload(
        buildUserDocument(openId, currentUserDoc, actionInput.magnifyingGlass),
        nextUsageDoc,
        actionInput.selector
      ),
    };
  }

  return {
    userDoc: nextUserDoc,
    usageDoc: nextUsageDoc,
    persistUser: !currentUserDoc,
    persistUsage: true,
    state: buildStatePayload(nextUserDoc, nextUsageDoc, actionInput.selector),
  };
}

async function persistUserDocument(userState, userDoc) {
  if (userState.isNew) {
    await db.collection(USERS_COLLECTION).doc(userState.userDocId).set({
      data: Object.assign({
        createdAt: db.serverDate(),
      }, userDoc),
    });
    return;
  }

  await db.collection(USERS_COLLECTION).doc(userState.userDocId).update({
    data: userDoc,
  });
}

async function persistUsageDocument(openId, dateKey, existingUsageDoc, usageDoc) {
  const usageDocId = createUsageDocId(dateKey, openId);

  if (!existingUsageDoc) {
    await db.collection(USAGE_COLLECTION).doc(usageDocId).set({
      data: Object.assign({
        createdAt: db.serverDate(),
      }, usageDoc),
    });
    return;
  }

  await db.collection(USAGE_COLLECTION).doc(usageDocId).update({
    data: usageDoc,
  });
}

async function handleAction(actionInput, openId) {
  if (!db) {
    throw new DevToolsError('INTERNAL_ERROR', '开发测试工具暂时不可用，请稍后再试。');
  }

  const dateKey = getDateKey();
  const usageDocId = createUsageDocId(dateKey, openId);

  try {
    const userState = await resolveUserDocumentState(openId);
    const usageDoc = await safeGetDocument(db, USAGE_COLLECTION, usageDocId);
    const appliedState = applyActionToState(actionInput, openId, dateKey, {
      userDoc: userState.userDoc,
      usageDoc: usageDoc,
    });

    if (appliedState.persistUser) {
      await persistUserDocument(userState, appliedState.userDoc);
    }

    if (appliedState.persistUsage) {
      await persistUsageDocument(openId, dateKey, usageDoc, appliedState.usageDoc);
    }

    return appliedState.state;
  } catch (error) {
    if (error instanceof DevToolsError) {
      throw error;
    }

    throw createDatabaseError(error);
  }
}

exports.main = async function main(event) {
  try {
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);
    const actionInput = validateEvent(event || {});

    authorizeRequest(openId);

    console.warn('[devTestControls] request received', {
      action: actionInput.action,
      hasOpenId: !!openId,
      openIdMasked: maskOpenId(openId),
    });

    return buildSuccess(await handleAction(actionInput, openId));
  } catch (error) {
    console.error('[devTestControls] request failed', {
      action: trimString(event && event.action),
      code: error && error.code ? error.code : 'INTERNAL_ERROR',
      message: error && error.message ? error.message : '',
    });

    if (error instanceof DevToolsError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    return buildError('INTERNAL_ERROR', '开发测试工具暂时不可用，请稍后再试。');
  }
};

module.exports._private = {
  ALLOWED_ACTIONS: ALLOWED_ACTIONS,
  SUPPORTED_STORY_TYPES: SUPPORTED_STORY_TYPES,
  USER_DEFAULTS: USER_DEFAULTS,
  applyActionToState: applyActionToState,
  authorizeRequest: authorizeRequest,
  buildStatePayload: buildStatePayload,
  buildUsageDocument: buildUsageDocument,
  buildUserDocument: buildUserDocument,
  createLocationTypeKey: createLocationTypeKey,
  createUsageDocId: createUsageDocId,
  getDateKey: getDateKey,
  parseAdminOpenIds: parseAdminOpenIds,
  parseBooleanEnv: parseBooleanEnv,
  validateEvent: validateEvent,
};
