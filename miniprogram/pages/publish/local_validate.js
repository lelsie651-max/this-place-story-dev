const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

function loadPublishPage(options) {
  const targetPath = path.join(__dirname, 'publish.js');
  const originalLoad = Module._load;
  const storyServiceStub = options && options.storyService
    ? options.storyService
    : {
      submitTravelerStory: async function submitTravelerStory() {
        return {
          storyId: 'story-demo-001',
        };
      },
    };
  const locationServiceStub = options && options.locationService
    ? options.locationService
    : {
      normalizeSelectedPlace() {
        return null;
      },
      listLocations: async function listLocations() {
        return [];
      },
      matchSelectedPlaceToLocations() {
        return null;
      },
    };
  const appInstance = options && options.app
    ? options.app
    : {
      globalData: {},
    };
  let pageConfig = null;

  delete require.cache[targetPath];
  global.Page = function capturePage(config) {
    pageConfig = config;
  };
  global.getApp = function getApp() {
    return appInstance;
  };
  global.wx = options && options.wx ? options.wx : {};

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../../services/storyService') {
      return storyServiceStub;
    }

    if (request === '../../services/locationService') {
      return locationServiceStub;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const exported = require(targetPath);
    return {
      pageConfig: pageConfig,
      privateApi: exported && exported._private ? exported._private : {},
      app: appInstance,
      wx: options && options.wx ? options.wx : {},
    };
  } finally {
    Module._load = originalLoad;
    delete require.cache[targetPath];
    delete global.Page;
    delete global.getApp;
    delete global.wx;
  }
}

