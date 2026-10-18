const userService = require('../../services/userService');

const DEV_TEST_TOOL_ALLOWED_ENVS = {
  develop: true,
  trial: true,
};
const DEV_TEST_TOKEN_STORAGE_KEY = 'dev_test_admin_token';
const STORY_TYPE_OPTIONS = ['民间传说', 'AI说'];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
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
    return 'release';
  }
}

function isDevToolEnv(envVersion) {
  return !!DEV_TEST_TOOL_ALLOWED_ENVS[trimString(envVersion)];
}

function parseInputInteger(value, fieldName, maxValue) {
  const normalizedValue = trimString(value);

  if (!normalizedValue) {
    throw new Error(fieldName + ' 不能为空');
  }

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue) || numericValue < 0 || Math.floor(numericValue) !== numericValue) {
    throw new Error(fieldName + ' 必须是非负整数');
  }

  if (typeof maxValue === 'number' && numericValue > maxValue) {
    throw new Error(fieldName + ' 超出允许范围');
  }

  return numericValue;
}

function getUserFacingErrorMessage(error) {
  const code = error && error.code ? String(error.code) : '';
  const message = error && error.message ? String(error.message) : '';

  if (code === 'DEV_TOOLS_DISABLED') {
    return '开发测试工具未开启';
  }

  if (code === 'DEV_TOOLS_FORBIDDEN') {
    return '开发测试工具口令不正确';
  }

  if (code === 'DEPLOY_REQUIRED') {
    return '开发测试工具云函数尚未部署';
  }

  if (code === 'LOCAL_ONLY') {
    return '开发测试工具仅支持云环境调用';
  }

  if (code === 'UNAUTHORIZED') {
    return '当前用户身份读取失败，请稍后再试';
  }

  if (code === 'INVALID_INPUT') {
    return message || '请输入开发测试口令';
  }

  return message || '操作失败，请稍后再试';
}

function buildDefaultState() {
  return {
    magnifyingGlass: 0,
    dailyTotalCount: 0,
    locationTypeCount: 0,
    requestLockUntil: 0,
    activeLocationKey: '',
    activeStoryType: '',
    hasRequestLock: false,
  };
}

function getStoredDevTestToken() {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') {
    return '';
  }

  try {
    return trimString(wx.getStorageSync(DEV_TEST_TOKEN_STORAGE_KEY));
  } catch (error) {
    return '';
  }
}

function setStoredDevTestToken(token) {
  if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return;
  }

  wx.setStorageSync(DEV_TEST_TOKEN_STORAGE_KEY, token);
}

function clearStoredDevTestToken() {
  if (typeof wx === 'undefined') {
    return;
  }

  if (typeof wx.removeStorageSync === 'function') {
    wx.removeStorageSync(DEV_TEST_TOKEN_STORAGE_KEY);
    return;
  }

  if (typeof wx.setStorageSync === 'function') {
    wx.setStorageSync(DEV_TEST_TOKEN_STORAGE_KEY, '');
  }
}

