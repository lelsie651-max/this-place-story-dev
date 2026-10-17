const assert = require('assert');

const userService = require('../../services/userService');
const storyService = require('../../services/storyService');

let capturedPageConfig = null;
let currentApp = null;
let currentWx = null;

global.getApp = function getApp() {
  return currentApp;
};

global.Page = function capturePage(config) {
  capturedPageConfig = config;
};

function wait(ms) {
  return new Promise(function resolveLater(resolve) {
    setTimeout(resolve, ms);
  });
}

function requireLocationPage() {
  capturedPageConfig = null;
  delete require.cache[require.resolve('./location.js')];
  require('./location.js');

  if (!capturedPageConfig) {
    throw new Error('Failed to capture location page config.');
  }

  return capturedPageConfig;
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

function createTemporaryLocationDetail() {
  return {
    id: null,
    locationId: null,
    isTemporary: true,
    transientPlace: true,
    name: '临时地点',
    city: '深圳',
    address: '深圳市南山区某临时地点',
    intro: '本次会按临时选定地点生成故事。',
    selectedPlace: {
      name: '临时地点',
      address: '深圳市南山区某临时地点',
      latitude: 22.543096,
      longitude: 113.929424,
      poiid: 'poi-demo-001',
    },
  };
}

function createPageInstance(pageConfig, locationDetail) {
  const instance = {
    data: Object.assign({}, pageConfig.data, {
      locationDetail: locationDetail,
      remainingMagnifyingGlass: 0,
      requesting: false,
      requestingTypeLabel: '',
    }),
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

function createEvent(type, label) {
  return {
    currentTarget: {
      dataset: {
        type: type,
        enabled: true,
        label: label || type,
      },
    },
  };
}

function createHarness(config) {
  const counters = {
    profile: 0,
    prepare: 0,
    consume: 0,
    release: 0,
    generate: 0,
    preset: 0,
    navigate: 0,
    toast: 0,
  };
  const state = {
    magnifyingGlass: typeof config.magnifyingGlass === 'number' ? config.magnifyingGlass : 5,
    lastRequestId: '',
    lastGeneratePayload: null,
    navigationUrls: [],
  };

  currentApp = {
    globalData: {},
  };

  currentWx = {
    showToast(options) {
      counters.toast += 1;
      state.lastToast = options;
    },
    navigateTo(options) {
      counters.navigate += 1;
      state.navigationUrls.push(options.url);

      if (config.navigateFail) {
        options.fail({
          errMsg: 'navigateTo:fail mock',
        });
        return;
      }

      options.success({
        errMsg: 'navigateTo:ok',
      });
    },
    cloud: {
      callFunction(options) {
        counters.generate += 1;
        state.lastGeneratePayload = options.data;

        if (config.cloudTransportFail) {
          options.fail({
            code: 'CALL_FAIL',
            message: 'mock transport fail',
          });
          return;
        }

        if (config.generateResult && config.generateResult.ok === false) {
          options.success({
            result: {
              ok: false,
              error: {
                code: config.generateResult.code,
                message: config.generateResult.message,
              },
            },
          });
          return;
        }

        options.success({
          result: {
            ok: true,
            story: {
              storyId: 'generated-demo-001',
              locationId: config.expectedTemporary ? null : 'loc-demo-001',
              type: config.generatedStoryType || 'AI说',
              title: '测试标题',
              content: '测试正文第一段。\n\n测试正文第二段。',
              source: 'deepseek',
            },
          },
        });
      },
    },
  };

  global.wx = currentWx;

  userService.getCurrentUserProfile = async function getCurrentUserProfileMock() {
    counters.profile += 1;

    if (config.profileDelayMs) {
      await wait(config.profileDelayMs);
    }

    return {
      magnifyingGlass: state.magnifyingGlass,
    };
  };

  userService.prepareMagnifyingGlassUsage = async function prepareMock(payload) {
    counters.prepare += 1;
    state.lastRequestId = payload.requestId;

    if (config.prepareError) {
      const error = new Error(config.prepareError.message);
      error.code = config.prepareError.code;
      throw error;
    }

    return {
      magnifyingGlass: state.magnifyingGlass,
      dailyTotalCount: 0,
      locationTypeCount: 0,
    };
  };

  userService.consumeMagnifyingGlass = async function consumeMock(payload) {
    counters.consume += 1;

    if (config.consumeError) {
      const error = new Error(config.consumeError.message);
      error.code = config.consumeError.code;
      throw error;
    }

    state.magnifyingGlass -= 1;
    return {
      magnifyingGlass: state.magnifyingGlass,
      dailyTotalCount: 1,
      locationTypeCount: 1,
    };
  };

  userService.releaseMagnifyingGlassRequest = async function releaseMock() {
    counters.release += 1;
    return {
      released: true,
    };
  };

  storyService.getRandomPresetStoryByLocationAndType = async function presetMock() {
    counters.preset += 1;

    if (config.presetMode === 'miss') {
      throw new Error('Failed to load preset story by location and type from CloudBase: 这个地点暂时还没有这种类型的预设故事。');
    }

    if (config.presetMode === 'error') {
      throw new Error('Failed to load preset story by location and type from CloudBase: mock preset error');
    }

    return {
      id: 'preset-story-001',
      type: '民间传说',
      title: '预设故事标题',
      content: '预设故事正文。',
      source: 'preset',
      generated: false,
    };
  };

  storyService.getRandomStoryByLocationAndType = async function randomStoryMock() {
    throw new Error('Unexpected getRandomStoryByLocationAndType call in local validation.');
  };

  return {
    counters: counters,
    state: state,
  };
}

async function runCase(label, config, execute) {
  const pageConfig = requireLocationPage();
  const harness = createHarness(config);
  const locationDetail = config.temporary ? createTemporaryLocationDetail() : createFormalLocationDetail();
  const page = createPageInstance(pageConfig, locationDetail);

  await execute({
    page: page,
    counters: harness.counters,
    state: harness.state,
  });

  console.log('[PASS]', label);
}

async function testAiSuccess() {
  await runCase('AI success consumes once', {
    generatedStoryType: 'AI说',
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.prepare, 1);
    assert.strictEqual(ctx.counters.consume, 1);
    assert.strictEqual(ctx.counters.release, 0);
    assert.strictEqual(ctx.state.magnifyingGlass, 4);
    assert.strictEqual(ctx.counters.generate, 1);
  });
}

async function testAiTimeout() {
  await runCase('AI timeout releases without consume', {
    generateResult: {
      ok: false,
      code: 'PROVIDER_TIMEOUT',
      message: '故事生成超时，请稍后再试',
    },
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.counters.release, 1);
    assert.strictEqual(ctx.state.magnifyingGlass, 5);
  });
}

async function testAiInvalidJson() {
  await runCase('AI invalid JSON releases without consume', {
    generateResult: {
      ok: false,
      code: 'NORMALIZATION_ERROR',
      message: 'AI故事暂时生成失败，请稍后再试',
    },
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.counters.release, 1);
    assert.strictEqual(ctx.state.magnifyingGlass, 5);
  });
}

