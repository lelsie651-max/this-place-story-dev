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
const LOCATIONS_COLLECTION = 'locations';
const ADMIN_LOGIN_SECRET_ENV = 'ADMIN_LOGIN_SECRET';
const TOKEN_VERSION = 'adminv1';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_KEYWORD_LENGTH = 30;
const ALLOWED_STATUS_VALUES = {
  pending: true,
  published: true,
  rejected: true,
  hidden: true,
  deleted: true,
  all: true,
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  FORBIDDEN: true,
  TOKEN_EXPIRED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class AdminListStoriesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminListStoriesError';
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

function encodeBase64Url(value) {
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function getAdminSecret() {
  const secret = trimString(process.env[ADMIN_LOGIN_SECRET_ENV]);

  if (!secret) {
    throw new AdminListStoriesError('INTERNAL_ERROR', '管理员服务尚未配置，请先设置 ADMIN_LOGIN_SECRET。');
  }

  return secret;
}

function createReviewerId(adminSecret) {
  return 'admin_' + crypto.createHash('sha256').update(adminSecret, 'utf8').digest('hex').slice(0, 12);
}

function signPayload(payloadText, adminSecret) {
  return crypto.createHmac('sha256', adminSecret).update(payloadText, 'utf8').digest('hex');
}

function parseTokenParts(token) {
  const normalizedToken = trimString(token);
  const tokenParts = normalizedToken.split('.');

  if (tokenParts.length !== 3 || tokenParts[0] !== TOKEN_VERSION) {
    throw new AdminListStoriesError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  return {
    payloadText: tokenParts[1],
    signature: tokenParts[2],
  };
}

function verifyAdminToken(token, adminSecret, nowMs) {
  const tokenParts = parseTokenParts(token);
  const expectedSignature = signPayload(tokenParts.payloadText, adminSecret);

  if (expectedSignature !== tokenParts.signature) {
    throw new AdminListStoriesError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  let payload = null;

  try {
    payload = JSON.parse(decodeBase64Url(tokenParts.payloadText));
  } catch (error) {
    throw new AdminListStoriesError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  if (
    !payload
    || payload.version !== TOKEN_VERSION
    || payload.scope !== 'admin_review'
    || trimString(payload.reviewerId) !== createReviewerId(adminSecret)
  ) {
    throw new AdminListStoriesError('FORBIDDEN', '管理员会话无效，请重新登录。');
  }

  const expiresAt = Number(payload.expiresAt);
  const currentNow = typeof nowMs === 'number' ? nowMs : Date.now();

  if (!Number.isFinite(expiresAt) || expiresAt <= currentNow) {
    throw new AdminListStoriesError('TOKEN_EXPIRED', '管理员会话已过期，请重新登录。');
  }

  return {
    reviewerId: trimString(payload.reviewerId),
    expiresAt: expiresAt,
  };
}

function parseStatus(status) {
  const normalized = trimString(status) || 'pending';

  if (!ALLOWED_STATUS_VALUES[normalized]) {
    throw new AdminListStoriesError('INVALID_INPUT', '状态筛选参数无效。');
  }

  return normalized;
}

function parsePageSize(value) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return DEFAULT_PAGE_SIZE;
  }

  const pageSize = Number(value);

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new AdminListStoriesError('INVALID_INPUT', 'pageSize 必须在 1 到 50 之间。');
  }

  return pageSize;
}

function parseCursor(cursor) {
  const normalized = trimString(cursor);

  if (!normalized) {
    return 0;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(normalized));
    const offset = Number(parsed && parsed.offset);

    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('invalid');
    }

    return offset;
  } catch (error) {
    throw new AdminListStoriesError('INVALID_INPUT', 'cursor 参数无效。');
  }
}

function buildCursor(offset) {
  return encodeBase64Url(JSON.stringify({
    offset: offset,
  }));
}

