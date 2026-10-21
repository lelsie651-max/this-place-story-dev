const assert = require('assert');
const Module = require('module');
const path = require('path');

const pagePath = path.join(__dirname, 'myStoryEdit.js');

function loadPage(options) {
  const originalLoad = Module._load;
  let pageConfig = null;
  const appInstance = options && options.app ? options.app : { globalData: {} };

  delete require.cache[pagePath];
  global.Page = function capture(config) {
    pageConfig = config;
  };
  global.getApp = function getApp() {
    return appInstance;
  };
  global.wx = options && options.wx ? options.wx : {};

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../../services/storyService') {
      return options.storyService;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const exported = require(pagePath);
    return {
      pageConfig: pageConfig,
      privateApi: exported && exported._private ? exported._private : {},
      app: appInstance,
    };
  } finally {
    Module._load = originalLoad;
    delete require.cache[pagePath];
    delete global.Page;
    delete global.getApp;
    delete global.wx;
  }
}

function createInstance(pageConfig, options) {
  const instance = {
    data: Object.assign({}, pageConfig.data),
    submitLock: false,
    setData(update) {
      this.data = Object.assign({}, this.data, update || {});
    },
  };

  global.getApp = function getApp() {
    return options.app;
  };
  global.getCurrentPages = function getCurrentPages() {
    return options.pages || [{ route: 'pages/myStoryPreview/myStoryPreview' }, { route: 'pages/myStoryEdit/myStoryEdit' }];
  };
  global.wx = options.wx;

  Object.keys(pageConfig).forEach(function assign(key) {
    if (key !== 'data' && typeof pageConfig[key] === 'function') {
      instance[key] = pageConfig[key];
    }
  });

  return instance;
}

async function testPendingAndRejectedEditable() {
  const loaded = loadPage({
    app: {
      globalData: {},
    },
    wx: {},
    storyService: {
      canEditMyStory(status) {
        return status === 'pending' || status === 'rejected';
      },
      async getMyStoryById(storyId) {
        return {
          id: storyId,
          status: storyId === 'story-rejected' ? 'rejected' : 'pending',
          title: '原标题',
          content: '原正文',
          locationName: '南头古城',
          placeSnapshot: {
            address: '深圳市南山区南头古城',
          },
        };
      },
      async updateTravelerStory(payload) {
        page.lastUpdatePayload = payload;
        return {
          storyId: payload.storyId,
          status: 'pending',
          updated: true,
          message: '修改已提交，审核通过后会展示。',
        };
      },
    },
  });
  const page = createInstance(loaded.pageConfig, {
    app: loaded.app,
    wx: {
      showToast(options) {
        page.lastToast = options.title;
      },
      navigateBack(options) {
        page.lastNavigateBack = options.delta;
      },
      redirectTo(options) {
        page.lastRedirect = options.url;
        if (typeof options.success === 'function') {
          options.success({});
        }
      },
      reLaunch() {},
    },
  });

  page.onLoad({
    storyId: encodeURIComponent('story-pending'),
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(page.data.storyTitle, '原标题');

  page.setData({
    storyTitle: '新标题',
    storyContent: '新正文',
  });
  await page.submitEdit();
  assert.deepStrictEqual(page.lastUpdatePayload, {
    storyId: 'story-pending',
    title: '新标题',
    content: '新正文',
  });
  assert.strictEqual(page.lastNavigateBack, 1);

  page.onLoad({
    storyId: encodeURIComponent('story-rejected'),
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(page.data.story.status, 'rejected');
}

async function testPublishedAndHiddenBlocked() {
  const loaded = loadPage({
    app: {
      globalData: {},
    },
    wx: {},
    storyService: {
      canEditMyStory() {
        return false;
      },
      async getMyStoryById() {
        return {
          id: 'story-hidden',
          status: 'hidden',
          title: '原标题',
          content: '原正文',
          locationName: '南头古城',
          placeSnapshot: {},
        };
      },
      async updateTravelerStory() {
        throw new Error('should not update');
      },
    },
  });
  const page = createInstance(loaded.pageConfig, {
    app: loaded.app,
    wx: {
      showToast(options) {
        page.lastToast = options.title;
      },
      redirectTo(options) {
        page.lastRedirect = options.url;
        if (typeof options.success === 'function') {
          options.success({});
        }
      },
      reLaunch() {},
    },
  });

  page.onLoad({
    storyId: encodeURIComponent('story-hidden'),
  });
  await Promise.resolve();
  await Promise.resolve();

  assert.strictEqual(page.lastToast, '当前状态暂不可编辑');
  assert.strictEqual(
    page.lastRedirect,
    '/pages/myStoryPreview/myStoryPreview?storyId=' + encodeURIComponent('story-hidden')
  );
}

async function testCancelValidationAndSubmitGuard() {
  let updateCalls = 0;
  const loaded = loadPage({
    app: {
      globalData: {},
    },
    wx: {},
    storyService: {
      canEditMyStory() {
        return true;
      },
      async getMyStoryById() {
        return {
          id: 'story-1',
          status: 'pending',
          title: '原标题',
          content: '原正文',
          locationName: '南头古城',
          placeSnapshot: {},
        };
      },
      async updateTravelerStory() {
        updateCalls += 1;
        return {
          storyId: 'story-1',
          status: 'pending',
          updated: true,
          message: '修改已提交，审核通过后会展示。',
        };
      },
    },
  });
  const page = createInstance(loaded.pageConfig, {
    app: loaded.app,
    wx: {
      showToast(options) {
        page.lastToast = options.title;
      },
      navigateBack(options) {
        page.lastNavigateBack = options.delta;
      },
      redirectTo(options) {
        page.lastRedirect = options.url;
        if (typeof options.success === 'function') {
          options.success({});
        }
      },
      reLaunch() {},
    },
  });

  page.onLoad({
    storyId: encodeURIComponent('story-1'),
  });
  await Promise.resolve();
  await Promise.resolve();

  await page.cancelEdit();
  assert.strictEqual(page.lastNavigateBack, 1);

  page.setData({
    storyTitle: '',
    storyContent: '正文',
  });
  await page.submitEdit();
  assert.strictEqual(page.lastToast, '请输入故事标题。');
  assert.strictEqual(updateCalls, 0);

  page.setData({
    storyTitle: '标题',
    storyContent: '正文',
    submitting: true,
  });
  await page.submitEdit();
  assert.strictEqual(updateCalls, 0);
}

async function run() {
  const tests = [
    ['Pending and rejected stories are editable', testPendingAndRejectedEditable],
    ['Published and hidden stories are blocked', testPublishedAndHiddenBlocked],
    ['Cancel, validation, and submit guard work', testCancelValidationAndSubmitGuard],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }

  delete global.getApp;
  delete global.getCurrentPages;
  delete global.wx;
}

run().catch(function onError(error) {
  delete global.getApp;
  delete global.getCurrentPages;
  delete global.wx;
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
