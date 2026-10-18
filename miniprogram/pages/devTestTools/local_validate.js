const assert = require('assert');

const userService = require('../../services/userService');
const storyService = require('../../services/storyService');

let capturedPageConfig = null;
let currentApp = null;
let currentWx = null;
let currentEnvVersion = 'develop';
let currentOpenId = 'openid-anonymous-001';
let storageState = {};

global.getApp = function getApp() {
  return currentApp;
};

global.Page = function capturePage(config) {
  capturedPageConfig = config;
};

global.getCurrentPages = function getCurrentPages() {
  return [];
};

function wait(ms) {
  return new Promise(function resolveLater(resolve) {
    setTimeout(resolve, ms);
  });
}

function requirePage(relativePath) {
  capturedPageConfig = null;
  delete require.cache[require.resolve(relativePath)];
  require(relativePath);

  if (!capturedPageConfig) {
    throw new Error('Failed to capture page config: ' + relativePath);
  }

  return capturedPageConfig;
}

function createPageInstance(pageConfig, extraData) {
  const instance = {
    data: Object.assign({}, pageConfig.data, extraData || {}),
    requestLock: false,
    setData(update) {
      this.data = Object.assign({}, this.data, update);
    },
  };

  Object.keys(pageConfig).forEach(function attachMethod(key) {
    if (typeof pageConfig[key] === 'function') {
      instance[key] = pageConfig[key];
    }
  });

  return instance;
}

function createLocationPageEvent(type, label) {
  return {
    currentTarget: {
      dataset: {
        type: type,
        enabled: true,
        label: label,
      },
    },
  };
}

function createDevPresetEvent(value) {
  return {
    currentTarget: {
      dataset: {
        value: String(value),
      },
    },
  };
}

function createFormalLocationDetail() {
  return {
    id: 'loc-demo-001',
    locationId: 'loc-demo-001',
    isTemporary: false,
    transientPlace: false,
    name: '南头古城',
    city: '深圳',
    address: '深圳市南山区南头古城',
    intro: '一座保留古城肌理、游客与居民交错生活的老城。',
  };
}

function getCountKey(locationKey, storyType) {
  return locationKey + '::' + storyType;
}

