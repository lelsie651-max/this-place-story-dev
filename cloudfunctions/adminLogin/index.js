const crypto = require('crypto');

let cloud = null;

try {
  cloud = require('wx-server-sdk');
} catch (error) {
  cloud = {
    DYNAMIC_CURRENT_ENV: '',
    init: function init() {},
  };
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const ADMIN_LOGIN_SECRET_ENV = 'ADMIN_LOGIN_SECRET';
const TOKEN_VERSION = 'adminv1';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  FORBIDDEN: true,
  INTERNAL_ERROR: true,
};

class AdminLoginError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminLoginError';
    this.code = code;
  }
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSuccess(result) {
  return Object.assign({
    ok: true,
  }, result);
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

function getAdminSecret() {
  const secret = trimString(process.env[ADMIN_LOGIN_SECRET_ENV]);

  if (!secret) {
    throw new AdminLoginError('INTERNAL_ERROR', '管理员登录服务尚未配置，请先设置 ADMIN_LOGIN_SECRET。');
  }

  return secret;
}

function validateLoginInput(event) {
  const secret = trimString(event && event.secret);

  if (!secret) {
    throw new AdminLoginError('INVALID_INPUT', '请输入管理员密码。');
  }

  if (secret.length > 200) {
    throw new AdminLoginError('INVALID_INPUT', '管理员密码格式无效。');
  }

  return secret;
}

function createReviewerId(adminSecret) {
  return 'admin_' + crypto.createHash('sha256').update(adminSecret, 'utf8').digest('hex').slice(0, 12);
}

function signPayload(payloadText, adminSecret) {
  return crypto.createHmac('sha256', adminSecret).update(payloadText, 'utf8').digest('hex');
}

function createSessionToken(adminSecret, options) {
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const expiresAt = nowMs + TOKEN_TTL_MS;
  const reviewerId = options.reviewerId || createReviewerId(adminSecret);
  const payload = {
    version: TOKEN_VERSION,
    reviewerId: reviewerId,
    issuedAt: nowMs,
    expiresAt: expiresAt,
    scope: 'admin_review',
  };
  const payloadText = JSON.stringify(payload);
  const encodedPayload = encodeBase64Url(payloadText);
  const signature = signPayload(encodedPayload, adminSecret);

  return {
    token: TOKEN_VERSION + '.' + encodedPayload + '.' + signature,
    expiresAt: expiresAt,
    reviewerId: reviewerId,
  };
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function assertValidSecret(inputSecret, adminSecret) {
  if (!timingSafeEqualText(inputSecret, adminSecret)) {
    throw new AdminLoginError('FORBIDDEN', '管理员密码错误。');
  }
}

exports.main = async function main(event) {
  try {
    const inputSecret = validateLoginInput(event);
    const adminSecret = getAdminSecret();

    assertValidSecret(inputSecret, adminSecret);
    return buildSuccess(createSessionToken(adminSecret, {
      reviewerId: createReviewerId(adminSecret),
    }));
  } catch (error) {
    if (error instanceof AdminLoginError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[adminLogin] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '管理员登录失败，请稍后再试。');
  }
};

module.exports._private = {
  ADMIN_LOGIN_SECRET_ENV: ADMIN_LOGIN_SECRET_ENV,
  TOKEN_TTL_MS: TOKEN_TTL_MS,
  TOKEN_VERSION: TOKEN_VERSION,
  assertValidSecret: assertValidSecret,
  createReviewerId: createReviewerId,
  createSessionToken: createSessionToken,
  encodeBase64Url: encodeBase64Url,
  getAdminSecret: getAdminSecret,
  signPayload: signPayload,
  timingSafeEqualText: timingSafeEqualText,
  validateLoginInput: validateLoginInput,
};
