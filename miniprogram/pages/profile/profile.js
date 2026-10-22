const favoriteService = require('../../services/favoriteService');
const storyService = require('../../services/storyService');
const userService = require('../../services/userService');

const AD_REWARD_DEFAULT_LIMIT = 3;
const DEV_TEST_TOOL_ALLOWED_ENVS = {
  develop: true,
  trial: true,
};
const TAB_PAGE_ROUTES = {
  '/pages/index/index': true,
  '/pages/atlas/atlas': true,
  '/pages/publish/publish': true,
  '/pages/profile/profile': true,
};

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isConfiguredRewardAdUnitId(adUnitId) {
  const normalizedAdUnitId = trimString(adUnitId);

  if (!normalizedAdUnitId) {
    return false;
  }

  const lowerCaseValue = normalizedAdUnitId.toLowerCase();

  if (
    normalizedAdUnitId.indexOf('<') !== -1
    || normalizedAdUnitId.indexOf('>') !== -1
    || lowerCaseValue.indexOf('placeholder') !== -1
    || lowerCaseValue.indexOf('your-') !== -1
    || lowerCaseValue.indexOf('replace') !== -1
    || normalizedAdUnitId.indexOf('真实') !== -1
  ) {
    return false;
  }

  return true;
}

function createRewardRequestId() {
  return 'ad-reward-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function getRewardAdUserMessage(error) {
  const code = error && error.code ? String(error.code) : '';

  if (code === 'AD_REWARD_DAILY_LIMIT') {
    return '今日广告奖励已用完';
  }

  if (code === 'AD_REWARD_UNAVAILABLE') {
    return '广告暂时不可用，请稍后再试';
  }

  if (code === 'DEPLOY_REQUIRED') {
    return '广告奖励服务尚未更新，请稍后再试';
  }

  if (code === 'UNAUTHORIZED') {
    return '当前用户身份读取失败，请稍后再试';
  }

  return '广告暂时不可用，请稍后再试';
}

function getMiniProgramEnvVersion() {
  const app = getApp();
  const appEnvVersion = app
    && app.globalData
    && typeof app.globalData.miniProgramEnvVersion === 'string'
    ? trimString(app.globalData.miniProgramEnvVersion)
    : '';

  if (appEnvVersion) {
    return appEnvVersion;
  }

  if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
    return 'release';
  }

  try {
    const accountInfo = wx.getAccountInfoSync();
    const envVersion = accountInfo
      && accountInfo.miniProgram
      && accountInfo.miniProgram.envVersion;

    return trimString(envVersion) || 'release';
  } catch (error) {
    console.warn('[profile] getAccountInfoSync failed', {
      message: error && error.message ? error.message : '',
    });
    return 'release';
  }
}

function isDevTestToolEnv(envVersion) {
  return !!DEV_TEST_TOOL_ALLOWED_ENVS[trimString(envVersion)];
}

function isTabPageRoute(route) {
  return !!TAB_PAGE_ROUTES[trimString(route)];
}