Page({
  data: {
    envVersion: 'release',
    envAllowed: false,
    accessGranted: false,
    loading: true,
    submitting: false,
    blockedMessage: '',
    tokenStatusText: '尚未验证开发测试口令',
    tokenStatusType: 'idle',
    hasStoredToken: false,
    devTestToken: '',
    state: buildDefaultState(),
    locationKey: '',
    storyTypeIndex: 0,
    customMagnifyingGlass: '',
    customDailyTotalCount: '',
    customLocationTypeCount: '',
    resetMagnifyingGlass: '5',
    storyTypeOptions: STORY_TYPE_OPTIONS,
  },

  onLoad() {
    this.initializePage();
  },

  onShow() {
    if (this.data.accessGranted) {
      this.refreshState({
        silent: true,
      });
    }
  },

  async initializePage() {
    const envVersion = getMiniProgramEnvVersion();
    const envAllowed = isDevToolEnv(envVersion);
    const storedToken = envAllowed ? getStoredDevTestToken() : '';

    this.setData({
      envVersion: envVersion,
      envAllowed: envAllowed,
      loading: true,
      accessGranted: false,
      devTestToken: storedToken,
      hasStoredToken: !!storedToken,
      blockedMessage: envAllowed ? '' : '开发测试工具仅在 develop / trial 版本显示，release 环境不会提供入口。',
      tokenStatusText: envAllowed
        ? (storedToken ? '已读取本地测试口令，正在验证...' : '请输入开发测试口令后验证')
        : '当前环境不可使用开发测试工具',
      tokenStatusType: envAllowed
        ? (storedToken ? 'pending' : 'idle')
        : 'blocked',
      state: buildDefaultState(),
    });

    if (!envAllowed) {
      this.setData({
        loading: false,
      });
      return;
    }

    if (!storedToken) {
      this.setData({
        loading: false,
      });
      return;
    }

    await this.verifyAndEnter({
      devTestToken: storedToken,
      persistToken: false,
      silentError: true,
      clearStoredTokenOnFailure: true,
      loadingMode: true,
    });
  },

  buildSelectorPayload(required) {
    const locationKey = trimString(this.data.locationKey);
    const storyType = this.getSelectedStoryType();

    if (!locationKey) {
      if (required) {
        throw new Error('locationKey 不能为空');
      }

      return null;
    }

    return {
      locationKey: locationKey,
      storyType: storyType,
    };
  },

  buildAuthorizedPayload(extraPayload) {
    const devTestToken = trimString(this.data.devTestToken);

    if (!devTestToken) {
      throw new Error('请输入开发测试口令');
    }

    return Object.assign({
      devTestToken: devTestToken,
    }, extraPayload || {});
  },

  getSelectedStoryType() {
    return this.data.storyTypeOptions[this.data.storyTypeIndex] || STORY_TYPE_OPTIONS[0];
  },

  async verifyAndEnter(options) {
    const verifyOptions = options || {};
    const devTestToken = trimString(
      typeof verifyOptions.devTestToken === 'string'
        ? verifyOptions.devTestToken
        : this.data.devTestToken
    );

    if (!this.data.envAllowed) {
      this.setData({
        loading: false,
      });
      return false;
    }

    if (!devTestToken) {
      this.setData({
        accessGranted: false,
        loading: false,
        hasStoredToken: !!getStoredDevTestToken(),
        tokenStatusText: '请输入开发测试口令后验证',
        tokenStatusType: 'idle',
      });
      return false;
    }

    this.setData({
      devTestToken: devTestToken,
      loading: !!verifyOptions.loadingMode,
      submitting: !verifyOptions.loadingMode,
      tokenStatusText: '正在验证开发测试口令...',
      tokenStatusType: 'pending',
    });

    try {
      const state = await userService.getDevTestState({
        devTestToken: devTestToken,
      });

      if (verifyOptions.persistToken !== false) {
        setStoredDevTestToken(devTestToken);
      }

      this.setData({
        accessGranted: true,
        loading: false,
        submitting: false,
        state: state,
        hasStoredToken: true,
        blockedMessage: '',
        tokenStatusText: '开发测试口令已验证',
        tokenStatusType: 'success',
      });

      return true;
    } catch (error) {
      if (verifyOptions.clearStoredTokenOnFailure) {
        clearStoredDevTestToken();
      }

      this.setData({
        accessGranted: false,
        loading: false,
        submitting: false,
        hasStoredToken: !!getStoredDevTestToken(),
        tokenStatusText: getUserFacingErrorMessage(error),
        tokenStatusType: 'error',
        state: buildDefaultState(),
      });

      if (!verifyOptions.silentError) {
        wx.showToast({
          title: getUserFacingErrorMessage(error),
          icon: 'none',
        });
      }

      return false;
    }
  },

  async refreshState(options) {
    const refreshOptions = options || {};

    if (!this.data.envAllowed || !this.data.accessGranted) {
      return;
    }

    this.setData({
      loading: refreshOptions.silent ? this.data.loading : true,
    });

    try {
      const selector = this.buildSelectorPayload(false);
      const state = await userService.getDevTestState(this.buildAuthorizedPayload(selector));

      this.setData({
        state: state,
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
      });

      if (!refreshOptions.silent) {
        wx.showToast({
          title: getUserFacingErrorMessage(error),
          icon: 'none',
        });
      }
    }
  },

  async runMutation(executor, successTitle) {
    if (!this.data.accessGranted || this.data.submitting) {
      return;
    }

    this.setData({
      submitting: true,
    });

    try {
      const state = await executor();

      this.setData({
        state: state,
        submitting: false,
      });

      this.notifyPagesToRefresh();

      wx.showToast({
        title: successTitle,
        icon: 'none',
      });
    } catch (error) {
      this.setData({
        submitting: false,
      });

      wx.showToast({
        title: getUserFacingErrorMessage(error),
        icon: 'none',
      });
    }
  },

  notifyPagesToRefresh() {
    const app = getApp();

    if (app && app.globalData) {
      app.globalData.devTestToolsUpdatedAt = Date.now();
    }

    if (typeof getCurrentPages !== 'function') {
      return;
    }

    const pages = getCurrentPages();

    pages.forEach(function refreshPage(page) {
      if (!page) {
        return;
      }

      if (typeof page.loadProfileAsset === 'function') {
        page.loadProfileAsset();
      }

      if (typeof page.loadAdRewardStatus === 'function') {
        page.loadAdRewardStatus();
      }

      if (typeof page.loadMagnifyingGlassCount === 'function') {
        page.loadMagnifyingGlassCount();
      }
    });
  },

  handleDevTestTokenInput(event) {
    this.setData({
      devTestToken: trimString(event && event.detail ? event.detail.value : ''),
      tokenStatusText: '尚未验证开发测试口令',
      tokenStatusType: 'idle',
    });
  },

  handleVerifyTokenTap() {
    this.verifyAndEnter({
      persistToken: true,
      silentError: false,
      clearStoredTokenOnFailure: false,
      loadingMode: false,
    });
  },

  handleClearLocalDevTestToken() {
    clearStoredDevTestToken();

    this.setData({
      accessGranted: false,
      devTestToken: '',
      hasStoredToken: false,
      loading: false,
      submitting: false,
      state: buildDefaultState(),
      tokenStatusText: '本地测试口令已清除，请重新输入',
      tokenStatusType: 'idle',
    });

    wx.showToast({
      title: '本地测试口令已清除',
      icon: 'none',
    });
  },

  handleLocationKeyInput(event) {
    this.setData({
      locationKey: trimString(event && event.detail ? event.detail.value : ''),
    });
  },

  handleStoryTypeChange(event) {
    const nextIndex = Number(event && event.detail ? event.detail.value : 0);

    this.setData({
      storyTypeIndex: Number.isFinite(nextIndex) ? nextIndex : 0,
    });

    this.refreshState({
      silent: true,
    });
  },

  handleCustomMagnifyingGlassInput(event) {
    this.setData({
      customMagnifyingGlass: trimString(event && event.detail ? event.detail.value : ''),
    });
  },

  handleCustomDailyTotalCountInput(event) {
    this.setData({
      customDailyTotalCount: trimString(event && event.detail ? event.detail.value : ''),
    });
  },

  handleCustomLocationTypeCountInput(event) {
    this.setData({
      customLocationTypeCount: trimString(event && event.detail ? event.detail.value : ''),
    });
  },

  handleResetMagnifyingGlassInput(event) {
    this.setData({
      resetMagnifyingGlass: trimString(event && event.detail ? event.detail.value : ''),
    });
  },

  handleRefreshTap() {
    this.refreshState();
  },

  handleRefreshSelectorTap() {
    this.refreshState();
  },

  handleSetMagnifyingGlassPreset(event) {
    const value = parseInputInteger(event.currentTarget.dataset.value, 'magnifyingGlass');

    this.runMutation(() => userService.setDevTestMagnifyingGlass(this.buildAuthorizedPayload({
      magnifyingGlass: value,
    })), '放大镜余额已更新');
  },

  handleSetMagnifyingGlassCustom() {
    let value = 0;

    try {
      value = parseInputInteger(this.data.customMagnifyingGlass, 'magnifyingGlass');
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: 'none',
      });
      return;
    }

    this.runMutation(() => userService.setDevTestMagnifyingGlass(this.buildAuthorizedPayload({
      magnifyingGlass: value,
    })), '放大镜余额已更新');
  },

  handleSetDailyTotalPreset(event) {
    const value = parseInputInteger(event.currentTarget.dataset.value, 'dailyTotalCount', 10);

    this.runMutation(() => userService.setDevTestDailyTotalCount(this.buildAuthorizedPayload({
      dailyTotalCount: value,
    })), '今日次数已更新');
  },

  handleSetDailyTotalCustom() {
    let value = 0;

    try {
      value = parseInputInteger(this.data.customDailyTotalCount, 'dailyTotalCount', 10);
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: 'none',
      });
      return;
    }

    this.runMutation(() => userService.setDevTestDailyTotalCount(this.buildAuthorizedPayload({
      dailyTotalCount: value,
    })), '今日次数已更新');
  },

  handleSetLocationTypePreset(event) {
    let selector = null;
    let value = 0;

    try {
      selector = this.buildSelectorPayload(true);
      value = parseInputInteger(event.currentTarget.dataset.value, 'locationTypeCount', 3);
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: 'none',
      });
      return;
    }

    this.runMutation(() => userService.setDevTestLocationTypeCount(this.buildAuthorizedPayload({
      locationKey: selector.locationKey,
      storyType: selector.storyType,
      locationTypeCount: value,
    })), '地点标签次数已更新');
  },

  handleSetLocationTypeCustom() {
    let selector = null;
    let value = 0;

    try {
      selector = this.buildSelectorPayload(true);
      value = parseInputInteger(this.data.customLocationTypeCount, 'locationTypeCount', 3);
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: 'none',
      });
      return;
    }

    this.runMutation(() => userService.setDevTestLocationTypeCount(this.buildAuthorizedPayload({
      locationKey: selector.locationKey,
      storyType: selector.storyType,
      locationTypeCount: value,
    })), '地点标签次数已更新');
  },

  handleClearAllLocationTypeCounts() {
    this.runMutation(() => userService.clearDevTestLocationTypeCounts(this.buildAuthorizedPayload()), '地点标签次数已清空');
  },

  handleClearSingleLocationTypeCount() {
    let selector = null;

    try {
      selector = this.buildSelectorPayload(true);
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: 'none',
      });
      return;
    }

    this.runMutation(() => userService.clearDevTestLocationTypeCount(this.buildAuthorizedPayload({
      locationKey: selector.locationKey,
      storyType: selector.storyType,
    })), '指定地点标签次数已清空');
  },

  handleClearRequestLock() {
    this.runMutation(() => userService.clearDevTestRequestLock(this.buildAuthorizedPayload()), '请求锁已清除');
  },

  handleResetTodayState() {
    let value = 0;

    try {
      value = parseInputInteger(this.data.resetMagnifyingGlass, 'magnifyingGlass');
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: 'none',
      });
      return;
    }

    this.runMutation(() => userService.resetDevTestTodayState(this.buildAuthorizedPayload({
      magnifyingGlass: value,
    })), '今日测试状态已重置');
  },
});