async function testAiEmptyResponse() {
  await runCase('AI empty response releases without consume', {
    generateResult: {
      ok: false,
      code: 'EMPTY_RESPONSE',
      message: 'AI故事暂时生成失败，请稍后再试',
    },
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.counters.release, 1);
    assert.strictEqual(ctx.state.magnifyingGlass, 5);
  });
}

async function testCloudFunctionCallFail() {
  await runCase('Cloud function transport failure releases without consume', {
    cloudTransportFail: true,
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.counters.release, 1);
    assert.strictEqual(ctx.state.magnifyingGlass, 5);
  });
}

async function testPresetStoryHit() {
  await runCase('Preset story hit consumes without generateStory', {}, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('folk', '民间传说'));

    assert.strictEqual(ctx.counters.preset, 1);
    assert.strictEqual(ctx.counters.generate, 0);
    assert.strictEqual(ctx.counters.consume, 1);
    assert.strictEqual(ctx.counters.release, 0);
    assert.strictEqual(ctx.state.magnifyingGlass, 4);
  });
}

async function testMagnifyingGlassEmpty() {
  await runCase('Zero magnifying glass blocks before prepare', {
    magnifyingGlass: 0,
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.prepare, 0);
    assert.strictEqual(ctx.counters.generate, 0);
    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.state.magnifyingGlass, 0);
  });
}

