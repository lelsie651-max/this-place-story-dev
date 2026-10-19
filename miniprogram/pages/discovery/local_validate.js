const assert = require('assert');

let capturedPageConfig = null;
let currentApp = null;

global.getApp = function getApp() {
  return currentApp;
};

global.Page = function capturePage(config) {
  capturedPageConfig = config;
};

function requireDiscoveryPage() {
  capturedPageConfig = null;
  delete require.cache[require.resolve('./discovery.js')];
  return require('./discovery.js');
}

function createPageInstance(pageConfig) {
  const instance = {
    data: Object.assign({}, pageConfig.data),
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

function flushPromises() {
  return new Promise(function resolveLater(resolve) {
    setTimeout(resolve, 0);
  });
}

function testNormalizeViewCountBoundaries(helpers) {
  assert.strictEqual(helpers.normalizeViewCount(undefined), 0);
  assert.strictEqual(helpers.normalizeViewCount(null), 0);
  assert.strictEqual(helpers.normalizeViewCount('invalid'), 0);
  assert.strictEqual(helpers.normalizeViewCount(-5), 0);
  assert.strictEqual(helpers.normalizeViewCount(1000), 1000);
  assert.strictEqual(helpers.normalizeViewCount(1001), 1001);
}

function testRecordableLocationIdGuards(helpers) {
  assert.strictEqual(helpers.isRecordableLocationId('loc-001'), true);
  assert.strictEqual(helpers.isRecordableLocationId(''), false);
  assert.strictEqual(helpers.isRecordableLocationId('null'), false);
  assert.strictEqual(helpers.isRecordableLocationId('temporary:westlake'), false);
}

async function testStatsFailureDoesNotBlockNavigation(pageConfig) {
  const page = createPageInstance(pageConfig);
  const callRecords = [];
  const navigationRecords = [];

  global.wx = {
    cloud: {
      callFunction(options) {
        callRecords.push(options);
        return Promise.reject(new Error('network failure'));
      },
    },
    navigateTo(options) {
      navigationRecords.push(options);
    },
  };

  page.goToLocation({
    currentTarget: {
      dataset: {
        locationId: 'loc-formal-001',
      },
    },
  });

  await flushPromises();

  assert.strictEqual(callRecords.length, 1);
  assert.strictEqual(callRecords[0].name, 'recordLocationView');
  assert.deepStrictEqual(callRecords[0].data, {
    locationId: 'loc-formal-001',
  });
  assert.strictEqual(navigationRecords.length, 1);
  assert.strictEqual(navigationRecords[0].url, '/pages/location/location?locationId=loc-formal-001');
}

function testTransientLocationDoesNotCallStats(pageConfig) {
  const page = createPageInstance(pageConfig);
  const callRecords = [];
  const navigationRecords = [];

  global.wx = {
    cloud: {
      callFunction(options) {
        callRecords.push(options);
        return Promise.resolve({});
      },
    },
    navigateTo(options) {
      navigationRecords.push(options);
    },
  };

  page.goToLocation({
    currentTarget: {
      dataset: {
        locationId: 'temporary:demo-place',
      },
    },
  });

  assert.strictEqual(callRecords.length, 0);
  assert.strictEqual(navigationRecords.length, 1);
  assert.strictEqual(navigationRecords[0].url, '/pages/location/location?locationId=temporary:demo-place');
}

function testShowHotMappingUsesViewCountOnly(pageConfig) {
  const page = createPageInstance(pageConfig);
  const locations = [
    {
      id: 'loc-1000',
      province: '浙江',
      city: '杭州',
      name: '西湖断桥',
      createdAt: Date.now(),
      viewCount: 1000,
    },
    {
      id: 'loc-1001',
      province: '浙江',
      city: '杭州',
      name: '雷峰塔',
      createdAt: Date.now(),
      viewCount: 1001,
    },
    {
      id: 'loc-missing',
      province: '浙江',
      city: '杭州',
      name: '孤山',
      createdAt: Date.now(),
    },
  ];

  const mappedLocations = locations.map(function mapLocation(location) {
    return {
      id: location.id,
      title: pageConfig._private.formatLocationText(location),
      description: pageConfig._private.formatLocationMeta(location),
      viewCount: pageConfig._private.normalizeViewCount(location.viewCount),
      showNew: pageConfig._private.isNewLocation(location.createdAt, Date.now()),
      showHot: pageConfig._private.normalizeViewCount(location.viewCount) > 1000,
    };
  });

  assert.strictEqual(mappedLocations[0].viewCount, 1000);
  assert.strictEqual(mappedLocations[0].showHot, false);
  assert.strictEqual(mappedLocations[1].viewCount, 1001);
  assert.strictEqual(mappedLocations[1].showHot, true);
  assert.strictEqual(mappedLocations[2].viewCount, 0);
  assert.strictEqual(mappedLocations[2].showHot, false);
}

async function run() {
  currentApp = {
    globalData: {},
  };

  const discoveryModule = requireDiscoveryPage();
  const helpers = discoveryModule._private;

  if (!capturedPageConfig) {
    throw new Error('Failed to capture discovery page config.');
  }

  capturedPageConfig._private = helpers;

  testNormalizeViewCountBoundaries(helpers);
  testRecordableLocationIdGuards(helpers);
  await testStatsFailureDoesNotBlockNavigation(capturedPageConfig);
  testTransientLocationDoesNotCallStats(capturedPageConfig);
  testShowHotMappingUsesViewCountOnly(capturedPageConfig);

  console.log('[PASS] discovery local validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
