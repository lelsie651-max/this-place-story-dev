export function createLoginFlowError(code, message) {
  const error = new Error(message || '管理员登录失败，请稍后再试。');
  error.code = code || 'INTERNAL_ERROR';
  return error;
}

export function getLoginErrorMessage(error) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.trim() : '';

  if (code === 'ANONYMOUS_AUTH_REQUIRED') {
    return '请在 CloudBase 控制台开启匿名登录后重试。';
  }

  if (code === 'FORBIDDEN' || code === 'INVALID_INPUT') {
    return message || '管理员密码错误。';
  }

  if (code === 'NETWORK_ERROR' || code === 'CLOUD_AUTH_FAILED') {
    return '登录请求失败，请检查云函数部署和网络。';
  }

  return message || '管理员登录失败，请稍后再试。';
}

export function normalizeAdminSession(result) {
  const session = {
    token: typeof result?.token === 'string' ? result.token : '',
    expiresAt: Number(result?.expiresAt || 0),
    reviewerId: typeof result?.reviewerId === 'string' ? result.reviewerId : '',
  };

  if (!session.token || !Number.isFinite(session.expiresAt) || !session.reviewerId) {
    throw createLoginFlowError('INTERNAL_ERROR', '管理员登录返回结果无效，请检查云函数部署。');
  }

  return session;
}

export async function performAdminLogin(secret, dependencies) {
  const loginResult = await dependencies.login(secret);
  const session = normalizeAdminSession(loginResult);

  dependencies.saveSession(session);

  if (typeof dependencies.getSession === 'function') {
    return dependencies.getSession() || session;
  }

  return session;
}
