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

function formatRawValue(value) {
  if (typeof value === 'undefined') {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (value === '') {
    return '空字符串';
  }

  return String(value);
}

function normalizeCoordinate(rawValue) {
  const hasNoValue = typeof rawValue === 'undefined' || rawValue === null || rawValue === '';

  if (hasNoValue) {
    return {
      rawValue: rawValue,
      rawDisplay: formatRawValue(rawValue),
      value: null,
      display: '未返回',
      hasValidCoordinate: false,
      invalidReason: 'missing',
    };
  }

  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue)) {
    return {
      rawValue: rawValue,
      rawDisplay: formatRawValue(rawValue),
      value: null,
      display: '未返回',
      hasValidCoordinate: false,
      invalidReason: 'nan',
    };
  }

  return {
    rawValue: rawValue,
    rawDisplay: formatRawValue(rawValue),
    value: numericValue,
    display: String(numericValue),
    hasValidCoordinate: true,
    invalidReason: '',
  };
}

function normalizeLocationResult(interfaceName, result) {
  if (!isPlainObject(result)) {
    return {
      name: '',
      address: '',
      city: '',
      latitudeDisplay: '未返回',
      longitudeDisplay: '未返回',
      rawLatitude: 'undefined',
      rawLongitude: 'undefined',
      type: '',
      coordinateMessage: '微信接口本次未返回有效经纬度',
    };
  }

  const normalizedLatitude = normalizeCoordinate(result.latitude);
  const normalizedLongitude = normalizeCoordinate(result.longitude);
  const bothCoordinatesReturned = normalizedLatitude.hasValidCoordinate && normalizedLongitude.hasValidCoordinate;
  const bothZeroCoordinates = bothCoordinatesReturned && normalizedLatitude.value === 0 && normalizedLongitude.value === 0;
  const hasValidCoordinates = bothCoordinatesReturned && !bothZeroCoordinates;

  return {
    name: result.name || '',
    address: result.address || '',
    city: result.city || '',
    latitude: hasValidCoordinates ? normalizedLatitude.value : null,
    longitude: hasValidCoordinates ? normalizedLongitude.value : null,
    latitudeDisplay: hasValidCoordinates ? normalizedLatitude.display : '未返回',
    longitudeDisplay: hasValidCoordinates ? normalizedLongitude.display : '未返回',
    rawLatitude: normalizedLatitude.rawDisplay,
    rawLongitude: normalizedLongitude.rawDisplay,
    type: result.type || (interfaceName === 'wx.chooseLocation' ? '' : ''),
    coordinateMessage: hasValidCoordinates ? '' : '微信接口本次未返回有效经纬度',
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

function isCancelError(error) {
  const errMsg = error && error.errMsg ? String(error.errMsg).toLowerCase() : '';

  return errMsg.indexOf(':fail cancel') !== -1;
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
    rawCancelResult: '',
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
    wx.hideLoading();
  },

  resetResultState(interfaceName) {
    this.currentRequestId = (this.currentRequestId || 0) + 1;

    this.setData({
      currentInterfaceName: interfaceName,
      loading: true,
      resultStatus: '调用中',
      lastActionMessage: '已点击，正在调用……',
      completeMessage: '等待 complete 回调',
      rawSuccessResult: '',
      rawCancelResult: '',
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

    return this.currentRequestId;
  },

  isStaleRequest(requestId) {
    return requestId !== this.currentRequestId;
  },

  finishRequest(requestId, completeMessage) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    this.setData({
      loading: false,
      clickLocked: false,
      completeMessage: completeMessage || this.data.completeMessage,
    });

    wx.hideLoading();
  },

  handleSuccess(interfaceName, result, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    this.setData({
      currentInterfaceName: interfaceName,
      resultStatus: '选择成功',
      lastActionMessage: '选择成功',
      rawSuccessResult: safeStringify(result),
      rawCancelResult: '',
      normalizedResult: normalizeLocationResult(interfaceName, result),
      rawErrorResult: '',
      likelyPermissionIssue: false,
      likelyPrivacyConfigIssue: false,
    });

    wx.showToast({
      title: '选择成功',
      icon: 'success',
    });
  },

  handleCancel(interfaceName, error, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    this.setData({
      currentInterfaceName: interfaceName,
      resultStatus: '已取消选择',
      lastActionMessage: '已取消选择',
      rawCancelResult: safeStringify({
        interfaceName: interfaceName,
        errMsg: error && error.errMsg ? error.errMsg : '',
        error: error,
      }),
      rawErrorResult: '',
      likelyPermissionIssue: false,
      likelyPrivacyConfigIssue: false,
    });

    wx.showToast({
      title: '已取消',
      icon: 'none',
    });
  },

  handleFail(interfaceName, error, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

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

    this.setData({
      currentInterfaceName: interfaceName,
      resultStatus: '调用失败',
      lastActionMessage: '接口调用失败',
      rawSuccessResult: '',
      rawCancelResult: '',
      normalizedResult: null,
      rawErrorResult: safeStringify(diagnostics),
      likelyPermissionIssue: likelyPermissionIssue,
      likelyPrivacyConfigIssue: likelyPrivacyConfigIssue,
      sdkVersion: supportSnapshot.sdkVersion || '未知',
      canIUseChoosePoi: supportSnapshot.canIUseChoosePoi,
      canIUseChooseLocation: supportSnapshot.canIUseChooseLocation,
      choosePoiType: supportSnapshot.choosePoiType,
      chooseLocationType: supportSnapshot.chooseLocationType,
    });

    wx.showModal({
      title: '地点接口调用失败',
      content: (error && error.errMsg) || '未返回明确 errMsg，请查看页面完整错误信息。',
      showCancel: false,
    });
  },

  handleComplete(interfaceName, payload, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    this.finishRequest(requestId, 'complete 已触发：' + safeStringify(payload));
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

  callChoosePoi(requestId) {
    const interfaceName = 'wx.choosePoi';

    if (typeof wx.choosePoi !== 'function' || !getCanIUseResult('choosePoi')) {
      this.handleFail(interfaceName, this.buildUnsupportedError(interfaceName, 'choosePoi'), requestId);
      this.finishRequest(requestId, '未进入原生界面');
      return;
    }

    wx.choosePoi({
      success: (result) => {
        this.handleSuccess(interfaceName, result, requestId);
      },
      fail: (error) => {
        if (isCancelError(error)) {
          this.handleCancel(interfaceName, error, requestId);
          return;
        }

        this.handleFail(interfaceName, error, requestId);
      },
      complete: (payload) => {
        this.handleComplete(interfaceName, payload, requestId);
      },
    });
  },

  callChooseLocation(requestId) {
    const interfaceName = 'wx.chooseLocation';

    if (typeof wx.chooseLocation !== 'function' || !getCanIUseResult('chooseLocation')) {
      this.handleFail(interfaceName, this.buildUnsupportedError(interfaceName, 'chooseLocation'), requestId);
      this.finishRequest(requestId, '未进入原生界面');
      return;
    }

    wx.chooseLocation({
      success: (result) => {
        this.handleSuccess(interfaceName, result, requestId);
      },
      fail: (error) => {
        if (isCancelError(error)) {
          this.handleCancel(interfaceName, error, requestId);
          return;
        }

        this.handleFail(interfaceName, error, requestId);
      },
      complete: (payload) => {
        this.handleComplete(interfaceName, payload, requestId);
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

    const requestId = this.resetResultState(interfaceName);

    try {
      this.callChoosePoi(requestId);
    } catch (error) {
      this.handleFail(interfaceName, {
        errMsg: interfaceName + ':fail sync exception',
        error: {
          name: error && error.name ? error.name : 'Error',
          message: error && error.message ? error.message : String(error),
          stack: error && error.stack ? error.stack : '',
        },
      }, requestId);
      this.finishRequest(requestId, '同步异常后结束');
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

    const requestId = this.resetResultState(interfaceName);

    try {
      this.callChooseLocation(requestId);
    } catch (error) {
      this.handleFail(interfaceName, {
        errMsg: interfaceName + ':fail sync exception',
        error: {
          name: error && error.name ? error.name : 'Error',
          message: error && error.message ? error.message : String(error),
          stack: error && error.stack ? error.stack : '',
        },
      }, requestId);
      this.finishRequest(requestId, '同步异常后结束');
    }
  },
});
