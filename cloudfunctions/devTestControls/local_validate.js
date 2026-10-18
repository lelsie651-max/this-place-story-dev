const assert = require('assert');

const devTestControls = require('./index.js');

const helpers = devTestControls._private;

function withEnv(env, execute) {
  const originalEnable = process.env.ENABLE_DEV_TEST_TOOLS;
  const originalAdmins = process.env.DEV_TEST_ADMIN_OPENIDS;

  process.env.ENABLE_DEV_TEST_TOOLS = env.enable;
  process.env.DEV_TEST_ADMIN_OPENIDS = env.admins;

  try {
    execute();
  } finally {
    process.env.ENABLE_DEV_TEST_TOOLS = originalEnable;
    process.env.DEV_TEST_ADMIN_OPENIDS = originalAdmins;
  }
}

function applySequence(actions) {
  let state = {
    userDoc: null,
    usageDoc: null,
  };

  actions.forEach(function applyAction(action) {
    const dateKey = helpers.getDateKey();
    const next = helpers.applyActionToState(action, 'admin-openid-001', dateKey, state);

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
    admins: 'admin-openid-001',
  }, function execute() {
    assert.throws(function shouldThrow() {
      helpers.authorizeRequest('admin-openid-001');
    }, function verify(error) {
      return error && error.code === 'DEV_TOOLS_DISABLED';
    });
  });
}

function testAuthorizeForbidden() {
  withEnv({
    enable: 'true',
    admins: 'admin-openid-001',
  }, function execute() {
    assert.throws(function shouldThrow() {
      helpers.authorizeRequest('other-openid');
    }, function verify(error) {
      return error && error.code === 'DEV_TOOLS_FORBIDDEN';
    });
  });
}

function testEventIgnoresOpenIdFromClient() {
  const input = helpers.validateEvent({
    action: 'get_status',
    openid: 'forged-openid',
  });

  assert.strictEqual(input.action, 'get_status');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(input, 'openid'), false);
}

function testSetBalanceAndTotalCount() {
  const result = applySequence([
    helpers.validateEvent({
      action: 'set_magnifying_glass',
      magnifyingGlass: 5,
    }),
    helpers.validateEvent({
      action: 'set_daily_total_count',
      dailyTotalCount: 10,
    }),
  ]);

  assert.strictEqual(result.userDoc.magnifyingGlass, 5);
  assert.strictEqual(result.usageDoc.totalCount, 10);
  assert.strictEqual(result.lastState.dailyTotalCount, 10);
}

function testSetAndClearLocationTypeCount() {
  const selector = {
    locationKey: 'loc-demo-001',
    storyType: 'AI说',
  };
  const result = applySequence([
    helpers.validateEvent({
      action: 'set_location_type_count',
      locationKey: selector.locationKey,
      storyType: selector.storyType,
      locationTypeCount: 3,
    }),
  ]);

  assert.strictEqual(result.lastState.locationTypeCount, 3);

  const cleared = helpers.applyActionToState(
    helpers.validateEvent({
      action: 'clear_location_type_count',
      locationKey: selector.locationKey,
      storyType: selector.storyType,
    }),
    'admin-openid-001',
    helpers.getDateKey(),
    result
  );

  assert.strictEqual(cleared.state.locationTypeCount, 0);
}

function testClearRequestLock() {
  const dateKey = helpers.getDateKey();
  const currentState = {
    userDoc: helpers.buildUserDocument('admin-openid-001', null, 5),
    usageDoc: helpers.buildUsageDocument({
      dateKey: dateKey,
      userId: 'admin-openid-001',
      existingUsage: {
        activeRequestId: 'req-001',
        activeLocationKey: 'loc-demo-001',
        activeStoryType: 'AI说',
        requestLockUntil: 999999,
      },
    }),
  };
  const next = helpers.applyActionToState(
    helpers.validateEvent({
      action: 'clear_request_lock',
    }),
    'admin-openid-001',
    dateKey,
    currentState
  );

  assert.strictEqual(next.usageDoc.activeRequestId, '');
  assert.strictEqual(next.usageDoc.requestLockUntil, 0);
  assert.strictEqual(next.state.hasRequestLock, false);
}

function testResetTodayState() {
  const result = applySequence([
    helpers.validateEvent({
      action: 'set_magnifying_glass',
      magnifyingGlass: 1,
    }),
    helpers.validateEvent({
      action: 'set_daily_total_count',
      dailyTotalCount: 9,
    }),
    helpers.validateEvent({
      action: 'set_location_type_count',
      locationKey: 'loc-demo-001',
      storyType: '民间传说',
      locationTypeCount: 3,
    }),
    helpers.validateEvent({
      action: 'reset_today_state',
      magnifyingGlass: 10,
    }),
  ]);

  assert.strictEqual(result.userDoc.magnifyingGlass, 10);
  assert.strictEqual(result.usageDoc.totalCount, 0);
  assert.deepStrictEqual(result.usageDoc.locationTypeCounts, {});
  assert.deepStrictEqual(result.usageDoc.recentRequestIds, []);
  assert.strictEqual(result.usageDoc.requestLockUntil, 0);
}

function run() {
  testAuthorizeDisabled();
  testAuthorizeForbidden();
  testEventIgnoresOpenIdFromClient();
  testSetBalanceAndTotalCount();
  testSetAndClearLocationTypeCount();
  testClearRequestLock();
  testResetTodayState();

  console.log('[PASS] devTestControls local validation complete');
}

run();
