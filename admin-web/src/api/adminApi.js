import cloudbase from '@cloudbase/js-sdk';

const CLOUD_ENV_ID = 'cloud1-d8gpv2fu5feccd009';

let appInstance = null;
let authPromise = null;

function createApiError(code, message) {
  const error = new Error(message || '请求失败，请稍后再试。');
  error.code = code || 'INTERNAL_ERROR';
  return error;
}

function getAppInstance() {
  if (!appInstance) {
    appInstance = cloudbase.init({
      env: CLOUD_ENV_ID,
      clientId: CLOUD_ENV_ID,
    });
  }

  return appInstance;
}

async function ensureCloudReady() {
  if (!authPromise) {
    authPromise = (async function prepareAuth() {
      const app = getAppInstance();
      const auth = app.auth({
        persistence: 'session',
      });
      const loginState = typeof auth.getLoginState === 'function'
        ? await auth.getLoginState()
        : null;

      if (!loginState && auth.anonymousAuthProvider && typeof auth.anonymousAuthProvider === 'function') {
        await auth.anonymousAuthProvider().signIn();
      }

      return auth;
    }());
  }

  return authPromise;
}

function unwrapCloudResult(result) {
  if (result && result.result) {
    return result.result;
  }

  return result || null;
}

function mapCloudError(error, fallbackMessage) {
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : (fallbackMessage || '请求失败，请稍后再试。');
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : 'INTERNAL_ERROR';

  return createApiError(code, message);
}

async function callAdminFunction(name, data, fallbackMessage) {
  await ensureCloudReady();

  try {
    const app = getAppInstance();
    const payload = unwrapCloudResult(await app.callFunction({
      name: name,
      data: data || {},
    }));

    if (!payload || typeof payload.ok !== 'boolean') {
      throw createApiError('INTERNAL_ERROR', fallbackMessage);
    }

    if (!payload.ok) {
      throw createApiError(
        payload?.error?.code || 'INTERNAL_ERROR',
        payload?.error?.message || fallbackMessage
      );
    }

    return payload;
  } catch (error) {
    throw mapCloudError(error, fallbackMessage);
  }
}

export function isAuthError(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  return code === 'FORBIDDEN' || code === 'TOKEN_EXPIRED';
}

export async function login(secret) {
  return callAdminFunction('adminLogin', {
    secret: secret,
  }, '管理员登录失败，请稍后再试。');
}

export async function listStories(session, options) {
  const response = await callAdminFunction('adminListStories', {
    token: session?.token || '',
    status: options?.status || 'pending',
    keyword: options?.keyword || '',
    pageSize: options?.pageSize || 20,
    cursor: options?.cursor || '',
  }, '投稿列表读取失败，请稍后再试。');

  return {
    stories: Array.isArray(response.stories) ? response.stories : [],
    nextCursor: typeof response.nextCursor === 'string' ? response.nextCursor : '',
    hasMore: !!response.hasMore,
    status: response.status || (options?.status || 'pending'),
  };
}

export async function getStoryDetail(session, storyId) {
  const response = await callAdminFunction('adminGetStoryById', {
    token: session?.token || '',
    storyId: storyId,
  }, '投稿详情读取失败，请稍后再试。');

  return response.story || null;
}

export async function reviewStory(session, payload) {
  return callAdminFunction('adminReviewStory', {
    token: session?.token || '',
    storyId: payload?.storyId || '',
    action: payload?.action || '',
    expectedStatus: payload?.expectedStatus || '',
    reason: payload?.reason || '',
  }, '审核提交失败，请稍后再试。');
}