function validateKeyword(value) {
  const keyword = trimString(value);

  if (!keyword) {
    return '';
  }

  if (keyword.length > MAX_KEYWORD_LENGTH) {
    throw new AdminListStoriesError('INVALID_INPUT', '关键字长度不能超过 30 个字符。');
  }

  return keyword;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function buildAuthorDisplayId(authorId) {
  const normalized = trimString(authorId);

  if (!normalized) {
    return '投稿者#未知';
  }

  return '投稿者#' + crypto.createHash('sha1').update(normalized, 'utf8').digest('hex').slice(0, 8);
}

function normalizeModerationStatus(value) {
  return trimString(value) || 'manual_only';
}

function normalizeManualReviewRequired(value) {
  return typeof value === 'boolean' ? value : true;
}

function buildListQuery(actor, options) {
  const query = {
    source: 'user',
    type: 'traveler',
  };
  const command = actor && actor.command ? actor.command : _;

  if (options.status === 'all') {
    if (command && typeof command.neq === 'function') {
      query.status = command.neq('deleted');
    }
  } else if (options.status) {
    query.status = options.status;
  }

  if (options.keyword && db && typeof db.RegExp === 'function') {
    query.title = db.RegExp({
      regexp: escapeRegExp(options.keyword),
      options: 'i',
    });
  }

  return query;
}

async function listStoryDocs(actor, options) {
  if (!actor) {
    throw new AdminListStoriesError('INTERNAL_ERROR', '管理员列表服务暂时不可用。');
  }

  const offset = parseCursor(options.cursor);
  const query = buildListQuery(actor, options);

  try {
    const result = await actor
      .collection(STORIES_COLLECTION)
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip(offset)
      .limit(options.pageSize + 1)
      .get();
    const rawDocs = result && Array.isArray(result.data) ? result.data : [];
    const docs = rawDocs.filter(function filterDoc(doc) {
      const status = trimString(doc && doc.status);

      if (options.status === 'all' && status === 'deleted') {
        return false;
      }

      if (!options.keyword) {
        return true;
      }

      const title = trimString(doc && doc.title);
      const summary = trimString(doc && doc.summary);
      return title.indexOf(options.keyword) !== -1 || summary.indexOf(options.keyword) !== -1;
    });
    const hasMore = docs.length > options.pageSize || rawDocs.length > options.pageSize;
    const selectedDocs = docs.slice(0, options.pageSize);

    return {
      docs: selectedDocs,
      nextCursor: hasMore ? buildCursor(offset + selectedDocs.length) : '',
      hasMore: hasMore,
    };
  } catch (error) {
    throw new AdminListStoriesError('DATABASE_ERROR', '投稿列表读取失败，请稍后再试。');
  }
}

async function getLocationNameMap(actor, locationIds) {
  if (!actor || !Array.isArray(locationIds) || locationIds.length === 0) {
    return {};
  }

  const uniqueIds = Array.from(new Set(locationIds.filter(Boolean)));
  const nameMap = {};

  await Promise.all(uniqueIds.map(async function fetchLocationName(locationId) {
    try {
      const result = await actor.collection(LOCATIONS_COLLECTION).doc(locationId).get();
      const locationName = trimString(result && result.data && result.data.name);

      if (locationName) {
        nameMap[locationId] = locationName;
      }
    } catch (error) {
      // Ignore single lookup failures and fall back to placeSnapshot.
    }
  }));

  return nameMap;
}

function normalizeStoryListItem(doc, locationNameMap) {
  const placeSnapshot = doc && doc.placeSnapshot && typeof doc.placeSnapshot === 'object'
    ? doc.placeSnapshot
    : null;
  const locationId = trimString(doc && doc.locationId);
  const snapshotName = trimString(placeSnapshot && placeSnapshot.name);
  const locationName = snapshotName || (locationId && locationNameMap[locationId]) || '';
  const status = trimString(doc && doc.status) || 'pending';

  return {
    storyId: trimString(doc && doc._id),
    title: trimString(doc && doc.title),
    summary: trimString(doc && doc.summary),
    locationName: locationName,
    authorDisplayId: buildAuthorDisplayId(doc && doc.authorId),
    status: status,
    statusLabel: getAdminStatusLabel(status),
    moderationStatus: normalizeModerationStatus(doc && doc.moderationStatus),
    manualReviewRequired: normalizeManualReviewRequired(doc && doc.manualReviewRequired),
    createdAt: typeof (doc && doc.createdAt) === 'undefined' ? null : doc.createdAt,
    updatedAt: typeof (doc && doc.updatedAt) === 'undefined' ? null : doc.updatedAt,
    rejectionReason: trimString(doc && doc.rejectionReason),
    reviewedAt: typeof (doc && doc.reviewedAt) === 'undefined' ? null : doc.reviewedAt,
  };
}

exports.main = async function main(event) {
  try {
    const adminSecret = getAdminSecret();
    const token = trimString(event && event.token);

    verifyAdminToken(token, adminSecret);

    const status = parseStatus(event && event.status);
    const pageSize = parsePageSize(event && event.pageSize);
    const keyword = validateKeyword(event && event.keyword);
    const listResult = await listStoryDocs(db, {
      status: status,
      pageSize: pageSize,
      cursor: event && event.cursor,
      keyword: keyword,
    });
    const locationNameMap = await getLocationNameMap(
      db,
      listResult.docs.map(function collectLocationId(doc) {
        return trimString(doc && doc.locationId);
      }).filter(Boolean)
    );

    return buildSuccess({
      stories: listResult.docs.map(function mapStory(doc) {
        return normalizeStoryListItem(doc, locationNameMap);
      }),
      nextCursor: listResult.nextCursor,
      hasMore: listResult.hasMore,
      status: status,
    });
  } catch (error) {
    if (error instanceof AdminListStoriesError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[adminListStories] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '投稿列表读取失败，请稍后再试。');
  }
};

module.exports._private = {
  ALLOWED_STATUS_VALUES: ALLOWED_STATUS_VALUES,
  DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE: MAX_PAGE_SIZE,
  buildAuthorDisplayId: buildAuthorDisplayId,
  buildCursor: buildCursor,
  buildListQuery: buildListQuery,
  createReviewerId: createReviewerId,
  decodeBase64Url: decodeBase64Url,
  encodeBase64Url: encodeBase64Url,
  getAdminSecret: getAdminSecret,
  getAdminStatusLabel: getAdminStatusLabel,
  getLocationNameMap: getLocationNameMap,
  listStoryDocs: listStoryDocs,
  normalizeManualReviewRequired: normalizeManualReviewRequired,
  normalizeModerationStatus: normalizeModerationStatus,
  normalizeStoryListItem: normalizeStoryListItem,
  parseCursor: parseCursor,
  parsePageSize: parsePageSize,
  parseStatus: parseStatus,
  signPayload: signPayload,
  validateKeyword: validateKeyword,
  verifyAdminToken: verifyAdminToken,
};
