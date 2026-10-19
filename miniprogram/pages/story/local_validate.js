const assert = require('assert');
const fs = require('fs');
const path = require('path');

const favoriteService = require('../../services/favoriteService');
const locationService = require('../../services/locationService');
const storyService = require('../../services/storyService');

let capturedPageConfig = null;
let currentApp = null;

global.getApp = function getApp() {
  return currentApp;
};

global.Page = function capturePage(config) {
  capturedPageConfig = config;
};

function waitForTick() {
  return new Promise(function resolveLater(resolve) {
    setTimeout(resolve, 0);
  });
}

function requireStoryPage() {
  capturedPageConfig = null;
  delete require.cache[require.resolve('./story.js')];
  require('./story.js');

  if (!capturedPageConfig) {
    throw new Error('Failed to capture story page config.');
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

function createAiStory(overrides) {
  return Object.assign({
    id: 'generated-demo-001',
    locationId: 'loc-demo-001',
    type: 'AI说',
    title: '《夜巡记录没有说出口的那一段》',
    content: '我先记下门口那次停顿。\n\n后面的折返才是重点。',
    source: 'deepseek',
    generated: true,
    locationName: '南头古城',
    city: '深圳',
    locationAddress: '深圳市南山区南头古城',
    storyMeta: {
      identityKey: 'night_monitoring_program',
      displayName: '夜巡监控乙机',
      role: '夜班巡逻与监控复核程序',
      emotionalState: '冷静调查',
      narrativeStance: '调查',
      voiceStyle: '冷静调查型',
      narrativeFormat: '调查记录',
    },
  }, overrides || {});
}

function createFormalStory(overrides) {
  return Object.assign({
    id: 'preset-story-001',
    locationId: 'loc-demo-001',
    type: 'folk',
    title: '《古城砖缝里藏着旧传闻》',
    content: '据说这里每到入夜就会有人停下来多看一眼。',
    source: 'preset',
    generated: false,
    locationName: '南头古城',
    city: '深圳',
    locationAddress: '深圳市南山区南头古城',
  }, overrides || {});
}

function createTravelerStory(overrides) {
  return Object.assign({
    id: 'traveler-story-001',
    locationId: 'loc-demo-001',
    type: 'traveler',
    title: '《我在这里等雨停》',
    content: '那天傍晚风很大，巷子里的人却不急着走。',
    source: 'user',
    generated: false,
    locationName: '南头古城',
    city: '深圳',
    locationAddress: '深圳市南山区南头古城',
  }, overrides || {});
}

function mockServices() {
  favoriteService.checkFavorite = async function checkFavoriteMock() {
    return false;
  };

  locationService.getLocationById = async function getLocationByIdMock(locationId) {
    return {
      id: locationId,
      name: '南头古城',
      city: '深圳',
    };
  };

  storyService.getStoryById = async function getStoryByIdMock() {
    return createFormalStory();
  };
}

async function testAiStoryViewData() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createAiStory());

  assert.strictEqual(storyViewData.currentStory.isAiGenerated, true);
  assert.strictEqual(storyViewData.currentStory.aiPost.displayName, '夜巡监控乙机');
  assert.strictEqual(storyViewData.currentStory.aiPost.role, '夜班巡逻与监控复核程序');
  assert.strictEqual(storyViewData.currentStory.aiPost.displayRole, '夜班巡逻与监控复核程序');
  assert.strictEqual(storyViewData.currentStory.aiPost.complianceText, '本内容由人工智能生成，仅供娱乐与参考。');
  assert.strictEqual(storyViewData.currentStory.title, '《夜巡记录没有说出口的那一段》');
  assert.strictEqual(storyViewData.currentStory.content, '我先记下门口那次停顿。\n\n后面的折返才是重点。');
  assert.strictEqual(storyViewData.currentStory.aiPost.identityKey, undefined);
  assert.strictEqual(storyViewData.currentStory.aiPost.voiceStyleKey, undefined);
  assert.strictEqual(storyViewData.currentStory.note, '');
}

async function testFolkFallbackAiViewData() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createAiStory({
    type: 'folk',
  }));

  assert.strictEqual(storyViewData.currentStory.isAiGenerated, true);
  assert.strictEqual(storyViewData.currentStory.typeLabel, '民间传说');
  assert.strictEqual(storyViewData.currentStory.aiPost.modeBadge, undefined);
}