function setupSharedMocks() {
  const state = {
    expectedToken: 'correct-dev-token',
    magnifyingGlass: 5,
    dailyTotalCount: 0,
    locationTypeCounts: {},
    requestLockUntil: 0,
    activeRequestId: '',
    activeLocationKey: '',
    activeStoryType: '',
    getDevStateCalls: 0,
  };

  currentApp = {
    globalData: {
      miniProgramEnvVersion: currentEnvVersion,
      cloudReady: true,
      rewardedVideoAdUnitId: '',
      devTestToolsUpdatedAt: 0,
    },
  };

  currentWx = {
    getAccountInfoSync() {
      return {
        miniProgram: {
          envVersion: currentEnvVersion,
        },
      };
    },
    getStorageSync(key) {
      return storageState[key];
    },
    setStorageSync(key, value) {
      storageState[key] = value;
    },
    removeStorageSync(key) {
      delete storageState[key];
    },
    showToast(options) {
      state.lastToast = options;
    },
    navigateTo(options) {
      state.lastNavigateUrl = options.url;
      options.success({
        errMsg: 'navigateTo:ok',
      });
    },
    cloud: {
      callFunction() {
        throw new Error('generateStory should not be called in dev test validation.');
      },
    },
  };

  global.wx = currentWx;

  function assertToken(payload) {
    const devTestToken = payload && payload.devTestToken ? String(payload.devTestToken) : '';

    if (currentEnvVersion === 'release') {
      const error = new Error('开发测试工具未开启');
      error.code = 'DEV_TOOLS_DISABLED';
      throw error;
    }

    if (!devTestToken || devTestToken !== state.expectedToken) {
      const error = new Error('开发测试工具口令不正确');
      error.code = 'DEV_TOOLS_FORBIDDEN';
      throw error;
    }
  }

  function buildDevState(payload) {
    const selector = payload && payload.locationKey
      ? getCountKey(payload.locationKey, payload.storyType)
      : '';

    return {
      magnifyingGlass: state.magnifyingGlass,
      dailyTotalCount: state.dailyTotalCount,
      locationTypeCount: selector ? (state.locationTypeCounts[selector] || 0) : 0,
      requestLockUntil: state.requestLockUntil,
      activeLocationKey: state.activeLocationKey,
      activeStoryType: state.activeStoryType,
      hasRequestLock: !!state.activeRequestId && state.requestLockUntil > 0,
    };
  }

  userService.getCurrentUserProfile = async function getCurrentUserProfileMock() {
    return {
      magnifyingGlass: state.magnifyingGlass,
      openid: currentOpenId,
    };
  };

  userService.prepareMagnifyingGlassUsage = async function prepareMagnifyingGlassUsageMock(payload) {
    const countKey = getCountKey(payload.locationKey, payload.storyType);

    if (state.activeRequestId && state.activeRequestId !== payload.requestId && state.requestLockUntil > Date.now()) {
      const error = new Error('当前探索处理中，请稍后再试。');
      error.code = 'MAGNIFYING_GLASS_CONCURRENT_REQUEST';
      throw error;
    }

    if (state.magnifyingGlass < 1) {
      const error = new Error('放大镜不足，暂时无法继续探索。');
      error.code = 'MAGNIFYING_GLASS_EMPTY';
      throw error;
    }

    if (state.dailyTotalCount >= 10) {
      const error = new Error('今天的探索次数已用完，请明天再来。');
      error.code = 'MAGNIFYING_GLASS_DAILY_LIMIT';
      throw error;
    }

    if ((state.locationTypeCounts[countKey] || 0) >= 3) {
      const error = new Error('这个地点的该类故事今天已经探索 3 次了。');
      error.code = 'MAGNIFYING_GLASS_LOCATION_TYPE_LIMIT';
      throw error;
    }

    state.activeRequestId = payload.requestId;
    state.activeLocationKey = payload.locationKey;
    state.activeStoryType = payload.storyType;
    state.requestLockUntil = Date.now() + 60000;

    return {
      magnifyingGlass: state.magnifyingGlass,
      dailyTotalCount: state.dailyTotalCount,
      locationTypeCount: state.locationTypeCounts[countKey] || 0,
    };
  };

  userService.consumeMagnifyingGlass = async function consumeMagnifyingGlassMock(payload) {
    const countKey = getCountKey(payload.locationKey, payload.storyType);

    if (state.activeRequestId !== payload.requestId) {
      const error = new Error('当前探索请求已失效，请重新选择。');
      error.code = 'MAGNIFYING_GLASS_CONCURRENT_REQUEST';
      throw error;
    }

    state.magnifyingGlass -= 1;
    state.dailyTotalCount += 1;
    state.locationTypeCounts[countKey] = (state.locationTypeCounts[countKey] || 0) + 1;
    state.activeRequestId = '';
    state.activeLocationKey = '';
    state.activeStoryType = '';
    state.requestLockUntil = 0;

    return {
      magnifyingGlass: state.magnifyingGlass,
      dailyTotalCount: state.dailyTotalCount,
      locationTypeCount: state.locationTypeCounts[countKey],
    };
  };

  userService.releaseMagnifyingGlassRequest = async function releaseMagnifyingGlassRequestMock() {
    state.activeRequestId = '';
    state.activeLocationKey = '';
    state.activeStoryType = '';
    state.requestLockUntil = 0;

    return {
      released: true,
    };
  };

  userService.getDevTestState = async function getDevTestStateMock(payload) {
    state.getDevStateCalls += 1;
    assertToken(payload);
    return buildDevState(payload);
  };

  userService.setDevTestMagnifyingGlass = async function setDevTestMagnifyingGlassMock(payload) {
    assertToken(payload);
    state.magnifyingGlass = payload.magnifyingGlass;
    return buildDevState(payload);
  };

  userService.setDevTestDailyTotalCount = async function setDevTestDailyTotalCountMock(payload) {
    assertToken(payload);
    state.dailyTotalCount = payload.dailyTotalCount;
    return buildDevState(payload);
  };

  userService.setDevTestLocationTypeCount = async function setDevTestLocationTypeCountMock(payload) {
    assertToken(payload);
    state.locationTypeCounts[getCountKey(payload.locationKey, payload.storyType)] = payload.locationTypeCount;
    return buildDevState(payload);
  };

  userService.clearDevTestLocationTypeCounts = async function clearDevTestLocationTypeCountsMock(payload) {
    assertToken(payload);
    state.locationTypeCounts = {};
    return buildDevState(payload);
  };

  userService.clearDevTestLocationTypeCount = async function clearDevTestLocationTypeCountMock(payload) {
    assertToken(payload);
    delete state.locationTypeCounts[getCountKey(payload.locationKey, payload.storyType)];
    return buildDevState(payload);
  };

  userService.clearDevTestRequestLock = async function clearDevTestRequestLockMock(payload) {
    assertToken(payload);
    state.activeRequestId = '';
    state.activeLocationKey = '';
    state.activeStoryType = '';
    state.requestLockUntil = 0;
    return buildDevState(payload);
  };

  userService.resetDevTestTodayState = async function resetDevTestTodayStateMock(payload) {
    assertToken(payload);
    state.magnifyingGlass = payload.magnifyingGlass;
    state.dailyTotalCount = 0;
    state.locationTypeCounts = {};
    state.activeRequestId = '';
    state.activeLocationKey = '';
    state.activeStoryType = '';
    state.requestLockUntil = 0;
    return buildDevState(payload);
  };

  storyService.getRandomPresetStoryByLocationAndType = async function getRandomPresetStoryByLocationAndTypeMock() {
    return {
      id: 'preset-story-001',
      type: '民间传说',
      title: '预设故事标题',
      content: '预设故事正文。',
      source: 'preset',
      generated: false,
    };
  };

  return state;
}

