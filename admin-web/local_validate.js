import assert from 'node:assert';

import { getLoginErrorMessage, normalizeAdminSession, performAdminLogin } from './src/auth/loginFlow.js';
import { clearSession, getSession, saveSession } from './src/auth/session.js';
import { renderLoginPageMarkup } from './src/pages/LoginPage.js';

function createSessionStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function setupWindow() {
  global.window = {
    sessionStorage: createSessionStorage(),
  };
}

function clearWindow() {
  delete global.window;
}

function testAnonymousLoginErrorShowsVisibleMessage() {
  const errorMessage = getLoginErrorMessage({
    code: 'ANONYMOUS_AUTH_REQUIRED',
    message: '登录方式未开启',
  });
  const markup = renderLoginPageMarkup({
    loading: false,
    errorMessage: errorMessage,
  });

  assert.strictEqual(errorMessage, '请在 CloudBase 控制台开启匿名登录后重试。');
  assert.ok(markup.includes('请在 CloudBase 控制台开启匿名登录后重试。'));
}

function testAdminLoginErrorShowsVisibleMessage() {
  const errorMessage = getLoginErrorMessage({
    code: 'FORBIDDEN',
    message: '管理员密码错误。',
  });
  const markup = renderLoginPageMarkup({
    loading: false,
    errorMessage: errorMessage,
  });

  assert.strictEqual(errorMessage, '管理员密码错误。');
  assert.ok(markup.includes('管理员密码错误。'));
}

async function testCorrectPasswordSavesToken() {
  setupWindow();

  const session = await performAdminLogin('secret', {
    async login() {
      return {
        token: 'token-1',
        expiresAt: Date.now() + 60 * 1000,
        reviewerId: 'admin_1',
      };
    },
    saveSession: saveSession,
    getSession: getSession,
  });

  assert.strictEqual(session.token, 'token-1');
  assert.strictEqual(getSession().token, 'token-1');
  clearWindow();
}

async function testWrongPasswordDoesNotSaveToken() {
  setupWindow();
  clearSession();

  await assert.rejects(async function rejectWrongPassword() {
    await performAdminLogin('secret', {
      async login() {
        const error = new Error('管理员密码错误。');
        error.code = 'FORBIDDEN';
        throw error;
      },
      saveSession: saveSession,
      getSession: getSession,
    });
  });

  assert.strictEqual(getSession(), null);
  clearWindow();
}

function testNormalizeAdminSessionRejectsInvalidPayload() {
  assert.throws(function rejectInvalidPayload() {
    normalizeAdminSession({
      token: '',
      expiresAt: 0,
      reviewerId: '',
    });
  }, /管理员登录返回结果无效/);
}

async function run() {
  const tests = [
    ['Anonymous login error shows visible message', testAnonymousLoginErrorShowsVisibleMessage],
    ['Admin login error shows visible message', testAdminLoginErrorShowsVisibleMessage],
    ['Correct password saves token', testCorrectPasswordSavesToken],
    ['Wrong password does not save token', testWrongPasswordDoesNotSaveToken],
    ['Normalize admin session rejects invalid payload', testNormalizeAdminSessionRejectsInvalidPayload],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
