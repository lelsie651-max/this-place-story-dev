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
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  UNAUTHORIZED: true,
  STORY_NOT_FOUND: true,
  FORBIDDEN: true,
  STATUS_NOT_DELETABLE: true,
  DATABASE_ERROR: true,
  INTERNAL_ERROR: true,
};

class DeleteMyStoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeleteMyStoryError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSuccess(storyId) {
  return {
    ok: true,
    storyId: storyId,
    deleted: true,
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

function validateStoryId(event) {
  const storyId = trimString(event && event.storyId);

  if (!storyId) {
    throw new DeleteMyStoryError('INVALID_INPUT', 'storyId 不能为空');
  }

  if (storyId.length > 128) {
    throw new DeleteMyStoryError('INVALID_INPUT', 'storyId 格式无效');
  }

  return storyId;
}

async function getStoryByIdWithActor(actor, storyId) {
  if (!actor) {
    throw new DeleteMyStoryError('INTERNAL_ERROR', '删除服务暂时不可用');
  }

  try {
    const result = await actor.collection(STORIES_COLLECTION).doc(storyId).get();

    if (!result || !result.data) {
      throw new DeleteMyStoryError('STORY_NOT_FOUND', '当前投稿不存在或已不可删除');
    }

    return result.data;
  } catch (error) {
    if (error instanceof DeleteMyStoryError) {
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
      throw new DeleteMyStoryError('STORY_NOT_FOUND', '当前投稿不存在或已不可删除');
    }

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new DeleteMyStoryError('DATABASE_ERROR', '投稿删除权限异常，请检查云开发配置');
    }

    throw new DeleteMyStoryError('DATABASE_ERROR', '投稿读取失败，请稍后再试');
  }
}

function assertDeletableStory(doc, openId) {
  const normalizedOpenId = trimString(openId);

  if (!doc || typeof doc !== 'object') {
    throw new DeleteMyStoryError('STORY_NOT_FOUND', '当前投稿不存在或已不可删除');
  }

  if (trimString(doc.source) !== 'user' || trimString(doc.type) !== 'traveler') {
    throw new DeleteMyStoryError('FORBIDDEN', '当前投稿暂不支持删除');
  }

  if (trimString(doc.authorId) !== normalizedOpenId) {
    throw new DeleteMyStoryError('FORBIDDEN', '当前投稿暂不支持删除');
  }

  if (trimString(doc.status) !== 'rejected') {
    throw new DeleteMyStoryError('STATUS_NOT_DELETABLE', '当前状态暂不支持删除');
  }

  return doc;
}

async function softDeleteStoryWithActor(actor, storyId) {
  if (!actor) {
    throw new DeleteMyStoryError('INTERNAL_ERROR', '删除服务暂时不可用');
  }

  const updatedAt = actor.serverDate();
  const deletedAt = actor.serverDate();

  try {
    await actor.collection(STORIES_COLLECTION).doc(storyId).update({
      data: {
        status: 'deleted',
        deletedAt: deletedAt,
        updatedAt: updatedAt,
      },
    });
  } catch (error) {
    const message = error && error.message ? String(error.message) : '';

    if (message.indexOf('permission') !== -1 || message.indexOf('Permission') !== -1) {
      throw new DeleteMyStoryError('DATABASE_ERROR', '投稿删除权限异常，请检查云开发配置');
    }

    throw new DeleteMyStoryError('DATABASE_ERROR', '投稿删除失败，请稍后再试');
  }
}

exports.main = async function main(event) {
  try {
    const storyId = validateStoryId(event);
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      throw new DeleteMyStoryError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试');
    }

    const story = await getStoryByIdWithActor(db, storyId);

    assertDeletableStory(story, openId);
    await softDeleteStoryWithActor(db, storyId);

    return buildSuccess(storyId);
  } catch (error) {
    if (error instanceof DeleteMyStoryError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[deleteMyStory] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '投稿删除失败，请稍后再试');
  }
};

module.exports._private = {
  assertDeletableStory: assertDeletableStory,
  getStoryByIdWithActor: getStoryByIdWithActor,
  softDeleteStoryWithActor: softDeleteStoryWithActor,
  validateStoryId: validateStoryId,
};
