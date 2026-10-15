function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLocationResult(interfaceName, result) {
  if (!isPlainObject(result)) {
    return {
      name: '',
      address: '',
      city: '',
      latitude: '',
      longitude: '',
      type: '',
    };
  }

  return {
    name: result.name || '',
    address: result.address || '',
    city: result.city || '',
    latitude: typeof result.latitude === 'number' ? result.latitude : '',
    longitude: typeof result.longitude === 'number' ? result.longitude : '',
    type: result.type || (interfaceName === 'wx.chooseLocation' ? '' : ''),
  };
}

function detectPermissionHint(error) {
  const errMsg = error && error.errMsg ? String(error.errMsg) : '';
  const detail = safeStringify(error);
  const combined = (errMsg + ' ' + detail).toLowerCase();

  return (
    combined.indexOf('auth deny') !== -1 ||
    combined.indexOf('authorize') !== -1 ||
    combined.indexOf('permission') !== -1 ||
    combined.indexOf('privacy') !== -1 ||
    combined.indexOf('requiredprivateinfos') !== -1 ||
    combined.indexOf('need to be declared') !== -1 ||
    combined.indexOf('112') !== -1 ||
    combined.indexOf('110') !== -1
  );
}

function getSdkVersion() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    return systemInfo.SDKVersion || '';
  } catch (error) {
    return '';
  }
}

function getCanIUseResult(apiName) {
  try {
    return !!wx.canIUse(apiName);
  } catch (error) {
    return false;
  }
}

function buildSupportSnapshot() {
  return {
    sdkVersion: getSdkVersion(),
    canIUseChoosePoi: getCanIUseResult('choosePoi'),
    canIUseChooseLocation: getCanIUseResult('chooseLocation'),
    choosePoiType: typeof wx.choosePoi,
    chooseLocationType: typeof wx.chooseLocation,
  };
}

