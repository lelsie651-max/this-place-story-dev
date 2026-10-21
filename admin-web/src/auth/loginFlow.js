export function createLoginFlowError(code, message) {
  const error = new Error(message || '管理员登录失败，请稍后再试。');
  error.code = code || 'INTERNAL_ERROR';
  return error;
}

export function validateAdminSecretInput(secret) {
  const normalizedSecret = typeof secret === 'string' ? secret.trim() : '';

  if (!normalizedSecret) {
    throw createLoginFlowError('INVALID_INPUT', '请输入管理员密码');
  }

  return normalizedSecret;
}

export function getLoginErrorMessage(error) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.trim() : '';

  if (code === 'ANONYMOUS_AUTH_REQUIRED') {
    return 'CloudBase 匿名登录未成功';
  }

  if (code === 'FORBIDDEN' || code === 'INVALID_INPUT') {
    return message || '管理员密码错误';
  }

  if (code === 'NETWORK_ERROR' || code === 'CLOUD_AUTH_FAILED') {
    return '登录请求失败，请检查云函数部署';
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
  const normalizedSecret = validateAdminSecretInput(secret);
  const loginResult = await dependencies.login(normalizedSecret);
  const session = normalizeAdminSession(loginResult);

  dependencies.saveSession(session);

  if (typeof dependencies.getSession === 'function') {
    return dependencies.getSession() || session;
  }

  return session;
}
