const assert = require('assert');

process.env.ADMIN_LOGIN_SECRET = 'legend-secret';

const adminLogin = require('./index.js');

async function testAdminLoginSuccess() {
  const result = await adminLogin.main({
    secret: 'legend-secret',
  });

  assert.strictEqual(result.ok, true);
  assert.ok(result.token);
  assert.ok(result.expiresAt > Date.now());
  assert.ok(result.reviewerId.indexOf('admin_') === 0);
  assert.strictEqual(result.token.indexOf('legend-secret') === -1, true);
  assert.strictEqual(JSON.stringify(result).indexOf('legend-secret') === -1, true);
}

async function testAdminLoginRejectsWrongSecret() {
  const result = await adminLogin.main({
    secret: 'wrong-secret',
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, 'FORBIDDEN');
}

function testCreateSessionToken() {
  const tokenResult = adminLogin._private.createSessionToken('legend-secret', {
    reviewerId: adminLogin._private.createReviewerId('legend-secret'),
    nowMs: 1000,
  });

  assert.ok(tokenResult.token.startsWith(adminLogin._private.TOKEN_VERSION + '.'));
  assert.strictEqual(tokenResult.expiresAt, 1000 + adminLogin._private.TOKEN_TTL_MS);
}

async function run() {
  const tests = [
    ['Admin login success', testAdminLoginSuccess],
    ['Admin login rejects wrong secret', testAdminLoginRejectsWrongSecret],
    ['Create session token', testCreateSessionToken],
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