Page({
  data: {
    pageLoadMessage: '',
    sdkVersion: '',
    canIUseChoosePoi: false,
    canIUseChooseLocation: false,
    choosePoiType: '',
    chooseLocationType: '',
    currentInterfaceName: '',
    loading: false,
    resultStatus: '',
    lastActionMessage: '',
    completeMessage: '',
    rawSuccessResult: '',
    normalizedResult: null,
    rawErrorResult: '',
    likelyPermissionIssue: false,
    likelyPrivacyConfigIssue: false,
    clickLocked: false,
  },

  onLoad() {
    const supportSnapshot = buildSupportSnapshot();

    this.setData({
      pageLoadMessage: '原生地点接口测试页已加载',
      sdkVersion: supportSnapshot.sdkVersion || '未知',
      canIUseChoosePoi: supportSnapshot.canIUseChoosePoi,
      canIUseChooseLocation: supportSnapshot.canIUseChooseLocation,
      choosePoiType: supportSnapshot.choosePoiType,
      chooseLocationType: supportSnapshot.chooseLocationType,
      lastActionMessage: '等待点击测试按钮',
      completeMessage: '',
    });

    wx.showToast({
      title: '测试页已加载',
      icon: 'none',
    });
  },

  onUnload() {
    this.clearPendingTimeout();
    wx.hideLoading();
  },

  resetResultState(interfaceName) {
    this.clearPendingTimeout();

    this.setData({
      currentInterfaceName: interfaceName,
      loading: true,
      resultStatus: 'pending',
      lastActionMessage: '已点击，正在调用……',
      completeMessage: '等待 complete 回调',
      rawSuccessResult: '',
      normalizedResult: null,
      rawErrorResult: '',
      likelyPermissionIssue: false,
      likelyPrivacyConfigIssue: false,
      clickLocked: true,
    });

    wx.showLoading({
      title: '正在调用',
      mask: true,
    });

    this.pendingTimeoutId = setTimeout(() => {
      this.handleSilentTimeout(interfaceName);
    }, 8000);
  },

  handleSuccess(interfaceName, result) {
    this.clearPendingTimeout();

    this.setData({
      currentInterfaceName: interfaceName,
      loading: false,
      resultStatus: 'success',
      lastActionMessage: '接口调用成功',
      rawSuccessResult: safeStringify(result),
      normalizedResult: normalizeLocationResult(interfaceName, result),
      rawErrorResult: '',
      likelyPermissionIssue: false,
      likelyPrivacyConfigIssue: false,
      clickLocked: false,
    });

    wx.hideLoading();
    wx.showToast({
      title: '调用成功',
      icon: 'success',
    });
  },

  handleFail(interfaceName, error) {
    const supportSnapshot = buildSupportSnapshot();
    const likelyPermissionIssue = detectPermissionHint(error);
    const likelyPrivacyConfigIssue = likelyPermissionIssue;
    const diagnostics = {
      interfaceName: interfaceName,
      sdkVersion: supportSnapshot.sdkVersion || '',
      canIUse: interfaceName === 'wx.choosePoi' ? supportSnapshot.canIUseChoosePoi : supportSnapshot.canIUseChooseLocation,
      typeofApi: interfaceName === 'wx.choosePoi' ? supportSnapshot.choosePoiType : supportSnapshot.chooseLocationType,
      errMsg: error && error.errMsg ? error.errMsg : '',
      error: error,
      likelyPermissionIssue: likelyPermissionIssue,
      likelyPrivacyConfigIssue: likelyPrivacyConfigIssue,
    };

    this.clearPendingTimeout();

    this.setData({
      currentInterfaceName: interfaceName,
      loading: false,
      resultStatus: 'fail',
      lastActionMessage: '接口调用失败',
      completeMessage: '',
      rawSuccessResult: '',
      normalizedResult: null,
      rawErrorResult: safeStringify(diagnostics),
      likelyPermissionIssue: likelyPermissionIssue,
      likelyPrivacyConfigIssue: likelyPrivacyConfigIssue,
      sdkVersion: supportSnapshot.sdkVersion || '未知',
      canIUseChoosePoi: supportSnapshot.canIUseChoosePoi,
      canIUseChooseLocation: supportSnapshot.canIUseChooseLocation,
      choosePoiType: supportSnapshot.choosePoiType,
      chooseLocationType: supportSnapshot.chooseLocationType,
      clickLocked: false,
    });

    wx.hideLoading();
    wx.showModal({
      title: '地点接口调用失败',
      content: (error && error.errMsg) || '未返回明确 errMsg，请查看页面完整错误信息。',
      showCancel: false,
    });
  },

  handleComplete(interfaceName, payload) {
    this.clearPendingTimeout();

    this.setData({
      currentInterfaceName: interfaceName,
      completeMessage: 'complete 已触发：' + safeStringify(payload),
      clickLocked: false,
    });

    wx.hideLoading();
  },

  handleSilentTimeout(interfaceName) {
    const timeoutError = {
      errMsg: interfaceName + ':fail no callback received within timeout window',
    };

    this.handleFail(interfaceName, timeoutError);
  },

  clearPendingTimeout() {
    if (this.pendingTimeoutId) {
      clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = null;
    }
  },

  buildUnsupportedError(interfaceName, apiName) {
    const supportSnapshot = buildSupportSnapshot();
    const canIUseResult = apiName === 'choosePoi'
      ? supportSnapshot.canIUseChoosePoi
      : supportSnapshot.canIUseChooseLocation;
    const apiType = apiName === 'choosePoi'
      ? supportSnapshot.choosePoiType
      : supportSnapshot.chooseLocationType;

    return {
      errMsg: interfaceName + ':fail current runtime does not support this API',
      interfaceName: interfaceName,
      apiName: apiName,
      sdkVersion: supportSnapshot.sdkVersion || '',
      canIUse: canIUseResult,
      typeofApi: apiType,
    };
  },

  callChoosePoi() {
    const interfaceName = 'wx.choosePoi';

    if (typeof wx.choosePoi !== 'function' || !getCanIUseResult('choosePoi')) {
      this.handleFail(interfaceName, this.buildUnsupportedError(interfaceName, 'choosePoi'));
      return;
    }

    wx.choosePoi({
      success: (result) => {
        this.handleSuccess(interfaceName, result);
      },
      fail: (error) => {
        this.handleFail(interfaceName, error);
      },
      complete: (payload) => {
        this.handleComplete(interfaceName, payload);
      },
    });
  },

  callChooseLocation() {
    const interfaceName = 'wx.chooseLocation';

    if (typeof wx.chooseLocation !== 'function' || !getCanIUseResult('chooseLocation')) {
      this.handleFail(interfaceName, this.buildUnsupportedError(interfaceName, 'chooseLocation'));
      return;
    }

    wx.chooseLocation({
      success: (result) => {
        this.handleSuccess(interfaceName, result);
      },
      fail: (error) => {
        this.handleFail(interfaceName, error);
      },
      complete: (payload) => {
        this.handleComplete(interfaceName, payload);
      },
    });
  },

  testChoosePoi() {
    const interfaceName = 'wx.choosePoi';

    if (this.data.clickLocked) {
      wx.showToast({
        title: '接口调用中，请稍候',
        icon: 'none',
      });
      return;
    }

    this.resetResultState(interfaceName);

    try {
      this.callChoosePoi();
    } catch (error) {
      this.handleFail(interfaceName, {
        errMsg: interfaceName + ':fail sync exception',
        error: {
          name: error && error.name ? error.name : 'Error',
          message: error && error.message ? error.message : String(error),
          stack: error && error.stack ? error.stack : '',
        },
      });
    }
  },

  testChooseLocation() {
    const interfaceName = 'wx.chooseLocation';

    if (this.data.clickLocked) {
      wx.showToast({
        title: '接口调用中，请稍候',
        icon: 'none',
      });
      return;
    }

    this.resetResultState(interfaceName);

    try {
      this.callChooseLocation();
    } catch (error) {
      this.handleFail(interfaceName, {
        errMsg: interfaceName + ':fail sync exception',
        error: {
          name: error && error.name ? error.name : 'Error',
          message: error && error.message ? error.message : String(error),
          stack: error && error.stack ? error.stack : '',
        },
      });
    }
  },
});