Page({
  data: {
    favoriteCount: 0,
    magnifyingGlass: 0,
    myStoryCount: 0,
    adRewardAvailable: false,
    adRewardDailyCount: 0,
    adRewardDailyLimit: AD_REWARD_DEFAULT_LIMIT,
    adRewardLoading: false,
    adRewardButtonLoading: false,
    adRewardButtonText: '看视频获得 1 枚放大镜',
    devTestToolsVisible: false,
    devTestToolsChecking: false,
    devTestToolsEnvVersion: 'release',
    menuItems: [
      { key: 'favorites', label: '我的收藏', icon: '🤍', route: '/pages/favorites/favorites' },
      { key: 'stories', label: '我的投稿', icon: '📖', route: '/pages/myStories/myStories' },
      { key: 'language', label: '语言设置', icon: '🌐' },
      { key: 'settings', label: '设置', icon: '⚙️' },
    ],
  },

  onLoad() {
    this.rewardedVideoAd = null;
    this.rewardCloseHandled = false;
    this.pendingRewardContext = null;
    this.handleAdLoadBound = this.handleRewardedVideoAdLoad.bind(this);
    this.handleAdErrorBound = this.handleRewardedVideoAdError.bind(this);
    this.handleAdCloseBound = this.handleRewardedVideoAdClose.bind(this);
    this.initRewardedVideoAd();
  },

  onShow() {
    this.loadFavoriteCount();
    this.loadProfileAsset();
    this.loadMyStoryCount();
    this.loadAdRewardStatus();
    this.loadDevTestToolAccess();
  },

  onUnload() {
    this.destroyRewardedVideoAd();
  },

  getRewardAdUnitId() {
    const app = getApp();
    const adUnitId = app && app.globalData ? app.globalData.rewardedVideoAdUnitId : '';

    return trimString(adUnitId);
  },

  isRewardAdFeatureAvailable() {
    const app = getApp();
    const adUnitId = this.getRewardAdUnitId();

    return !!(
      app
      && app.globalData
      && app.globalData.cloudReady
      && typeof wx !== 'undefined'
      && typeof wx.createRewardedVideoAd === 'function'
      && isConfiguredRewardAdUnitId(adUnitId)
    );
  },

  initRewardedVideoAd() {
    if (!this.isRewardAdFeatureAvailable()) {
      this.setData({
        adRewardAvailable: false,
      });
      return;
    }

    const adUnitId = this.getRewardAdUnitId();

    if (this.rewardedVideoAd && this.rewardedVideoAdUnitId === adUnitId) {
      this.setData({
        adRewardAvailable: true,
      });
      return;
    }

    this.destroyRewardedVideoAd();

    try {
      const rewardedVideoAd = wx.createRewardedVideoAd({
        adUnitId: adUnitId,
      });

      rewardedVideoAd.onLoad(this.handleAdLoadBound);
      rewardedVideoAd.onError(this.handleAdErrorBound);
      rewardedVideoAd.onClose(this.handleAdCloseBound);

      this.rewardedVideoAd = rewardedVideoAd;
      this.rewardedVideoAdUnitId = adUnitId;

      this.setData({
        adRewardAvailable: true,
      });
    } catch (error) {
      console.warn('[profile] createRewardedVideoAd failed', {
        message: error && error.message ? error.message : '',
      });
      this.setData({
        adRewardAvailable: false,
      });
    }
  },

  destroyRewardedVideoAd() {
    if (!this.rewardedVideoAd) {
      return;
    }

    if (typeof this.rewardedVideoAd.offLoad === 'function') {
      this.rewardedVideoAd.offLoad(this.handleAdLoadBound);
    }

    if (typeof this.rewardedVideoAd.offError === 'function') {
      this.rewardedVideoAd.offError(this.handleAdErrorBound);
    }

    if (typeof this.rewardedVideoAd.offClose === 'function') {
      this.rewardedVideoAd.offClose(this.handleAdCloseBound);
    }

    this.rewardedVideoAd = null;
    this.rewardedVideoAdUnitId = '';
    this.rewardCloseHandled = false;
    this.pendingRewardContext = null;
  },

  handleRewardedVideoAdLoad() {
    this.setData({
      adRewardAvailable: true,
    });
  },

  handleRewardedVideoAdError(error) {
    console.warn('[profile] rewardedVideoAd error', {
      errCode: error && error.errCode ? error.errCode : '',
      errMsg: error && error.errMsg ? error.errMsg : '',
    });

    this.pendingRewardContext = null;
    this.rewardCloseHandled = false;

    this.setData({
      adRewardButtonLoading: false,
    });

    wx.showToast({
      title: '广告暂时不可用，请稍后再试',
      icon: 'none',
    });
  },

  async handleRewardedVideoAdClose(result) {
    if (!this.pendingRewardContext || this.rewardCloseHandled) {
      return;
    }

    this.rewardCloseHandled = true;

    const rewardContext = this.pendingRewardContext;
    this.pendingRewardContext = null;

    if (!result || result.isEnded !== true) {
      this.setData({
        adRewardButtonLoading: false,
      });

      wx.showToast({
        title: '完整看完视频后才能获得放大镜',
        icon: 'none',
      });
      return;
    }

    try {
      const rewardStatus = await userService.claimAdReward({
        rewardRequestId: rewardContext.rewardRequestId,
        adUnitId: rewardContext.adUnitId,
      });

      this.setData({
        magnifyingGlass: rewardStatus.magnifyingGlass || 0,
        adRewardDailyCount: rewardStatus.todayRewardCount || 0,
        adRewardDailyLimit: rewardStatus.dailyRewardLimit || AD_REWARD_DEFAULT_LIMIT,
        adRewardButtonLoading: false,
      });

      wx.showToast({
        title: rewardStatus.duplicate ? '奖励已到账，请勿重复领取' : '已获得 1 枚放大镜',
        icon: 'none',
      });
    } catch (error) {
      console.warn('[profile] claimAdReward failed', {
        code: error && error.code ? error.code : 'INTERNAL_ERROR',
        message: error && error.message ? error.message : '',
      });

      this.setData({
        adRewardButtonLoading: false,
      });

      wx.showToast({
        title: getRewardAdUserMessage(error),
        icon: 'none',
      });

      this.loadAdRewardStatus();
      this.loadProfileAsset();
    }
  },

  async loadFavoriteCount() {
    try {
      const favorites = await favoriteService.getFavorites(favoriteService.TEST_USER_ID);

      this.setData({
        favoriteCount: favorites.length,
      });
    } catch (error) {
      console.warn('Failed to load favorite count:', error);
      this.setData({
        favoriteCount: 0,
      });
    }
  },

  async loadProfileAsset() {
    try {
      const profile = await userService.getCurrentUserProfile();

      this.setData({
        magnifyingGlass: profile.magnifyingGlass || 0,
      });
    } catch (error) {
      console.warn('Failed to load profile asset:', error);
      this.setData({
        magnifyingGlass: 0,
      });
    }
  },

  async loadMyStoryCount() {
    try {
      const stories = await storyService.getMyStories();

      this.setData({
        myStoryCount: stories.length,
      });
    } catch (error) {
      console.warn('Failed to load my story count:', error);
      this.setData({
        myStoryCount: 0,
      });
    }
  },

  async loadAdRewardStatus() {
    if (!this.isRewardAdFeatureAvailable()) {
      this.setData({
        adRewardAvailable: false,
        adRewardLoading: false,
        adRewardButtonLoading: false,
        adRewardDailyCount: 0,
        adRewardDailyLimit: AD_REWARD_DEFAULT_LIMIT,
      });
      return;
    }

    this.setData({
      adRewardAvailable: true,
      adRewardLoading: true,
    });

    try {
      const rewardStatus = await userService.getAdRewardStatus();

      this.setData({
        magnifyingGlass: rewardStatus.magnifyingGlass || 0,
        adRewardDailyCount: rewardStatus.todayRewardCount || 0,
        adRewardDailyLimit: rewardStatus.dailyRewardLimit || AD_REWARD_DEFAULT_LIMIT,
        adRewardLoading: false,
      });
    } catch (error) {
      console.warn('[profile] loadAdRewardStatus failed', {
        code: error && error.code ? error.code : 'INTERNAL_ERROR',
        message: error && error.message ? error.message : '',
      });

      this.setData({
        adRewardAvailable: false,
        adRewardLoading: false,
      });
    }
  },

  async loadDevTestToolAccess() {
    const envVersion = getMiniProgramEnvVersion();

    this.setData({
      devTestToolsVisible: isDevTestToolEnv(envVersion),
      devTestToolsChecking: false,
      devTestToolsEnvVersion: envVersion,
    });
  },

  async handleWatchAdTap() {
    if (!this.isRewardAdFeatureAvailable() || !this.rewardedVideoAd || this.data.adRewardButtonLoading) {
      return;
    }

    if (this.data.adRewardDailyCount >= this.data.adRewardDailyLimit) {
      wx.showToast({
        title: '今日广告奖励已用完',
        icon: 'none',
      });
      return;
    }

    const rewardRequestId = createRewardRequestId();
    const adUnitId = this.getRewardAdUnitId();

    this.pendingRewardContext = {
      rewardRequestId: rewardRequestId,
      adUnitId: adUnitId,
    };
    this.rewardCloseHandled = false;

    this.setData({
      adRewardButtonLoading: true,
    });

    try {
      await this.rewardedVideoAd.show();
    } catch (showError) {
      try {
        await this.rewardedVideoAd.load();
        await this.rewardedVideoAd.show();
      } catch (error) {
        console.warn('[profile] rewardedVideoAd show failed', {
          message: error && error.message ? error.message : '',
        });

        this.pendingRewardContext = null;
        this.rewardCloseHandled = false;
        this.setData({
          adRewardButtonLoading: false,
        });

        wx.showToast({
          title: '广告暂时不可用，请稍后再试',
          icon: 'none',
        });
      }
    }
  },

  handleMenuTap(event) {
    const route = event.currentTarget.dataset.route;

    if (route) {
      if (isTabPageRoute(route)) {
        wx.switchTab({
          url: route,
        });
      } else {
        wx.navigateTo({
          url: route,
        });
      }
      return;
    }

    wx.showToast({
      title: '功能准备中',
      icon: 'none',
    });
  },

  openDevTestTools() {
    wx.navigateTo({
      url: '/pages/devTestTools/devTestTools',
    });
  },
});
