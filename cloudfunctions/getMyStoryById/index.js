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
  INVALID_INPUT: true,
  UNAUTHORIZED: true,
  STORY_NOT_FOUND: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class GetMyStoryByIdError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GetMyStoryByIdError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSuccess(story) {
  return {
    ok: true,
    story: story,
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
    return '已通过';
  }

  if (status === 'rejected') {
    return '未通过';
  }

  if (status === 'hidden') {
    return '已隐藏';
  }

  return '审核中';
}

function validateStoryId(event) {
  const storyId = trimString(event && event.storyId);

  if (!storyId) {
    throw new GetMyStoryByIdError('INVALID_INPUT', 'storyId 不能为空');
  }

  if (storyId.length > 128) {
    throw new GetMyStoryByIdError('INVALID_INPUT', 'storyId 格式无效');
  }

  return storyId;
}

async function getStoryByAuthorWithActor(actor, storyId, openId) {
  if (!actor) {
    throw new GetMyStoryByIdError('INTERNAL_ERROR', '投稿详情服务暂时不可用');
  }

  try {
    const result = await actor
      .collection(STORIES_COLLECTION)
      .where({
        _id: storyId,
        authorId: openId,
        source: 'user',
        type: 'traveler',
      })
      .limit(1)
      .get();
    const stories = result && Array.isArray(result.data) ? result.data : [];

    if (stories.length === 0) {
      throw new GetMyStoryByIdError('STORY_NOT_FOUND', '当前投稿不存在或暂不可查看');
    }

    return stories[0];
  } catch (error) {
    if (error instanceof GetMyStoryByIdError) {
      throw error;
    }

    const message = error && error.message ? String(error.message) : '';

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new GetMyStoryByIdError('DATABASE_ERROR', '投稿详情读取权限异常，请检查云开发配置');
    }

    throw new GetMyStoryByIdError('DATABASE_ERROR', '投稿详情读取失败，请稍后再试');
  }
}

async function getLocationNameWithActor(actor, locationId) {
  if (!actor || !locationId) {
    return '';
  }

  try {
    const result = await actor.collection(LOCATIONS_COLLECTION).doc(locationId).get();
    return result && result.data && result.data.name ? trimString(result.data.name) : '';
  } catch (error) {
    return '';
  }
}

async function normalizeStoryWithActor(actor, doc) {
  const snapshot = doc && doc.placeSnapshot && typeof doc.placeSnapshot === 'object'
    ? doc.placeSnapshot
    : null;
  const snapshotName = trimString(snapshot && snapshot.name);
  const locationId = trimString(doc && doc.locationId);
  const locationName = snapshotName || await getLocationNameWithActor(actor, locationId);

  return {
    id: trimString(doc && doc._id),
    title: trimString(doc && doc.title),
    content: trimString(doc && doc.content),
    summary: trimString(doc && doc.summary),
    status: trimString(doc && doc.status) || 'pending',
    statusLabel: getStatusLabel(doc && doc.status),
    rejectionReason: trimString(doc && doc.rejectionReason),
    locationId: locationId || null,
    isTemporary: !!(doc && doc.isTemporary),
    placeSnapshot: snapshot,
    locationName: locationName,
    createdAt: doc && doc.createdAt ? doc.createdAt : null,
    updatedAt: doc && doc.updatedAt ? doc.updatedAt : null,
  };
}

exports.main = async function main(event) {
  try {
    const storyId = validateStoryId(event);
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new GetMyStoryByIdError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试');
    }

    const story = await getStoryByAuthorWithActor(db, storyId, openId);
    return buildSuccess(await normalizeStoryWithActor(db, story));
  } catch (error) {
    if (error instanceof GetMyStoryByIdError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[getMyStoryById] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '投稿详情读取失败，请稍后再试');
  }
};

module.exports._private = {
  getStatusLabel: getStatusLabel,
  validateStoryId: validateStoryId,
  getStoryByAuthorWithActor: getStoryByAuthorWithActor,
  normalizeStoryWithActor: normalizeStoryWithActor,
};
