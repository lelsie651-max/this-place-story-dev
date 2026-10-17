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
const CLAIMS_COLLECTION = 'ad_reward_claims';
const DAILY_COLLECTION = 'ad_reward_daily';
const USER_DEFAULTS = {
  nickname: '旅途观察员',
  avatarUrl: '',
  language: 'zh-CN',
  magnifyingGlass: 5,
};
const AD_REWARD_RULES = {
  REWARD_AMOUNT: 1,
  DAILY_LIMIT: 3,
  MAX_REQUEST_ID_LENGTH: 80,
  MAX_AD_UNIT_ID_LENGTH: 80,
};
const ALLOWED_ACTIONS = {
  status: true,
  claim: true,
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  UNAUTHORIZED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
  AD_REWARD_UNAVAILABLE: true,
  AD_REWARD_DAILY_LIMIT: true,
};

class AdRewardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdRewardError';
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

function getNumericValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
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

function createUserDocId(openId) {
  return 'user__' + createDigest(openId).slice(0, 24);
}

function createDailyDocId(dateKey, openId) {
  return 'ad_reward_daily__' + dateKey + '__' + createDigest(openId).slice(0, 24);
}

function createClaimDocId(openId, rewardRequestId) {
  return 'ad_reward_claim__' + createDigest(openId + '::' + rewardRequestId).slice(0, 32);
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

function buildDailyDocument(dateKey, openId, rewardCount) {
  return {
    date: dateKey,
    userId: openId,
    rewardCount: typeof rewardCount === 'number' ? rewardCount : 0,
    updatedAt: db.serverDate(),
  };
}

function isConfiguredAdUnitId(adUnitId) {
  const normalizedAdUnitId = trimString(adUnitId);

  if (!normalizedAdUnitId) {
    return false;
  }

  const lowerCaseValue = normalizedAdUnitId.toLowerCase();

  if (
    normalizedAdUnitId.indexOf('<') !== -1
    || normalizedAdUnitId.indexOf('>') !== -1
    || lowerCaseValue.indexOf('placeholder') !== -1
    || lowerCaseValue.indexOf('your-') !== -1
    || lowerCaseValue.indexOf('replace') !== -1
    || normalizedAdUnitId.indexOf('真实') !== -1
  ) {
    return false;
  }

  return true;
}

function validateAction(rawAction) {
  const action = trimString(rawAction || 'status');

  if (!ALLOWED_ACTIONS[action]) {
    throw new AdRewardError('INVALID_INPUT', '当前请求动作不受支持');
  }

  return action;
}

function validateRequestId(rewardRequestId) {
  const normalizedRequestId = trimString(rewardRequestId);

  if (!normalizedRequestId) {
    throw new AdRewardError('INVALID_INPUT', 'rewardRequestId 不能为空');
  }

  if (normalizedRequestId.length > AD_REWARD_RULES.MAX_REQUEST_ID_LENGTH) {
    throw new AdRewardError('INVALID_INPUT', 'rewardRequestId 长度超出限制');
  }

  return normalizedRequestId;
}

function validateAdUnitId(adUnitId) {
  const normalizedAdUnitId = trimString(adUnitId);

  if (!normalizedAdUnitId) {
    throw new AdRewardError('INVALID_INPUT', 'adUnitId 不能为空');
  }

  if (normalizedAdUnitId.length > AD_REWARD_RULES.MAX_AD_UNIT_ID_LENGTH) {
    throw new AdRewardError('INVALID_INPUT', 'adUnitId 长度超出限制');
  }

  if (!isConfiguredAdUnitId(normalizedAdUnitId)) {
    throw new AdRewardError('AD_REWARD_UNAVAILABLE', '广告奖励暂未配置');
  }

  return normalizedAdUnitId;
}

function validateEvent(event) {
  if (typeof event === 'undefined' || event === null) {
    return {
      action: 'status',
    };
  }

  if (!isPlainObject(event)) {
    throw new AdRewardError('INVALID_INPUT', '参数格式不正确');
  }

  const action = validateAction(event.action);
  const normalizedEvent = {
    action: action,
  };

  if (action === 'status') {
    return normalizedEvent;
  }

  normalizedEvent.rewardRequestId = validateRequestId(event.rewardRequestId);
  normalizedEvent.adUnitId = validateAdUnitId(event.adUnitId);

  return normalizedEvent;
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

function buildStatusPayload(userDoc, dailyDoc, extraData) {
  return Object.assign({
    magnifyingGlass: getNumericValue(userDoc && userDoc.magnifyingGlass),
    todayRewardCount: getNumericValue(dailyDoc && dailyDoc.rewardCount),
    dailyRewardLimit: AD_REWARD_RULES.DAILY_LIMIT,
    rewardAmount: AD_REWARD_RULES.REWARD_AMOUNT,
  }, extraData || {});
}

async function getStatus(openId) {
  if (!db) {
    throw new AdRewardError('INTERNAL_ERROR', '广告奖励服务暂时不可用');
  }

  const dateKey = getDateKey();
  const dailyDocId = createDailyDocId(dateKey, openId);

  try {
    const userState = await ensureUserDocument(db, openId);
    const dailyDoc = await safeGetDocument(db, DAILY_COLLECTION, dailyDocId);

    if (userState.isNew) {
      await db.collection(USERS_COLLECTION).doc(userState.userDocId).set({
        data: Object.assign({
          createdAt: db.serverDate(),
        }, userState.userDoc),
      });
    }

    return buildStatusPayload(userState.userDoc, dailyDoc);
  } catch (error) {
    if (error instanceof AdRewardError) {
      throw error;
    }

    throw new AdRewardError('DATABASE_ERROR', '广告奖励信息读取失败，请稍后再试');
  }
}

async function claimReward(event, openId) {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new AdRewardError('INTERNAL_ERROR', '广告奖励服务暂时不可用');
  }

  const nowMs = Date.now();
  const dateKey = getDateKey(nowMs);
  const dailyDocId = createDailyDocId(dateKey, openId);
  const claimDocId = createClaimDocId(openId, event.rewardRequestId);

  try {
    return await db.runTransaction(async function claimTransaction(transaction) {
      const userState = await ensureUserDocument(transaction, openId);
      const existingDailyDoc = await safeGetDocument(transaction, DAILY_COLLECTION, dailyDocId);
      const existingClaimDoc = await safeGetDocument(transaction, CLAIMS_COLLECTION, claimDocId);

      if (existingClaimDoc) {
        return buildStatusPayload(userState.userDoc, existingDailyDoc, {
          duplicate: true,
        });
      }

      const currentRewardCount = getNumericValue(existingDailyDoc && existingDailyDoc.rewardCount);

      if (currentRewardCount >= AD_REWARD_RULES.DAILY_LIMIT) {
        throw new AdRewardError('AD_REWARD_DAILY_LIMIT', '今日广告奖励已用完');
      }

      const nextMagnifyingGlass = getNumericValue(userState.userDoc.magnifyingGlass) + AD_REWARD_RULES.REWARD_AMOUNT;
      const nextUserDoc = buildUserDocument(openId, userState.userDoc, nextMagnifyingGlass);
      const nextDailyDoc = buildDailyDocument(dateKey, openId, currentRewardCount + 1);

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

      if (existingDailyDoc) {
        await transaction.collection(DAILY_COLLECTION).doc(dailyDocId).update({
          data: nextDailyDoc,
        });
      } else {
        await transaction.collection(DAILY_COLLECTION).doc(dailyDocId).set({
          data: Object.assign({
            createdAt: db.serverDate(),
          }, nextDailyDoc),
        });
      }

      await transaction.collection(CLAIMS_COLLECTION).doc(claimDocId).set({
        data: {
          rewardRequestId: event.rewardRequestId,
          userId: openId,
          adUnitId: event.adUnitId,
          reward: AD_REWARD_RULES.REWARD_AMOUNT,
          date: dateKey,
          createdAt: db.serverDate(),
        },
      });

      return buildStatusPayload(nextUserDoc, nextDailyDoc, {
        duplicate: false,
      });
    });
  } catch (error) {
    if (error instanceof AdRewardError) {
      throw error;
    }

    throw new AdRewardError('DATABASE_ERROR', '广告奖励发放失败，请稍后再试');
  }
}

exports.main = async function main(event) {
  try {
    const input = validateEvent(event);
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new AdRewardError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试');
    }

    if (input.action === 'status') {
      return buildSuccess(await getStatus(openId));
    }

    if (input.action === 'claim') {
      return buildSuccess(await claimReward(input, openId));
    }

    throw new AdRewardError('INVALID_INPUT', '当前请求动作不受支持');
  } catch (error) {
    if (error instanceof AdRewardError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[claimAdReward] Unexpected error', {
      name: error && error.name ? error.name : 'Error',
    });
    return buildError('INTERNAL_ERROR', '广告奖励服务暂时不可用，请稍后再试');
  }
};

module.exports._private = {
  AD_REWARD_RULES: AD_REWARD_RULES,
  CLAIMS_COLLECTION: CLAIMS_COLLECTION,
  DAILY_COLLECTION: DAILY_COLLECTION,
  USERS_COLLECTION: USERS_COLLECTION,
  createClaimDocId: createClaimDocId,
  createDailyDocId: createDailyDocId,
  getDateKey: getDateKey,
  isConfiguredAdUnitId: isConfiguredAdUnitId,
  validateEvent: validateEvent,
};
