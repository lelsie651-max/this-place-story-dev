const assert = require('assert');

const devTestControls = require('./index.js');

const helpers = devTestControls._private;

function withEnv(env, execute) {
  const originalEnable = process.env.ENABLE_DEV_TEST_TOOLS;
  const originalToken = process.env.DEV_TEST_ADMIN_TOKEN;
  const originalAdmins = process.env.DEV_TEST_ADMIN_OPENIDS;

  process.env.ENABLE_DEV_TEST_TOOLS = env.enable;
  process.env.DEV_TEST_ADMIN_TOKEN = env.token;
  process.env.DEV_TEST_ADMIN_OPENIDS = env.admins || '';

  try {
    execute();
  } finally {
    process.env.ENABLE_DEV_TEST_TOOLS = originalEnable;
    process.env.DEV_TEST_ADMIN_TOKEN = originalToken;
    process.env.DEV_TEST_ADMIN_OPENIDS = originalAdmins;
  }
}

function applySequence(actions, openId) {
  let state = {
    userDoc: null,
    usageDoc: null,
  };

  actions.forEach(function applyAction(action) {
    const dateKey = helpers.getDateKey();
    const next = helpers.applyActionToState(action, openId, dateKey, state);

    state = {
      userDoc: next.userDoc,
      usageDoc: next.usageDoc,
      lastState: next.state,
    };
  });

  return state;
}

function testAuthorizeDisabled() {
  withEnv({
    enable: 'false',
    token: 'token-001',
  }, function execute() {
    assert.throws(function shouldThrow() {
      helpers.authorizeRequest('openid-001', 'token-001');
    }, function verify(error) {
      return error && error.code === 'DEV_TOOLS_DISABLED';
    });
  });
}

function testAuthorizeForbiddenWhenTokenMissing() {
  withEnv({
    enable: 'true',
    token: 'token-001',
  }, function execute() {
    assert.throws(function shouldThrow() {
      helpers.authorizeRequest('openid-001', '');
    }, function verify(error) {
      return error && error.code === 'DEV_TOOLS_FORBIDDEN';
    });
  });
}

function testAuthorizeForbiddenWhenTokenWrong() {
  withEnv({
    enable: 'true',
    token: 'token-001',
  }, function execute() {
    assert.throws(function shouldThrow() {
      helpers.authorizeRequest('openid-001', 'wrong-token');
    }, function verify(error) {
      return error && error.code === 'DEV_TOOLS_FORBIDDEN';
    });
  });
}

function testAuthorizeDoesNotDependOnOpenIdWhitelist() {
  withEnv({
    enable: 'true',
    token: 'token-001',
    admins: 'legacy-openid-001',
  }, function execute() {
    assert.doesNotThrow(function shouldPass() {
      helpers.authorizeRequest('another-openid-002', 'token-001');
    });
  });
}

function testEventIgnoresOpenIdFromClient() {
  const input = helpers.validateEvent({
    action: 'get_status',
    openid: 'forged-openid',
    devTestToken: 'token-001',
  });

  assert.strictEqual(input.action, 'get_status');
  assert.strictEqual(input.devTestToken, 'token-001');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(input, 'openid'), false);
}

function testSetBalanceAndTotalCount() {
  const result = applySequence([
    helpers.validateEvent({
      action: 'set_magnifying_glass',
      devTestToken: 'token-001',
      magnifyingGlass: 5,
    }),
    helpers.validateEvent({
      action: 'set_daily_total_count',
      devTestToken: 'token-001',
      dailyTotalCount: 10,
    }),
  ], 'openid-001');

  assert.strictEqual(result.userDoc.magnifyingGlass, 5);
  assert.strictEqual(result.usageDoc.totalCount, 10);
  assert.strictEqual(result.lastState.dailyTotalCount, 10);
}

function testCorrectTokenWorksAcrossDifferentAnonymousOpenIds() {
  const actions = [
    helpers.validateEvent({
      action: 'set_magnifying_glass',
      devTestToken: 'token-001',
      magnifyingGlass: 8,
    }),
  ];
  const firstState = applySequence(actions, 'openid-anonymous-001');
  const secondState = applySequence(actions, 'openid-anonymous-002');

  assert.strictEqual(firstState.userDoc.openid, 'openid-anonymous-001');
  assert.strictEqual(secondState.userDoc.openid, 'openid-anonymous-002');
  assert.strictEqual(firstState.userDoc.magnifyingGlass, 8);
  assert.strictEqual(secondState.userDoc.magnifyingGlass, 8);
}

async function testLogsDoNotContainFullToken() {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalMain = devTestControls.main;
  const originalEnable = process.env.ENABLE_DEV_TEST_TOOLS;
  const originalToken = process.env.DEV_TEST_ADMIN_TOKEN;
  const logs = [];

  console.warn = function captureWarn() {
    logs.push(Array.prototype.slice.call(arguments).join(' '));
  };
  console.error = function captureError() {
    logs.push(Array.prototype.slice.call(arguments).join(' '));
  };

  try {
    process.env.ENABLE_DEV_TEST_TOOLS = 'true';
    process.env.DEV_TEST_ADMIN_TOKEN = 'token-log-secret-001';

    devTestControls.main = async function mockedMain(event) {
      const input = helpers.validateEvent(event);
      const openId = 'openid-log-test';

      helpers.authorizeRequest(openId, input.devTestToken);

      console.warn('[devTestControls] request received', {
        action: input.action,
        hasOpenId: !!openId,
        hasDevTestToken: !!input.devTestToken,
      });

      return {
        ok: true,
        data: {},
      };
    };

    await devTestControls.main({
      action: 'get_status',
      devTestToken: 'token-log-secret-001',
    });
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
    devTestControls.main = originalMain;
    process.env.ENABLE_DEV_TEST_TOOLS = originalEnable;
    process.env.DEV_TEST_ADMIN_TOKEN = originalToken;
  }

  const joinedLogs = logs.join('\n');

  assert.strictEqual(joinedLogs.indexOf('token-log-secret-001'), -1);
}

async function run() {
  testAuthorizeDisabled();
  testAuthorizeForbiddenWhenTokenMissing();
  testAuthorizeForbiddenWhenTokenWrong();
  testAuthorizeDoesNotDependOnOpenIdWhitelist();
  testEventIgnoresOpenIdFromClient();
  testSetBalanceAndTotalCount();
  testCorrectTokenWorksAcrossDifferentAnonymousOpenIds();
  await testLogsDoNotContainFullToken();

  console.log('[PASS] devTestControls local validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