async function testPresetStoryKeepsOriginalDisplay() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createFormalStory());

  assert.strictEqual(storyViewData.currentStory.isAiGenerated, false);
  assert.strictEqual(storyViewData.currentStory.aiPost, null);
  assert.strictEqual(storyViewData.currentStory.sourceLabel, '预设库');
  assert.notStrictEqual(storyViewData.currentStory.note, '');
}

async function testTravelerStoryKeepsOriginalDisplay() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createTravelerStory());

  assert.strictEqual(storyViewData.currentStory.isAiGenerated, false);
  assert.strictEqual(storyViewData.currentStory.aiPost, null);
  assert.strictEqual(storyViewData.currentStory.sourceLabel, '网友投稿');
  assert.notStrictEqual(storyViewData.currentStory.note, '');
}

async function testMissingStoryMetaFallsBackSafely() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createAiStory({
    storyMeta: null,
  }));

  assert.strictEqual(storyViewData.currentStory.isAiGenerated, true);
  assert.strictEqual(storyViewData.currentStory.aiPost.displayName, 'AI观察者');
  assert.strictEqual(storyViewData.currentStory.aiPost.role, '地点故事生成器');
  assert.strictEqual(storyViewData.currentStory.aiPost.avatarKey, 'default_observer');
}

async function testMuseumIdentityUsesLocationDisplayRole() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createAiStory({
    locationId: 'loc-museum-001',
    locationName: '广州陈家祠',
    storyMeta: {
      identityKey: 'museum_docent_model',
      displayName: '展陈讲解模型',
      role: '讲解与展陈关系分析模型',
      emotionalState: '冷静调查',
      narrativeStance: '分享',
      voiceStyle: '冷静调查型',
      narrativeFormat: '分享笔记',
    },
  }));

  assert.strictEqual(storyViewData.currentStory.locationName, '南头古城');
  assert.strictEqual(
    storyViewData.currentStory.aiPost.displayRole,
    '一款关于「南头古城」的讲解与展陈关系分析 AI 模型'
  );
  assert.strictEqual(storyViewData.currentStory.aiPost.role, '讲解与展陈关系分析模型');
}

async function testLongDisplayNameAndRoleDoNotBreakViewModel() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const longName = '这是一个非常非常非常长的 AI 名称用于验证页面在帖子头部的换行处理';
  const longRole = '这是一个特别长的岗位描述，用来确认论坛帖子头部在长文本情况下不会把标题和正文区域挤坏';
  const storyViewData = await page.buildStoryViewData(createAiStory({
    storyMeta: {
      identityKey: 'bank_risk_program',
      displayName: longName,
      role: longRole,
      emotionalState: '严肃警告',
      narrativeStance: '汇报',
      voiceStyle: '古板严肃型',
      narrativeFormat: '工作汇报',
    },
  }));
  const storyWxss = fs.readFileSync(path.join(__dirname, 'story.wxss'), 'utf8');

  assert.strictEqual(storyViewData.currentStory.aiPost.displayName, longName);
  assert.strictEqual(storyViewData.currentStory.aiPost.role, longRole);
  assert.ok(storyWxss.indexOf('min-width: 0;') !== -1);
  assert.ok(storyWxss.indexOf('word-break: break-word;') !== -1 || storyWxss.indexOf('word-break: break-all;') !== -1);
}

async function testMuseumIdentityDisplayRoleHasLengthProtection() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createAiStory({
    storyMeta: {
      identityKey: 'museum_docent_model',
      displayName: '展陈讲解模型',
      role: '讲解与展陈关系分析模型',
      emotionalState: '冷静调查',
      narrativeStance: '分享',
      voiceStyle: '冷静调查型',
      narrativeFormat: '分享笔记',
    },
    locationName: '',
    selectedPlace: {
      name: '这是一个特别特别特别长的博物馆地点名称用于测试展示长度保护',
    },
    locationId: null,
    isTemporary: true,
    transientPlace: true,
  }));

  assert.strictEqual(
    storyViewData.currentStory.aiPost.displayRole,
    '一款关于「这是一个特别特别特别长的博物馆地...」的讲解与展陈关系分析 AI 模型'
  );
}

