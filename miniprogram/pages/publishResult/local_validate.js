const assert = require('assert');
const path = require('path');

function loadPublishResultPage() {
  const targetPath = path.join(__dirname, 'publishResult.js');
  let pageConfig = null;

  delete require.cache[targetPath];
  global.Page = function capturePage(config) {
    pageConfig = config;
  };
  global.wx = {};

  try {
    const exported = require(targetPath);
    return {
      pageConfig: pageConfig,
      privateApi: exported && exported._private ? exported._private : {},
    };
  } finally {
    delete require.cache[targetPath];
    delete global.Page;
    delete global.wx;
  }
}

function createPageInstance(pageConfig, wxMock) {
  global.wx = wxMock || {};

  const instance = {
    data: JSON.parse(JSON.stringify(pageConfig.data || {})),
    setData(update) {
      this.data = Object.assign({}, this.data, update || {});
    },
  };

  Object.keys(pageConfig).forEach(function assignField(key) {
    if (key !== 'data') {
      instance[key] = pageConfig[key];
    }
  });

  return instance;
}

async function testSuccessViewModel() {
  const loaded = loadPublishResultPage();
  const page = createPageInstance(loaded.pageConfig, {
    reLaunch() {},
  });

  page.onLoad({
    resultType: 'success',
  });

  assert.strictEqual(page.data.resultType, 'success');
  assert.strictEqual(page.data.isSuccess, true);
  assert.strictEqual(page.data.title, '感谢分享！');
  assert.strictEqual(page.data.message, '内容会在审核通过后展示。');
  assert.strictEqual(page.data.failureReason, '');
}

async function testFailureViewModel() {
  const loaded = loadPublishResultPage();
  const page = createPageInstance(loaded.pageConfig, {
    reLaunch() {},
  });

  page.onLoad({
    resultType: 'failure',
    reason: encodeURIComponent('投稿写入失败，请稍后再试。'),
  });

  assert.strictEqual(page.data.resultType, 'failure');
  assert.strictEqual(page.data.isSuccess, false);
  assert.strictEqual(page.data.title, '发布失败');
  assert.strictEqual(page.data.message, '');
  assert.strictEqual(page.data.failureReason, '投稿写入失败，请稍后再试。');
}

async function testFailureFallbackReason() {
  const loaded = loadPublishResultPage();
  const page = createPageInstance(loaded.pageConfig, {
    reLaunch() {},
  });

  page.onLoad({
    resultType: 'failure',
    reason: '%E0%A4%A',
  });

  assert.strictEqual(page.data.failureReason, '投稿提交失败，请稍后再试。');
}

async function testGoHomeUsesReLaunch() {
  const loaded = loadPublishResultPage();
  const navigation = {
    url: '',
  };
  const page = createPageInstance(loaded.pageConfig, {
    reLaunch(options) {
      navigation.url = options.url;
      if (typeof options.success === 'function') {
        options.success({});
      }
    },
  });

  page.goHome();

  assert.strictEqual(navigation.url, '/pages/index/index');
}

async function run() {
  const tests = [
    ['Success view model is correct', testSuccessViewModel],
    ['Failure view model is correct', testFailureViewModel],
    ['Failure fallback reason stays safe', testFailureFallbackReason],
    ['Go home uses reLaunch', testGoHomeUsesReLaunch],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
}).finally(function cleanup() {
  delete global.wx;
});