async function createDevToolsPage() {
  const pageConfig = requirePage('./devTestTools.js');
  const page = createPageInstance(pageConfig);

  await page.initializePage();
  return page;
}

function createLocationPage() {
  const pageConfig = requirePage('../location/location.js');
  return createPageInstance(pageConfig, {
    locationDetail: createFormalLocationDetail(),
    remainingMagnifyingGlass: 0,
    requesting: false,
    requestingTypeLabel: '',
  });
}

async function runScenario(label, execute) {
  currentOpenId = 'openid-anonymous-001';
  storageState = {};
  const state = setupSharedMocks();

  await execute(state);

  console.log('[PASS]', label);
}

async function testCorrectTokenCanViewState() {
  currentEnvVersion = 'develop';
  await runScenario('correct token can view state', async function execute() {
    const devPage = await createDevToolsPage();

    devPage.handleDevTestTokenInput({
      detail: {
        value: 'correct-dev-token',
      },
    });
    devPage.handleVerifyTokenTap();
    await wait(0);

    assert.strictEqual(devPage.data.accessGranted, true);
    assert.strictEqual(devPage.data.tokenStatusText, '开发测试口令已验证');
  });
}

async function testWrongTokenRejected() {
  currentEnvVersion = 'develop';
  await runScenario('wrong token is rejected', async function execute(state) {
    const devPage = await createDevToolsPage();

    devPage.handleDevTestTokenInput({
      detail: {
        value: 'wrong-token',
      },
    });
    devPage.handleVerifyTokenTap();
    await wait(0);

    assert.strictEqual(devPage.data.accessGranted, false);
    assert.strictEqual(devPage.data.tokenStatusText, '开发测试工具口令不正确');
    assert.strictEqual(state.lastToast.title, '开发测试工具口令不正确');
  });
}

async function testMissingTokenRejected() {
  currentEnvVersion = 'develop';
  await runScenario('missing token is rejected', async function execute() {
    const devPage = await createDevToolsPage();

    devPage.handleVerifyTokenTap();
    await wait(0);

    assert.strictEqual(devPage.data.accessGranted, false);
    assert.strictEqual(devPage.data.tokenStatusText, '请输入开发测试口令后验证');
  });
}

async function testDisabledFlagRejectsAllRequests() {
  currentEnvVersion = 'release';
  await runScenario('disabled env rejects all requests', async function execute() {
    storageState.dev_test_admin_token = 'correct-dev-token';
    const devPage = await createDevToolsPage();

    assert.strictEqual(devPage.data.envAllowed, false);
    assert.strictEqual(devPage.data.accessGranted, false);
  });
}