async function testTemporaryAiStoryKeepsTransientFlags() {
  mockServices();
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);
  const storyViewData = await page.buildStoryViewData(createAiStory({
    locationId: null,
    isTemporary: true,
    transientPlace: true,
    selectedPlace: {
      name: '临时地点',
      address: '深圳市南山区临时地点',
      latitude: 22.54,
      longitude: 113.93,
    },
  }));

  assert.strictEqual(storyViewData.currentStory.isAiGenerated, true);
  assert.strictEqual(storyViewData.currentStory.transientPlace, true);
  assert.strictEqual(storyViewData.currentStory.collectible, false);
}

async function testLoadGeneratedStoryKeepsStoryMeta() {
  mockServices();
  currentApp = {
    globalData: {
      pendingGeneratedStory: createAiStory(),
    },
  };
  const pageConfig = requireStoryPage();
  const page = createPageInstance(pageConfig);

  page.loadGeneratedStory();
  await waitForTick();

  assert.strictEqual(page.data.currentStory.storyMeta.displayName, '夜巡监控乙机');
  assert.strictEqual(page.data.currentStory.aiPost.displayName, '夜巡监控乙机');
  assert.strictEqual(currentApp.globalData.pendingGeneratedStory, null);
}

function testHomeSloganAndLayout() {
  const indexWxml = fs.readFileSync(path.join(__dirname, '..', 'index', 'index.wxml'), 'utf8');
  const indexWxss = fs.readFileSync(path.join(__dirname, '..', 'index', 'index.wxss'), 'utf8');
  const sloganMatches = indexWxml.match(/让地点拥有不同的声音/g) || [];

  assert.strictEqual(sloganMatches.length, 1);
  assert.ok(indexWxss.indexOf('.floating-profile') !== -1);
  assert.ok(indexWxss.indexOf('position: absolute;') !== -1);
  assert.ok(indexWxss.indexOf('.hero-slogan') !== -1);
}

function testStoryWxmlUsesSingleDisplayRoleRendering() {
  const storyWxml = fs.readFileSync(path.join(__dirname, 'story.wxml'), 'utf8');

  assert.ok(storyWxml.indexOf('<view class="forum-author-row">') !== -1);
  assert.ok(storyWxml.indexOf('<text class="forum-display-name">{{currentStory.aiPost.displayName}}</text>') !== -1);
  assert.ok(storyWxml.indexOf('<view class="forum-identity-description">{{currentStory.aiPost.displayRole}}</view>') !== -1);
  assert.ok(storyWxml.indexOf('<text class="forum-role">{{currentStory.aiPost.displayRole}}</text>') === -1);
  assert.ok(storyWxml.indexOf('currentStory.aiPost.modeBadge') === -1);

  const displayRoleMatches = storyWxml.match(/currentStory\.aiPost\.displayRole/g) || [];
  assert.strictEqual(displayRoleMatches.length, 1);
}

async function run() {
  const tests = [
    ['AI story shows forum profile', testAiStoryViewData],
    ['Folk fallback AI shows special badge', testFolkFallbackAiViewData],
    ['Preset story keeps original display', testPresetStoryKeepsOriginalDisplay],
    ['Traveler story keeps original display', testTravelerStoryKeepsOriginalDisplay],
    ['Missing storyMeta falls back safely', testMissingStoryMetaFallsBackSafely],
    ['Museum identity uses location display role', testMuseumIdentityUsesLocationDisplayRole],
    ['Long display name and role stay safe', testLongDisplayNameAndRoleDoNotBreakViewModel],
    ['Museum identity display role has length protection', testMuseumIdentityDisplayRoleHasLengthProtection],
    ['Temporary AI story keeps transient flags', testTemporaryAiStoryKeepsTransientFlags],
    ['Generated story load keeps storyMeta', testLoadGeneratedStoryKeepsStoryMeta],
    ['Home slogan and profile entry stay in place', testHomeSloganAndLayout],
    ['Story WXML uses single displayRole rendering', testStoryWxmlUsesSingleDisplayRoleRendering],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }

  console.log('[PASS] story page validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
