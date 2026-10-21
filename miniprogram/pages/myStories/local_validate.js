const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const pagePath = path.join(__dirname, 'myStories.js');
const wxmlPath = path.join(__dirname, 'myStories.wxml');

function loadPage(storyServiceStub, wxMock) {
  const originalLoad = Module._load;
  let pageConfig = null;

  delete require.cache[pagePath];
  global.Page = function capture(config) {
    pageConfig = config;
  };
  global.wx = wxMock || {};

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../../services/storyService') {
      return storyServiceStub;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const exported = require(pagePath);
    return {
      pageConfig: pageConfig,
      privateApi: exported && exported._private ? exported._private : {},
    };
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
    if (key !== 'data' && typeof pageConfig[key] === 'function') {
      instance[key] = pageConfig[key];
    }
  });

  return instance;
}

async function testWxmlStructure() {
  const source = fs.readFileSync(wxmlPath, 'utf8');

  assert.ok(source.indexOf('bindtap="goBack"') === -1);
  assert.ok(source.indexOf('<view class="top-bar">') === -1);
  assert.ok(source.indexOf('{{item.content}}') === -1);
  assert.ok(source.indexOf('data-story-id="{{item.id}}"') !== -1);
  assert.ok(source.indexOf('bindtap="openStoryPreview"') !== -1);
  assert.ok(source.indexOf('{{item.createdAtText}}') !== -1);
}

async function testFormattingAndNavigation() {
  const storyServiceStub = {
    formatStorySubmissionTime(value) {
      if (value === 'valid') {
        return '2026年10月21日 12:30';
      }
      if (value && typeof value === 'object' && (value.createdAt === 'valid' || value.updatedAt === 'valid')) {
        return '2026年10月21日 12:30';
      }
      return '';
    },
    getMyStories: async function getMyStories() {
      return [];
    },
  };
  const navigation = {
    url: '',
    toast: '',
  };
  const loaded = loadPage(storyServiceStub, {
    navigateTo(options) {
      navigation.url = options.url;
    },
    showToast(options) {
      navigation.toast = options.title;
    },
  });

  assert.strictEqual(
    loaded.privateApi.formatStoryTimeText({
      createdAt: 'valid',
    }),
    '投稿时间：2026年10月21日 12:30'
  );
  assert.strictEqual(
    loaded.privateApi.formatStoryTimeText({
      createdAt: 'missing',
    }),
    '投稿时间：待补充'
  );
  assert.strictEqual(
    loaded.privateApi.formatStoryTimeText({
      createdAt: 'valid',
      updatedAt: 'valid',
    }),
    '最近修改时间：2026年10月21日 12:30'
  );

  const mappedStories = loaded.privateApi.normalizeStoriesForDisplay([{
    id: 'story-1',
    createdAt: 'valid',
  }, {
    id: 'story-2',
    createdAt: 'valid',
    updatedAt: 'valid',
  }]);
  assert.strictEqual(mappedStories[0].createdAtText, '投稿时间：2026年10月21日 12:30');
  assert.strictEqual(mappedStories[1].createdAtText, '最近修改时间：2026年10月21日 12:30');

  const page = createInstance(loaded.pageConfig, {
    navigateTo(options) {
      navigation.url = options.url;
    },
    showToast(options) {
      navigation.toast = options.title;
    },
  });

  page.openStoryPreview({
    currentTarget: {
      dataset: {
        storyId: 'story-1',
      },
    },
  });
  assert.strictEqual(
    navigation.url,
    '/pages/myStoryPreview/myStoryPreview?storyId=' + encodeURIComponent('story-1')
  );

  page.openStoryPreview({
    currentTarget: {
      dataset: {},
    },
  });
  assert.strictEqual(navigation.toast, '当前投稿缺少有效标识');
}

async function run() {
  const tests = [
    ['MyStories WXML structure', testWxmlStructure],
    ['MyStories formatting and navigation', testFormattingAndNavigation],
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