async function testTokenDoesNotDependOnOpenId() {
  currentEnvVersion = 'develop';
  await runScenario('token does not depend on openid', async function execute(state) {
    let devPage = await createDevToolsPage();

    devPage.handleDevTestTokenInput({
      detail: {
        value: 'correct-dev-token',
      },
    });
    devPage.handleVerifyTokenTap();
    await wait(0);
    assert.strictEqual(devPage.data.accessGranted, true);

    currentOpenId = 'openid-anonymous-002';
    devPage = await createDevToolsPage();

    devPage.handleDevTestTokenInput({
      detail: {
        value: 'correct-dev-token',
      },
    });
    devPage.handleVerifyTokenTap();
    await wait(0);
    assert.strictEqual(devPage.data.accessGranted, true);
    assert.ok(state.getDevStateCalls >= 2);
  });
}

async function testStoredTokenAutoValidates() {
  currentEnvVersion = 'develop';
  await runScenario('stored token auto validates', async function execute() {
    storageState.dev_test_admin_token = 'correct-dev-token';
    const devPage = await createDevToolsPage();

    assert.strictEqual(devPage.data.accessGranted, true);
    assert.strictEqual(devPage.data.hasStoredToken, true);
  });
}

async function testClearStoredTokenRequiresReinput() {
  currentEnvVersion = 'develop';
  await runScenario('clearing token requires reinput', async function execute() {
    storageState.dev_test_admin_token = 'correct-dev-token';
    const devPage = await createDevToolsPage();

    assert.strictEqual(devPage.data.accessGranted, true);
    devPage.handleClearLocalDevTestToken();

    assert.strictEqual(devPage.data.accessGranted, false);
    assert.strictEqual(storageState.dev_test_admin_token, undefined);
    assert.strictEqual(devPage.data.tokenStatusText, '本地测试口令已清除，请重新输入');
  });
}

async function testReleaseEnvHidesProfileEntry() {
  currentEnvVersion = 'release';
  await runScenario('release env hides profile entry', async function execute() {
    const profileConfig = requirePage('../profile/profile.js');
    const profilePage = createPageInstance(profileConfig);

    await profilePage.loadDevTestToolAccess();

    assert.strictEqual(profilePage.data.devTestToolsVisible, false);
  });
}

async function testCanExploreAfterResetToFiveAndZero() {
  currentEnvVersion = 'develop';
  await runScenario('set balance 5 and total 0 allows explore', async function execute(state) {
    const devPage = await createDevToolsPage();

    devPage.handleDevTestTokenInput({
      detail: {
        value: 'correct-dev-token',
      },
    });
    devPage.handleVerifyTokenTap();
    await wait(0);

    devPage.handleSetMagnifyingGlassPreset(createDevPresetEvent(5));
    await wait(0);
    devPage.handleSetDailyTotalPreset(createDevPresetEvent(0));
    await wait(0);

    const locationPage = createLocationPage();
    await locationPage.handleSelectStoryType(createLocationPageEvent('folk', '民间传说'));

    assert.strictEqual(state.magnifyingGlass, 4);
    assert.strictEqual(state.dailyTotalCount, 1);
  });
}

async function testClearRequestLockAllowsRetry() {
  currentEnvVersion = 'develop';
  await runScenario('clear request lock allows retry', async function execute(state) {
    state.activeRequestId = 'req-existing';
    state.activeLocationKey = 'loc-demo-001';
    state.activeStoryType = '民间传说';
    state.requestLockUntil = Date.now() + 60000;

    const devPage = await createDevToolsPage();

    devPage.handleDevTestTokenInput({
      detail: {
        value: 'correct-dev-token',
      },
    });
    devPage.handleVerifyTokenTap();
    await wait(0);

    const locationPage = createLocationPage();
    await locationPage.handleSelectStoryType(createLocationPageEvent('folk', '民间传说'));
    assert.strictEqual(state.lastToast.title, '当前探索处理中，请稍后再试。');

    devPage.handleClearRequestLock();
    await wait(0);
    await locationPage.handleSelectStoryType(createLocationPageEvent('folk', '民间传说'));

    assert.strictEqual(state.magnifyingGlass, 4);
    assert.strictEqual(state.requestLockUntil, 0);
  });
}

async function run() {
  await testCorrectTokenCanViewState();
  await testWrongTokenRejected();
  await testMissingTokenRejected();
  await testDisabledFlagRejectsAllRequests();
  await testTokenDoesNotDependOnOpenId();
  await testStoredTokenAutoValidates();
  await testClearStoredTokenRequiresReinput();
  await testReleaseEnvHidesProfileEntry();
  await testCanExploreAfterResetToFiveAndZero();
  await testClearRequestLockAllowsRetry();

  console.log('[PASS] dev test tools page validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
