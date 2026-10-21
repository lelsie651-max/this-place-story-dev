const assert = require('assert');
const Module = require('module');
const path = require('path');

const pagePath = path.join(__dirname, 'myStoryPreview.js');

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
    hasLoadedOnce: false,
    setData(update) {
      this.data = Object.assign({}, this.data, update || {});
    },
  };

  global.getApp = function getApp() {
    return options.app;
  };
  global.wx = options.wx;

  Object.keys(pageConfig).forEach(function assign(key) {
    if (key !== 'data' && typeof pageConfig[key] === 'function') {
      instance[key] = pageConfig[key];
    }
  });

  return instance;
}

async function testPreviewLoadAndDisplay() {
  const loaded = loadPage({
    app: {
      globalData: {},
    },
    wx: {
      navigateTo() {},
      showToast() {},
      navigateBack() {},
      redirectTo() {},
      reLaunch() {},
    },
    storyService: {
      canEditMyStory(status) {
        return status === 'pending' || status === 'rejected';
      },
      formatStorySubmissionTime() {
        return '2026年10月21日 12:30';
      },
      async getMyStoryById(storyId) {
        assert.strictEqual(storyId, 'story-1');
        return {
          id: 'story-1',
          title: '旧城夜话',
          content: '完整正文',
          status: 'rejected',
          statusLabel: '未通过',
          rejectionReason: '地点信息不足',
          locationName: '南头古城',
          placeSnapshot: {
            address: '深圳市南山区南头古城',
          },
          createdAt: '2026-10-21T12:30:00.000Z',
        };
      },
    },
  });
  const page = createInstance(loaded.pageConfig, {
    app: loaded.app,
    wx: {
      navigateTo(options) {
        page.lastNavigate = options.url;
      },
      showToast(options) {
        page.lastToast = options.title;
      },
      navigateBack() {},
      redirectTo() {},
      reLaunch() {},
    },
  });

  page.onLoad({
    storyId: encodeURIComponent('story-1'),
  });
  await Promise.resolve();
  await Promise.resolve();

  assert.strictEqual(page.data.story.title, '旧城夜话');
  assert.strictEqual(page.data.story.createdAtText, '投稿时间：2026年10月21日 12:30');
  assert.strictEqual(page.data.story.locationAddress, '深圳市南山区南头古城');
  assert.strictEqual(page.data.story.canEdit, true);

  page.openEditPage();
  assert.strictEqual(
    page.lastNavigate,
    '/pages/myStoryEdit/myStoryEdit?storyId=' + encodeURIComponent('story-1')
  );
}

async function testMissingStoryIdAndStatusDisplay() {
  const loaded = loadPage({
    app: {
      globalData: {
        pendingMyStoryPreviewNotice: {
          storyId: 'story-2',
          message: '修改已提交，审核通过后会展示。',
        },
      },
    },
    wx: {
      navigateTo() {},
      showToast() {},
      navigateBack() {},
      redirectTo() {},
      reLaunch() {},
    },
    storyService: {
      canEditMyStory() {
        return false;
      },
      formatStorySubmissionTime() {
        return '2026年10月21日 12:30';
      },
      async getMyStoryById() {
        return {
          id: 'story-2',
          title: '已隐藏故事',
          content: '完整正文',
          status: 'hidden',
          statusLabel: '已隐藏',
          rejectionReason: '',
          locationName: '南头古城',
          placeSnapshot: {},
          createdAt: '2026-10-21T12:30:00.000Z',
        };
      },
    },
  });
  const page = createInstance(loaded.pageConfig, {
    app: loaded.app,
    wx: {
      navigateTo() {},
      showToast(options) {
        page.lastToast = options.title;
      },
      navigateBack() {},
      redirectTo() {},
      reLaunch() {},
    },
  });

  page.onLoad({});
  assert.strictEqual(page.data.errorMessage, '缺少有效的投稿标识。');

  page.onLoad({
    storyId: encodeURIComponent('story-2'),
  });
  await Promise.resolve();
  await Promise.resolve();
  page.onShow();
  await Promise.resolve();
  await Promise.resolve();

  assert.strictEqual(page.data.story.statusLabel, '已隐藏');
  assert.strictEqual(page.data.story.canEdit, false);
  assert.strictEqual(page.data.noticeMessage, '修改已提交，审核通过后会展示。');
}

async function testForbiddenReadShowsSafeError() {
  const loaded = loadPage({
    app: {
      globalData: {},
    },
    wx: {
      navigateTo() {},
      showToast() {},
      navigateBack() {},
      redirectTo() {},
      reLaunch() {},
    },
    storyService: {
      canEditMyStory() {
        return false;
      },
      formatStorySubmissionTime() {
        return '';
      },
      async getMyStoryById() {
        const error = new Error('当前投稿不存在或暂不可查看');
        error.code = 'STORY_NOT_FOUND';
        throw error;
      },
    },
  });
  const page = createInstance(loaded.pageConfig, {
    app: loaded.app,
    wx: {
      navigateTo() {},
      showToast() {},
      navigateBack() {},
      redirectTo() {},
      reLaunch() {},
    },
  });

  page.onLoad({
    storyId: encodeURIComponent('other-user-story'),
  });
  await Promise.resolve();
  await Promise.resolve();

  assert.strictEqual(page.data.errorMessage, '当前投稿不存在或暂不可查看');
}

async function run() {
  const tests = [
    ['Preview loads own story and opens edit', testPreviewLoadAndDisplay],
    ['Preview handles missing storyId and hidden status', testMissingStoryIdAndStatusDisplay],
    ['Preview blocks other user stories safely', testForbiddenReadShowsSafeError],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }

  delete global.getApp;
  delete global.wx;
}

run().catch(function onError(error) {
  delete global.getApp;
  delete global.wx;
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
