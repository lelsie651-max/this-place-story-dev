const assert = require('assert');
const Module = require('module');
const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'index.js');
const templatePath = path.join(__dirname, 'index.wxml');
const appJsonPath = path.join(__dirname, '..', '..', 'app.json');

function loadPage(options) {
  const originalLoad = Module._load;
  let pageConfig = null;

  delete require.cache[pagePath];
  global.Page = function capture(config) {
    pageConfig = config;
  };
  global.wx = options && options.wx ? options.wx : {};

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../../services/storyService') {
      return options.storyService;
    }

    if (request === '../../services/locationService') {
      return options.locationService;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const exported = require(pagePath);
    return {
      pageConfig: pageConfig,
      privateApi: exported && exported._private ? exported._private : {},
      exported: exported || {},
    };
  } finally {
    Module._load = originalLoad;
    delete require.cache[pagePath];
    delete global.Page;
    delete global.wx;
  }
}

function createInstance(pageConfig, wxStub) {
  const instance = {
    data: Object.assign({}, pageConfig.data),
    setData(update) {
      this.data = Object.assign({}, this.data, update || {});
    },
  };

  global.wx = wxStub;

  Object.keys(pageConfig).forEach(function assign(key) {
    if (key !== 'data' && typeof pageConfig[key] === 'function') {
      instance[key] = pageConfig[key];
    }
  });

  return instance;
}

function createStoryServiceStub(options) {
  const invalidIds = options && options.invalidIds ? options.invalidIds : [];

  return {
    async getStoryById(storyId) {
      if (invalidIds.indexOf(storyId) !== -1) {
        const error = new Error('该内容暂不可查看。');
        error.code = 'CONTENT_NOT_AVAILABLE';
        throw error;
      }

      return {
        id: storyId,
        title: '故事-' + storyId,
        summary: '这是故事摘要-' + storyId,
        content: '这是故事正文-' + storyId,
        status: 'published',
        locationId: 'loc-' + storyId,
        isTemporary: false,
      };
    },
  };
}

