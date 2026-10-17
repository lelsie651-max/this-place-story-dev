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
const STORIES_COLLECTION = 'stories';
const LOCATIONS_COLLECTION = 'locations';
const ALLOWED_ERROR_CODES = {
  UNAUTHORIZED: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class GetMyStoriesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GetMyStoriesError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSuccess(stories) {
  return {
    ok: true,
    stories: stories,
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

function getStatusLabel(status) {
  if (status === 'published') {
    return '已发布';
  }

  if (status === 'rejected') {
    return '未通过';
  }

  return '审核中';
}

async function listStoriesByAuthor(openId) {
  if (!db) {
    throw new GetMyStoriesError('INTERNAL_ERROR', '投稿记录服务暂时不可用');
  }

  try {
    const result = await db
      .collection(STORIES_COLLECTION)
      .where({
        authorId: openId,
        type: 'traveler',
        source: 'user',
      })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return result.data || [];
  } catch (error) {
    throw new GetMyStoriesError('DATABASE_ERROR', '投稿记录读取失败，请稍后再试');
  }
}

async function getLocationNames(locationIds) {
  if (!db || !Array.isArray(locationIds) || locationIds.length === 0) {
    return {};
  }

  const uniqueIds = Array.from(new Set(locationIds.filter(Boolean)));
  const nameMap = {};

  await Promise.all(uniqueIds.map(async function fetchLocationName(locationId) {
    try {
      const result = await db.collection(LOCATIONS_COLLECTION).doc(locationId).get();

      if (result && result.data && result.data.name) {
        nameMap[locationId] = result.data.name;
      }
    } catch (error) {
      // Ignore single location lookup failures and fall back to snapshot name.
    }
  }));

  return nameMap;
}

function normalizeStory(doc, locationNameMap) {
  const snapshot = doc && doc.placeSnapshot && typeof doc.placeSnapshot === 'object'
    ? doc.placeSnapshot
    : null;
  const locationName = snapshot && snapshot.name
    ? snapshot.name
    : (doc && doc.locationId && locationNameMap[doc.locationId] ? locationNameMap[doc.locationId] : '');

  return {
    _id: doc._id,
    title: doc.title || '',
    content: doc.content || '',
    status: doc.status || 'pending',
    statusLabel: getStatusLabel(doc.status),
    locationName: locationName,
    createdAt: doc.createdAt,
  };
}

exports.main = async function main() {
  try {
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new GetMyStoriesError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试');
    }

    const stories = await listStoriesByAuthor(openId);
    const locationIds = stories
      .map(function collectLocationId(story) {
        return story && typeof story.locationId === 'string' ? story.locationId.trim() : '';
      })
      .filter(Boolean);
    const locationNameMap = await getLocationNames(locationIds);
    const normalizedStories = stories.map(function mapStory(story) {
      return normalizeStory(story, locationNameMap);
    });

    return buildSuccess(normalizedStories);
  } catch (error) {
    if (error instanceof GetMyStoriesError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[getMyStories] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '投稿记录读取失败，请稍后再试');
  }
};