async function testRapidRepeatClick() {
  await runCase('Rapid repeat click keeps single successful consume', {
    profileDelayMs: 30,
    generatedStoryType: 'AI说',
  }, async function execute(ctx) {
    await Promise.all([
      ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说')),
      ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说')),
    ]);

    assert.strictEqual(ctx.counters.prepare, 1);
    assert.strictEqual(ctx.counters.generate, 1);
    assert.strictEqual(ctx.counters.consume, 1);
    assert.strictEqual(ctx.counters.release, 0);
  });
}

async function testFolkFallbackSuccess() {
  await runCase('Folk AI fallback success consumes once', {
    presetMode: 'miss',
    generatedStoryType: '民间传说',
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('folk', '民间传说'));

    assert.strictEqual(ctx.counters.preset, 1);
    assert.strictEqual(ctx.counters.generate, 1);
    assert.strictEqual(ctx.counters.consume, 1);
    assert.strictEqual(ctx.counters.release, 0);
  });
}

async function testFolkFallbackFailure() {
  await runCase('Folk AI fallback failure releases without consume', {
    presetMode: 'miss',
    generateResult: {
      ok: false,
      code: 'PROVIDER_ERROR',
      message: 'AI故事暂时生成失败，请稍后再试',
    },
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('folk', '民间传说'));

    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.counters.release, 1);
    assert.strictEqual(ctx.state.magnifyingGlass, 5);
  });
}

async function testTemporaryAiSuccess() {
  await runCase('Temporary AI success consumes once', {
    temporary: true,
    expectedTemporary: true,
    generatedStoryType: 'AI说',
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.consume, 1);
    assert.strictEqual(ctx.counters.release, 0);
    assert.ok(ctx.state.lastGeneratePayload);
    assert.strictEqual(ctx.state.lastGeneratePayload.locationId, null);
    assert.strictEqual(ctx.state.lastGeneratePayload.isTemporary, true);
  });
}

async function testTemporaryAiFailure() {
  await runCase('Temporary AI failure does not consume', {
    temporary: true,
    expectedTemporary: true,
    generateResult: {
      ok: false,
      code: 'PROVIDER_ERROR',
      message: 'AI故事暂时生成失败，请稍后再试',
    },
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.counters.release, 1);
    assert.strictEqual(ctx.state.magnifyingGlass, 5);
  });
}

async function testNavigateFailure() {
  await runCase('Navigate failure releases without consume', {
    navigateFail: true,
    generatedStoryType: 'AI说',
  }, async function execute(ctx) {
    await ctx.page.handleSelectStoryType(createEvent('ai_comment', 'AI说'));

    assert.strictEqual(ctx.counters.consume, 0);
    assert.strictEqual(ctx.counters.release, 1);
    assert.strictEqual(ctx.state.magnifyingGlass, 5);
  });
}

async function run() {
  const tests = [
    testAiSuccess,
    testAiTimeout,
    testAiInvalidJson,
    testAiEmptyResponse,
    testCloudFunctionCallFail,
    testPresetStoryHit,
    testMagnifyingGlassEmpty,
    testRapidRepeatClick,
    testFolkFallbackSuccess,
    testFolkFallbackFailure,
    testTemporaryAiSuccess,
    testTemporaryAiFailure,
    testNavigateFailure,
  ];

  for (const testFn of tests) {
    await testFn();
  }

  console.log('[PASS] location flow validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
