import cloudbase from '@cloudbase/js-sdk';

const CLOUD_ENV_ID = 'cloud1-d8gpv2fu5feccd009';
const ANONYMOUS_AUTH_REQUIRED_CODE = 'ANONYMOUS_AUTH_REQUIRED';
const ANONYMOUS_AUTH_REQUIRED_MESSAGE = 'CloudBase 匿名登录未成功';
const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

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

function isAnonymousAuthNotEnabledError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';

  return (
    message.indexOf('signInAnonymously') !== -1
    || message.indexOf('匿名登录') !== -1
    || message.indexOf('登录方式未开启') !== -1
    || message.indexOf('Anonymous auth') !== -1
  );
}

function isNetworkError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';

  return (
    message.indexOf('Failed to fetch') !== -1
    || message.indexOf('Network Error') !== -1
    || message.indexOf('network error') !== -1
    || message.indexOf('ERR_NETWORK') !== -1
    || message.indexOf('网络') !== -1
  );
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
        try {
          await auth.anonymousAuthProvider().signIn();
        } catch (error) {
          if (isAnonymousAuthNotEnabledError(error)) {
            throw createApiError(ANONYMOUS_AUTH_REQUIRED_CODE, ANONYMOUS_AUTH_REQUIRED_MESSAGE);
          }

          if (isNetworkError(error)) {
            throw createApiError(NETWORK_ERROR_CODE, '登录请求失败，请检查云函数部署');
          }

          throw createApiError(
            'CLOUD_AUTH_FAILED',
            'CloudBase 鉴权初始化失败，请检查匿名登录配置后重试。'
          );
        }
      }

      return auth;
    }());
  }

  try {
    return await authPromise;
  } catch (error) {
    authPromise = null;
    throw error;
  }
}

function unwrapCloudResult(result) {
  if (result && result.result) {
    return result.result;
  }

  return result || null;
}

function mapCloudError(error, fallbackMessage) {
  if (error && error.code === ANONYMOUS_AUTH_REQUIRED_CODE) {
    return error;
  }

  if (error && error.code === NETWORK_ERROR_CODE) {
    return error;
  }

  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : (fallbackMessage || '请求失败，请稍后再试。');
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : 'INTERNAL_ERROR';

  return createApiError(code, message);
}

async function callAdminFunction(name, data, fallbackMessage) {
  try {
    await ensureCloudReady();
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
    if (isNetworkError(error)) {
      throw createApiError(NETWORK_ERROR_CODE, '登录请求失败，请检查云函数部署');
    }

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

export const _private = {
  ANONYMOUS_AUTH_REQUIRED_CODE,
  ANONYMOUS_AUTH_REQUIRED_MESSAGE,
  NETWORK_ERROR_CODE,
  ensureCloudReady,
  isAnonymousAuthNotEnabledError,
  isNetworkError,
  mapCloudError,
};