function createLocationServiceStub() {
  return {
    async getLocationById(locationId) {
      return {
        id: locationId,
        name: '地点-' + locationId,
        city: '深圳',
      };
    },
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(function wait(resolve) {
    setTimeout(resolve, 0);
  });
}

function testRecommendationConfigRules() {
  const loaded = loadPage({
    storyService: createStoryServiceStub(),
    locationService: createLocationServiceStub(),
  });
  const recommendations = loaded.exported.RECOMMENDATION_STORIES;

  assert.ok(Array.isArray(recommendations), '推荐配置应为数组');
  assert.ok(recommendations.length <= 3, '推荐配置最多 3 条');
  recommendations.forEach(function verify(item) {
    assert.ok(item && typeof item === 'object', '推荐项必须是对象');
    assert.ok(item.storyId && String(item.storyId).trim(), '每条推荐必须包含有效 storyId');
  });
}

async function testRecommendationLoadAndNavigation() {
  const loaded = loadPage({
    storyService: createStoryServiceStub(),
    locationService: createLocationServiceStub(),
    wx: {
      navigateTo() {},
    },
  });
  const page = createInstance(loaded.pageConfig, {
    navigateTo(options) {
      page.lastNavigateUrl = options.url;
    },
  });

  page.onLoad();
  await flushPromises();

  assert.ok(page.data.recommendationCards.length > 0, '应成功加载推荐卡片');
  page.goToRecommendation({
    currentTarget: {
      dataset: {
        storyId: page.data.recommendationCards[0].storyId,
      },
    },
  });

  assert.ok(page.lastNavigateUrl.indexOf('/pages/story/story?storyId=') === 0, '推荐跳转应进入故事详情页');
  assert.ok(page.lastNavigateUrl.indexOf('&entry=recommendation') !== -1, '推荐跳转应带 entry=recommendation');
}

async function testInvalidStoriesAreSkipped() {
  const loaded = loadPage({
    storyService: createStoryServiceStub({
      invalidIds: ['story_nantou_folk_01'],
    }),
    locationService: createLocationServiceStub(),
  });
  const cards = await loaded.privateApi.loadRecommendationCards(
    loaded.privateApi.getRecommendationConfigs()
  );

  assert.strictEqual(cards.length, 2, '无效故事应被跳过，不应显示空白卡片');
  assert.ok(cards.every(function verifyCard(card) {
    return !!card && !!card.storyId && !!card.displayTitle;
  }), '推荐卡片应全部为有效展示项');
}

async function testEmptyRecommendationsDoNotCrash() {
  const loaded = loadPage({
    storyService: createStoryServiceStub(),
    locationService: createLocationServiceStub(),
  });
  const cards = await loaded.privateApi.loadRecommendationCards([]);

  assert.deepStrictEqual(cards, [], '空推荐列表应返回空数组');
}

function testPrimaryEntriesRemainUnchanged() {
  const loaded = loadPage({
    storyService: createStoryServiceStub(),
    locationService: createLocationServiceStub(),
  });
  const page = createInstance(loaded.pageConfig, {
    switchTab(options) {
      page.lastSwitchTabUrl = options.url;
    },
    navigateTo(options) {
      page.lastNavigateUrl = options.url;
    },
  });

  page.goToExplore();
  assert.strictEqual(page.lastSwitchTabUrl, '/pages/discovery/discovery', '寻找传说入口应切换到推荐 tab');

  page.goToPublish();
  assert.strictEqual(page.lastNavigateUrl, '/pages/publish/publish', '分享传说入口不能改变');
}

function testRecommendationPathHasNoBillingOrExplorationCalls() {
  const source = fs.readFileSync(pagePath, 'utf8');

  assert.strictEqual(source.indexOf('prepareMagnifyingGlassUsage'), -1, '推荐路径中不应出现 prepare 调用');
  assert.strictEqual(source.indexOf('consumeMagnifyingGlass'), -1, '推荐路径中不应出现 consume 调用');
  assert.strictEqual(source.indexOf('recordExploration'), -1, '推荐路径中不应出现足迹记录调用');
}

function testTemplateHasRecommendationModule() {
  const template = fs.readFileSync(templatePath, 'utf8');

  assert.ok(template.indexOf('编辑推荐') !== -1, '首页应显示编辑推荐标题');
  assert.ok(template.indexOf('swiper') !== -1, '推荐模块应使用横向滚动组件');
  assert.ok(template.indexOf('bindtap="goToRecommendation"') !== -1, '推荐卡片应绑定点击跳转');
  assert.strictEqual(template.indexOf('floating-profile'), -1, '首页不应再包含头像入口节点');
  assert.ok(template.indexOf('display-multiple-items="1"') !== -1, '推荐 swiper 应保持单项视口');
  assert.strictEqual(template.indexOf('previous-margin='), -1, '推荐 swiper 不应设置 previous-margin 造成露出效果');
  assert.strictEqual(template.indexOf('next-margin='), -1, '推荐 swiper 不应设置 next-margin 造成露出效果');
}

function testSingleCardViewportStyles() {
  const styleSource = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');

  assert.ok(
    styleSource.indexOf('.recommendation-swiper-wrap {\n  overflow: hidden;') !== -1,
    '推荐 swiper 外层应隐藏溢出，避免相邻卡片露出'
  );
  assert.ok(
    styleSource.indexOf('.recommendation-slide {\n  display: flex;\n  justify-content: center;') !== -1,
    'swiper-item 内层应使用 flex 居中'
  );
  assert.ok(
    styleSource.indexOf('.recommendation-card {\n  display: flex;\n  align-items: stretch;\n  width: 100%;') !== -1,
    '推荐卡片应占满当前 swiper-item 的可视宽度'
  );
  assert.strictEqual(styleSource.indexOf('.floating-profile'), -1, '首页样式不应再保留头像入口样式');
}

function testHomeTopLayoutAndTabBarConfig() {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const styleSource = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');
  const source = fs.readFileSync(pagePath, 'utf8');
  const tabBar = appJson.tabBar || {};
  const tabList = Array.isArray(tabBar.list) ? tabBar.list : [];
  const pagePaths = tabList.map(function getPath(item) {
    return item.pagePath;
  });

  assert.ok(tabBar && typeof tabBar === 'object', 'app.json 应配置原生 tabBar');
  assert.deepStrictEqual(
    pagePaths,
    [
      'pages/index/index',
      'pages/discovery/discovery',
      'pages/atlas/atlas',
      'pages/profile/profile',
    ],
    'tabBar 页面路径应为首页、推荐、足迹、我的'
  );
  assert.strictEqual(source.indexOf('goToProfile'), -1, '首页不应再绑定头像入口事件');
  assert.ok(styleSource.indexOf('padding-top: 72rpx;') !== -1, '首页主视觉应上移以填补头像入口空白');
}

async function run() {
  const tests = [
    ['Recommendation config rules', testRecommendationConfigRules],
    ['Recommendation load and navigation', testRecommendationLoadAndNavigation],
    ['Invalid recommendations are skipped', testInvalidStoriesAreSkipped],
    ['Empty recommendation list does not crash', testEmptyRecommendationsDoNotCrash],
    ['Primary entries remain unchanged', testPrimaryEntriesRemainUnchanged],
    ['Recommendation path has no billing or exploration calls', testRecommendationPathHasNoBillingOrExplorationCalls],
    ['Template contains recommendation module', testTemplateHasRecommendationModule],
    ['Recommendation uses single-card viewport styles', testSingleCardViewportStyles],
    ['Home top layout and tab bar config are correct', testHomeTopLayoutAndTabBarConfig],
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
