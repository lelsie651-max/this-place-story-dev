const assert = require('assert');
const Module = require('module');
const path = require('path');

const pagePath = path.join(__dirname, 'favorites.js');

function loadPage(stubs, wxMock) {
  const originalLoad = Module._load;
  let pageConfig = null;

  delete require.cache[pagePath];
  global.Page = function capture(config) {
    pageConfig = config;
  };
  global.wx = wxMock || {};

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../../services/favoriteService') {
      return stubs.favoriteService;
    }

    if (request === '../../services/locationService') {
      return stubs.locationService;
    }

    if (request === '../../services/storyService') {
      return stubs.storyService;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(pagePath);
    return pageConfig;
  } finally {
    Module._load = originalLoad;
    delete require.cache[pagePath];
    delete global.Page;
    delete global.wx;
  }
}

function createInstance(pageConfig, wxMock) {
  const instance = {
    data: Object.assign({}, pageConfig.data),
    setData(update) {
      this.data = Object.assign({}, this.data, update || {});
    },
  };

  global.wx = wxMock || {};

  Object.keys(pageConfig).forEach(function assign(key) {
    if (typeof pageConfig[key] === 'function') {
      instance[key] = pageConfig[key];
    }
  });

  return instance;
}

async function testDeletedStoriesAreSkipped() {
  const pageConfig = loadPage({
    favoriteService: {
      TEST_USER_ID: 'system_test_user',
      async getFavorites() {
        return [{
          id: 'fav-1',
          storyId: 'deleted-story',
        }, {
          id: 'fav-2',
          storyId: 'published-story',
        }];
      },
    },
    locationService: {
      async getLocationById() {
        return {
          id: 'loc-1',
          name: '南头古城',
          city: '深圳',
        };
      },
    },
    storyService: {
      async getStoryById(storyId) {
        if (storyId === 'deleted-story') {
          const error = new Error('该内容暂不可查看。');
          error.code = 'CONTENT_NOT_AVAILABLE';
          throw error;
        }

        return {
          id: storyId,
          title: '公开故事',
          locationId: 'loc-1',
        };
      },
    },
  }, {});
  const page = createInstance(pageConfig, {});

  await page.loadFavorites();

  assert.strictEqual(page.data.favoriteItems.length, 1);
  assert.strictEqual(page.data.favoriteItems[0].storyId, 'published-story');
}

async function testMissingStoryIdShowsSafeToast() {
  const pageConfig = loadPage({
    favoriteService: {
      TEST_USER_ID: 'system_test_user',
      async getFavorites() {
        return [];
      },
    },
    locationService: {
      async getLocationById() {
        return null;
      },
    },
    storyService: {
      async getStoryById() {
        return null;
      },
    },
  }, {
    showToast(options) {
      global.__lastFavoriteToast = options.title;
    },
    navigateTo() {},
  });
  const page = createInstance(pageConfig, {
    showToast(options) {
      global.__lastFavoriteToast = options.title;
    },
    navigateTo(options) {
      global.__lastFavoriteNavigate = options.url;
    },
  });

  page.goToStoryDetail({
    currentTarget: {
      dataset: {},
    },
  });
  assert.strictEqual(global.__lastFavoriteToast, '故事ID缺失');

  page.goToStoryDetail({
    currentTarget: {
      dataset: {
        storyId: 'story-1',
      },
    },
  });
  assert.strictEqual(global.__lastFavoriteNavigate, '/pages/story/story?storyId=story-1');

  delete global.__lastFavoriteToast;
  delete global.__lastFavoriteNavigate;
}

async function run() {
  const tests = [
    ['Favorites skips unavailable stories', testDeletedStoriesAreSkipped],
    ['Favorites shows safe toast for missing storyId', testMissingStoryIdShowsSafeToast],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }

  delete global.wx;
}

run().catch(function onError(error) {
  delete global.wx;
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
