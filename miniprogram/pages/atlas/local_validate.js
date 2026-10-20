const assert = require('assert');

const explorationService = require('../../services/explorationService');

let capturedPageConfig = null;
let currentWx = null;

global.Page = function capturePage(config) {
  capturedPageConfig = config;
};

function requireAtlasPage() {
  capturedPageConfig = null;
  delete require.cache[require.resolve('./atlas.js')];
  require('./atlas.js');

  if (!capturedPageConfig) {
    throw new Error('Failed to capture atlas page config.');
  }

  return capturedPageConfig;
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

async function runCase(label, setup, execute) {
  const pageConfig = requireAtlasPage();
  const page = createPageInstance(pageConfig);

  currentWx = {
    navigateTo(options) {
      if (setup && typeof setup.navigateTo === 'function') {
        setup.navigateTo(options);
        return;
      }

      if (options && typeof options.success === 'function') {
        options.success({
          errMsg: 'navigateTo:ok',
        });
      }
    },
  };

  global.wx = currentWx;

  try {
    await execute(page);
    console.log('[PASS]', label);
  } finally {
    delete global.wx;
  }
}

async function testAtlasSuccess() {
  await runCase('Atlas success loads real explorations', null, async function execute(page) {
    explorationService.getMyExplorations = async function getMyExplorationsMock() {
      return [
        {
          id: 'exp-2',
          locationId: 'loc-002',
          locationName: '西安城墙',
          storyType: 'traveler',
          storyTypeLabel: '街谈巷说',
          lastExploredAt: Date.parse('2026-10-20T21:30:00.000Z'),
        },
        {
          id: 'exp-1',
          locationId: 'loc-001',
          locationName: '南头古城',
          storyType: 'folk',
          storyTypeLabel: '民间传说',
          lastExploredAt: Date.parse('2026-10-19T18:20:00.000Z'),
        },
      ];
    };

    await page.loadAtlasItems();

    assert.strictEqual(page.data.loading, false);
    assert.strictEqual(page.data.errorMessage, '');
    assert.strictEqual(page.data.empty, false);
    assert.strictEqual(page.data.atlasItems.length, 2);
    assert.strictEqual(page.data.atlasItems[0].locationName, '西安城墙');
    assert.strictEqual(page.data.atlasItems[0].storyTypeLabel, '街谈巷说');
    assert.ok(page.data.atlasItems[0].lastExploredAtText.indexOf('2026年') !== -1);
  });
}

async function testAtlasEmptyState() {
  await runCase('Atlas empty state is supported', null, async function execute(page) {
    explorationService.getMyExplorations = async function getMyExplorationsMock() {
      return [];
    };

    await page.loadAtlasItems();

    assert.strictEqual(page.data.loading, false);
    assert.strictEqual(page.data.errorMessage, '');
    assert.strictEqual(page.data.empty, true);
    assert.strictEqual(page.data.atlasItems.length, 0);
  });
}

async function testAtlasErrorState() {
  await runCase('Atlas error state is supported', null, async function execute(page) {
    explorationService.getMyExplorations = async function getMyExplorationsMock() {
      throw new Error('mock fail');
    };

    await page.loadAtlasItems();

    assert.strictEqual(page.data.loading, false);
    assert.strictEqual(page.data.errorMessage, '足迹加载失败，请稍后再试。');
    assert.strictEqual(page.data.empty, false);
  });
}

async function testAtlasCardNavigation() {
  let navigationUrl = '';

  await runCase('Atlas card navigates to location page', {
    navigateTo(options) {
      navigationUrl = options.url;
      if (typeof options.success === 'function') {
        options.success({
          errMsg: 'navigateTo:ok',
        });
      }
    },
  }, async function execute(page) {
    page.handleAtlasItemTap({
      currentTarget: {
        dataset: {
          locationId: 'loc-001',
        },
      },
    });

    assert.strictEqual(navigationUrl, '/pages/location/location?locationId=loc-001');
  });
}

async function run() {
  const tests = [
    testAtlasSuccess,
    testAtlasEmptyState,
    testAtlasErrorState,
    testAtlasCardNavigation,
  ];

  for (const testFn of tests) {
    await testFn();
  }

  console.log('[PASS] atlas local validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
