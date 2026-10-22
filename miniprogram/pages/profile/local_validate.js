const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'profile.js');
const templatePath = path.join(__dirname, 'profile.wxml');
const atlasPagePath = path.join(__dirname, '..', 'atlas', 'atlas.js');
const indexTemplatePath = path.join(__dirname, '..', 'index', 'index.wxml');
const appJsonPath = path.join(__dirname, '..', '..', 'app.json');

function loadProfilePage() {
  let pageConfig = null;

  delete require.cache[pagePath];
  global.Page = function capture(config) {
    pageConfig = config;
  };
  global.getApp = function getApp() {
    return {
      globalData: {},
    };
  };
  global.wx = {};

  try {
    require(pagePath);
    return pageConfig;
  } finally {
    delete require.cache[pagePath];
    delete global.Page;
    delete global.getApp;
    delete global.wx;
  }
}

function testProfileMenuRemovesAtlasEntry() {
  const pageConfig = loadProfilePage();
  const menuItems = pageConfig && pageConfig.data ? pageConfig.data.menuItems || [] : [];
  const keys = menuItems.map(function getKey(item) {
    return item.key;
  });
  const labels = menuItems.map(function getLabel(item) {
    return item.label;
  });

  assert.strictEqual(keys.indexOf('atlas'), -1, '个人中心不应再包含我的图鉴入口');
  assert.ok(labels.indexOf('我的收藏') !== -1, '个人中心应保留我的收藏');
  assert.ok(labels.indexOf('我的投稿') !== -1, '个人中心应保留我的投稿');
}

function testProfileTemplateRemovesAtlasCopy() {
  const template = fs.readFileSync(templatePath, 'utf8');

  assert.strictEqual(template.indexOf('我的图鉴'), -1, '个人中心模板不应再出现我的图鉴');
  assert.strictEqual(template.indexOf('图鉴和当前可用资源'), -1, '个人中心副标题不应再保留图鉴文案');
}

function testAtlasPageAndTabBarStillExist() {
  const atlasSource = fs.readFileSync(atlasPagePath, 'utf8');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const tabList = appJson && appJson.tabBar && Array.isArray(appJson.tabBar.list)
    ? appJson.tabBar.list
    : [];
  const pagePaths = tabList.map(function getPath(item) {
    return item.pagePath;
  });

  assert.ok(atlasSource.indexOf('loadAtlasItems') !== -1, 'atlas 页面仍应存在');
  assert.ok(pagePaths.indexOf('pages/atlas/atlas') !== -1, '底部足迹 tab 仍应保留 atlas 页面');
}

function testNoResidualAtlasMenuHelperExists() {
  const source = fs.readFileSync(pagePath, 'utf8');

  assert.strictEqual(source.indexOf("label: '我的图鉴'"), -1, 'profile.js 不应再保留我的图鉴菜单配置');
}

function testHomeRecommendationAndTabBarRemain() {
  const indexTemplate = fs.readFileSync(indexTemplatePath, 'utf8');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  assert.ok(indexTemplate.indexOf('编辑推荐') !== -1, '首页编辑推荐模块应保持存在');
  assert.ok(appJson.tabBar && Array.isArray(appJson.tabBar.list), 'tabBar 配置应保持存在');
}

async function run() {
  const tests = [
    ['Profile menu removes atlas entry', testProfileMenuRemovesAtlasEntry],
    ['Profile template removes atlas copy', testProfileTemplateRemovesAtlasCopy],
    ['Atlas page and tab bar still exist', testAtlasPageAndTabBarStillExist],
    ['No residual atlas menu helper exists', testNoResidualAtlasMenuHelperExists],
    ['Home recommendation and tab bar remain', testHomeRecommendationAndTabBarRemain],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