function createPageInstance(pageConfig, runtime) {
  const appInstance = runtime && runtime.app
    ? runtime.app
    : {
      globalData: {},
    };
  const wxMock = runtime && runtime.wx ? runtime.wx : {};

  global.getApp = function getApp() {
    return appInstance;
  };
  global.wx = wxMock;

  const instance = {
    data: JSON.parse(JSON.stringify(pageConfig.data || {})),
    submitLock: false,
    choosingLocation: false,
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

async function testPublishWxmlCleanup() {
  const wxmlPath = path.join(__dirname, 'publish.wxml');
  const source = fs.readFileSync(wxmlPath, 'utf8');

  assert.ok(source.indexOf('<view class="top-bar">') === -1);
  assert.ok(source.indexOf('把你想分享的地点故事先整理下来') === -1);
  assert.ok(source.indexOf('点击这里选择地点') === -1);
  assert.ok(source.indexOf('支持从地点页自动带入') === -1);
  assert.ok(source.indexOf('📍 选择地点') !== -1);
  assert.ok(source.indexOf('bindtap="chooseLocation"') !== -1);
  assert.ok(source.indexOf('{{locationName || \'\'}}') !== -1);
  assert.ok(source.indexOf('field-address') !== -1);
  assert.ok(source.indexOf('坐标：') === -1);
  assert.ok(source.indexOf('当前地点会按临时投稿') === -1);
  assert.ok(source.indexOf('当前地点会绑定到已有地点库中的正式地点') === -1);
}

async function testSubmitPayloadStillKeepsLocationFields() {
  const source = fs.readFileSync(path.join(__dirname, 'publish.js'), 'utf8');

  assert.ok(source.indexOf('latitude: pendingLocation.latitude') !== -1);
  assert.ok(source.indexOf('longitude: pendingLocation.longitude') !== -1);
  assert.ok(source.indexOf('placeSnapshot: placeSnapshot') !== -1);
  assert.ok(source.indexOf('locationId: locationId') !== -1);
  assert.ok(source.indexOf('isTemporary: isTemporary') !== -1);
  assert.ok(source.indexOf('async chooseLocation()') !== -1);
  assert.ok(source.indexOf('await storyService.submitTravelerStory({') !== -1);
}

async function testSuccessSubmissionRedirectsWithoutToast() {
  const navigation = {
    redirectUrl: '',
    toastCalls: 0,
  };
  const loaded = loadPublishPage({
    app: {
      globalData: {
        pendingPublishLocation: {
          locationId: 'loc-001',
        },
        pendingUserStoriesSubmissionNotice: '',
      },
    },
    wx: {
      redirectTo(options) {
        navigation.redirectUrl = options.url;
        if (typeof options.success === 'function') {
          options.success({});
        }
      },
      reLaunch() {
        throw new Error('reLaunch should not be used when redirectTo succeeds');
      },
      showToast() {
        navigation.toastCalls += 1;
      },
    },
    storyService: {
      submitTravelerStory: async function submitTravelerStory() {
        return {
          storyId: 'story-demo-001',
          status: 'pending',
          message: '投稿已提交，审核通过后会展示。',
        };
      },
    },
  });
  const page = createPageInstance(loaded.pageConfig, loaded);

  page.setData({
    locationId: 'loc-001',
    locationName: '南头古城',
    locationAddress: '深圳市南山区南头古城',
    isTemporary: false,
    placeSnapshot: {
      name: '南头古城',
      address: '深圳市南山区南头古城',
      latitude: 22.1,
      longitude: 113.9,
      poiid: 'poi-1',
    },
    storyTitle: '我在城门口听来的版本',
    storyContent: '这里的风声有点像人声，但又很讲秩序。',
    submitting: false,
    entrySource: 'direct',
  });

  await page.submitStory();

  assert.strictEqual(navigation.toastCalls, 0);
  assert.strictEqual(navigation.redirectUrl, '/pages/publishResult/publishResult?resultType=success');
  assert.strictEqual(page.data.submitting, false);
  assert.strictEqual(page.submitLock, false);
}

async function testFailureSubmissionRedirectsWithSafeReason() {
  const navigation = {
    redirectUrl: '',
    toastCalls: 0,
  };
  const loaded = loadPublishPage({
    wx: {
      redirectTo(options) {
        navigation.redirectUrl = options.url;
        if (typeof options.success === 'function') {
          options.success({});
        }
      },
      reLaunch() {
        throw new Error('reLaunch should not be used when redirectTo succeeds');
      },
      showToast() {
        navigation.toastCalls += 1;
      },
    },
    storyService: {
      submitTravelerStory: async function submitTravelerStory() {
        const error = new Error('底层数据库错误');
        error.code = 'DATABASE_ERROR';
        throw error;
      },
    },
  });
  const page = createPageInstance(loaded.pageConfig, loaded);

  page.setData({
    locationId: 'loc-001',
    locationName: '南头古城',
    isTemporary: false,
    placeSnapshot: {
      name: '南头古城',
      address: '深圳市南山区南头古城',
      latitude: 22.1,
      longitude: 113.9,
      poiid: 'poi-1',
    },
    storyTitle: '失败标题',
    storyContent: '失败正文',
    submitting: false,
  });

  await page.submitStory();

  assert.strictEqual(navigation.toastCalls, 0);
  assert.strictEqual(
    navigation.redirectUrl,
    '/pages/publishResult/publishResult?resultType=failure&reason='
      + encodeURIComponent('投稿写入失败，请稍后再试。')
  );
  assert.strictEqual(page.data.submitting, false);
  assert.strictEqual(page.submitLock, false);
}

async function testSubmittingGuardStillExists() {
  const source = fs.readFileSync(path.join(__dirname, 'publish.js'), 'utf8');
  let submitCalls = 0;
  const loaded = loadPublishPage({
    wx: {
      redirectTo(options) {
        if (typeof options.success === 'function') {
          options.success({});
        }
      },
      reLaunch(options) {
        if (typeof options.success === 'function') {
          options.success({});
        }
      },
      showToast() {},
    },
    storyService: {
      submitTravelerStory: async function submitTravelerStory() {
        submitCalls += 1;
        return {
          storyId: 'story-demo-001',
        };
      },
    },
  });
  const page = createPageInstance(loaded.pageConfig, loaded);

  assert.ok(source.indexOf('this.submitLock || this.data.submitting') !== -1);
  page.setData({
    submitting: true,
    locationId: 'loc-001',
    placeSnapshot: {
      name: '南头古城',
    },
    storyTitle: '标题',
    storyContent: '正文',
  });

  await page.submitStory();

  assert.strictEqual(submitCalls, 0);
}

async function testTabEntryCanConsumePendingLocationOnShow() {
  const appInstance = {
    globalData: {
      pendingPublishLocation: {
        locationId: 'loc-002',
        locationName: '西湖断桥',
        address: '杭州市西湖区断桥',
        latitude: 30.25,
        longitude: 120.14,
        isTemporary: false,
        placeSnapshot: {
          name: '西湖断桥',
          address: '杭州市西湖区断桥',
          latitude: 30.25,
          longitude: 120.14,
          poiid: 'poi-2',
        },
        entrySource: 'userStories',
      },
    },
  };
  const loaded = loadPublishPage({
    app: appInstance,
  });
  const page = createPageInstance(loaded.pageConfig, loaded);

  page.onLoad();
  page.setData({
    storyTitle: '已经写好的标题',
    storyContent: '已经写好的正文',
  });

  appInstance.globalData.pendingPublishLocation = {
    locationId: 'loc-003',
    locationName: '南头古城',
    address: '深圳市南山区南头古城',
    latitude: 22.54,
    longitude: 113.93,
    isTemporary: false,
    placeSnapshot: {
      name: '南头古城',
      address: '深圳市南山区南头古城',
      latitude: 22.54,
      longitude: 113.93,
      poiid: 'poi-3',
    },
    entrySource: 'userStories',
  };

  page.onShow();

  assert.strictEqual(page.data.locationId, 'loc-003');
  assert.strictEqual(page.data.locationName, '南头古城');
  assert.strictEqual(page.data.entrySource, 'userStories');
  assert.strictEqual(page.data.sourceFromLocation, true);
  assert.strictEqual(page.data.storyTitle, '已经写好的标题');
  assert.strictEqual(page.data.storyContent, '已经写好的正文');
  assert.strictEqual(appInstance.globalData.pendingPublishLocation, null);
}

async function run() {
  const tests = [
    ['Publish WXML cleanup', testPublishWxmlCleanup],
    ['Submit payload still keeps location fields', testSubmitPayloadStillKeepsLocationFields],
    ['Success submission redirects without toast', testSuccessSubmissionRedirectsWithoutToast],
    ['Failure submission redirects with safe reason', testFailureSubmissionRedirectsWithSafeReason],
    ['Submitting guard still exists', testSubmittingGuardStillExists],
    ['Tab entry can consume pending location on show', testTabEntryCanConsumePendingLocationOnShow],
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
  delete global.getApp;
  delete global.wx;
});
