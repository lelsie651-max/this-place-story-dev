function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
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
    combined.indexOf('110') !== -1 ||
    combined.indexOf('112') !== -1
  );
}

function isCancelError(error) {
  const errMsg = error && error.errMsg ? String(error.errMsg).toLowerCase() : '';

  return errMsg.indexOf(':fail cancel') !== -1;
}

function buildSupportSnapshot() {
  return {
    sdkVersion: getSdkVersion(),
    canIUseGetLocation: getCanIUseResult('getLocation'),
    canIUseChoosePoi: getCanIUseResult('choosePoi'),
    canIUseChooseLocation: getCanIUseResult('chooseLocation'),
    getLocationType: typeof wx.getLocation,
    choosePoiType: typeof wx.choosePoi,
    chooseLocationType: typeof wx.chooseLocation,
  };
}

function isValidLatitude(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

function normalizeCoordinatePair(result) {
  const rawLatitude = result ? result.latitude : undefined;
  const rawLongitude = result ? result.longitude : undefined;
  const latitudeValid = isValidLatitude(rawLatitude);
  const longitudeValid = isValidLongitude(rawLongitude);
  const zeroPair = latitudeValid && longitudeValid && rawLatitude === 0 && rawLongitude === 0;
  const hasValidCoordinates = latitudeValid && longitudeValid && !zeroPair;

  return {
    rawLatitude: formatRawValue(rawLatitude),
    rawLongitude: formatRawValue(rawLongitude),
    latitude: hasValidCoordinates ? rawLatitude : null,
    longitude: hasValidCoordinates ? rawLongitude : null,
    latitudeDisplay: hasValidCoordinates ? String(rawLatitude) : '未返回',
    longitudeDisplay: hasValidCoordinates ? String(rawLongitude) : '未返回',
    hasValidCoordinates: hasValidCoordinates,
    coordinateMessage: hasValidCoordinates ? '' : '微信本次未返回有效经纬度',
  };
}

function normalizeApiResult(apiKey, result) {
  const coordinates = normalizeCoordinatePair(result);

  return {
    apiKey: apiKey,
    name: result && result.name ? result.name : '',
    address: result && result.address ? result.address : '',
    city: result && result.city ? result.city : '',
    type: typeof (result && result.type) === 'undefined' ? '' : String(result.type),
    errMsg: result && result.errMsg ? result.errMsg : '',
    rawLatitude: coordinates.rawLatitude,
    rawLongitude: coordinates.rawLongitude,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    latitudeDisplay: coordinates.latitudeDisplay,
    longitudeDisplay: coordinates.longitudeDisplay,
    hasValidCoordinates: coordinates.hasValidCoordinates,
    coordinateMessage: coordinates.coordinateMessage,
    validityLabel: coordinates.hasValidCoordinates ? '有效' : '无效',
  };
}

function buildEmptyApiState(interfaceName) {
  return {
    interfaceName: interfaceName,
    statusText: '未测试',
    lastActionMessage: '等待测试',
    completeMessage: '',
    rawSuccessResult: '',
    rawCancelResult: '',
    rawErrorResult: '',
    normalizedResult: null,
    likelyPermissionIssue: false,
    likelyPrivacyConfigIssue: false,
    coordinateValidityLabel: '未测试',
    latestErrMsg: '',
  };
}

function buildUnsupportedError(interfaceName, apiName) {
  const supportSnapshot = buildSupportSnapshot();
  const canIUseKey = apiName === 'getLocation'
    ? 'canIUseGetLocation'
    : apiName === 'choosePoi'
      ? 'canIUseChoosePoi'
      : 'canIUseChooseLocation';
  const typeKey = apiName === 'getLocation'
    ? 'getLocationType'
    : apiName === 'choosePoi'
      ? 'choosePoiType'
      : 'chooseLocationType';

  return {
    errMsg: interfaceName + ':fail current runtime does not support this API',
    interfaceName: interfaceName,
    apiName: apiName,
    sdkVersion: supportSnapshot.sdkVersion || '',
    canIUse: supportSnapshot[canIUseKey],
    typeofApi: supportSnapshot[typeKey],
  };
}

Page({
  data: {
    pageLoadMessage: '',
    sdkVersion: '',
    canIUseGetLocation: false,
    canIUseChoosePoi: false,
    canIUseChooseLocation: false,
    getLocationType: '',
    choosePoiType: '',
    chooseLocationType: '',
    currentInterfaceName: '',
    loading: false,
    clickLocked: false,
    getLocationState: buildEmptyApiState('wx.getLocation'),
    choosePoiState: buildEmptyApiState('wx.choosePoi'),
    chooseLocationState: buildEmptyApiState('wx.chooseLocation'),
  },

  onLoad() {
    const supportSnapshot = buildSupportSnapshot();

    this.setData({
      pageLoadMessage: '原生地点接口测试页已加载',
      sdkVersion: supportSnapshot.sdkVersion || '未知',
      canIUseGetLocation: supportSnapshot.canIUseGetLocation,
      canIUseChoosePoi: supportSnapshot.canIUseChoosePoi,
      canIUseChooseLocation: supportSnapshot.canIUseChooseLocation,
      getLocationType: supportSnapshot.getLocationType,
      choosePoiType: supportSnapshot.choosePoiType,
      chooseLocationType: supportSnapshot.chooseLocationType,
    });

    wx.showToast({
      title: '测试页已加载',
      icon: 'none',
    });
  },

  onUnload() {
    wx.hideLoading();
  },

  updateApiState(apiKey, patch) {
    this.setData({
      [apiKey + 'State']: Object.assign({}, this.data[apiKey + 'State'], patch),
    });
  },

  beginApiCall(apiKey, interfaceName) {
    this.currentRequestId = (this.currentRequestId || 0) + 1;
    const requestId = this.currentRequestId;

    this.updateApiState(apiKey, {
      statusText: '调用中',
      lastActionMessage: '已点击，正在调用……',
      completeMessage: '等待 complete 回调',
      rawSuccessResult: '',
      rawCancelResult: '',
      rawErrorResult: '',
      normalizedResult: null,
      likelyPermissionIssue: false,
      likelyPrivacyConfigIssue: false,
      coordinateValidityLabel: '未测试',
      latestErrMsg: '',
    });

    this.setData({
      currentInterfaceName: interfaceName,
      loading: true,
      clickLocked: true,
    });

    wx.showLoading({
      title: '正在调用',
      mask: true,
    });

    return requestId;
  },

  isStaleRequest(requestId) {
    return requestId !== this.currentRequestId;
  },

  finishRequest(requestId, apiKey, completeMessage) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    this.updateApiState(apiKey, {
      completeMessage: completeMessage || this.data[apiKey + 'State'].completeMessage,
    });

    this.setData({
      loading: false,
      clickLocked: false,
    });

    wx.hideLoading();
  },

  handleSuccess(apiKey, interfaceName, result, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    const normalizedResult = normalizeApiResult(apiKey, result);

    this.updateApiState(apiKey, {
      statusText: '选择成功',
      lastActionMessage: '选择成功',
      rawSuccessResult: safeStringify(result),
      rawCancelResult: '',
      rawErrorResult: '',
      normalizedResult: normalizedResult,
      likelyPermissionIssue: false,
      likelyPrivacyConfigIssue: false,
      coordinateValidityLabel: normalizedResult.validityLabel,
      latestErrMsg: result && result.errMsg ? result.errMsg : interfaceName + ':ok',
    });

    wx.showToast({
      title: '选择成功',
      icon: 'success',
    });
  },

  handleCancel(apiKey, error, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    this.updateApiState(apiKey, {
      statusText: '已取消选择',
      lastActionMessage: '已取消选择',
      rawSuccessResult: '',
      rawCancelResult: safeStringify(error),
      rawErrorResult: '',
      normalizedResult: null,
      likelyPermissionIssue: false,
      likelyPrivacyConfigIssue: false,
      coordinateValidityLabel: '未测试',
      latestErrMsg: error && error.errMsg ? error.errMsg : '',
    });

    wx.showToast({
      title: '已取消',
      icon: 'none',
    });
  },

  handleFail(apiKey, interfaceName, error, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    const supportSnapshot = buildSupportSnapshot();
    const likelyPermissionIssue = detectPermissionHint(error);
    const diagnostics = {
      interfaceName: interfaceName,
      sdkVersion: supportSnapshot.sdkVersion || '',
      canIUse: apiKey === 'getLocation'
        ? supportSnapshot.canIUseGetLocation
        : apiKey === 'choosePoi'
          ? supportSnapshot.canIUseChoosePoi
          : supportSnapshot.canIUseChooseLocation,
      typeofApi: apiKey === 'getLocation'
        ? supportSnapshot.getLocationType
        : apiKey === 'choosePoi'
          ? supportSnapshot.choosePoiType
          : supportSnapshot.chooseLocationType,
      errMsg: error && error.errMsg ? error.errMsg : '',
      error: error,
      likelyPermissionIssue: likelyPermissionIssue,
      likelyPrivacyConfigIssue: likelyPermissionIssue,
    };

    this.updateApiState(apiKey, {
      statusText: '调用失败',
      lastActionMessage: '接口调用失败',
      rawSuccessResult: '',
      rawCancelResult: '',
      rawErrorResult: safeStringify(diagnostics),
      normalizedResult: null,
      likelyPermissionIssue: likelyPermissionIssue,
      likelyPrivacyConfigIssue: likelyPermissionIssue,
      coordinateValidityLabel: '无效',
      latestErrMsg: diagnostics.errMsg,
    });

    wx.showModal({
      title: '地点接口调用失败',
      content: diagnostics.errMsg || '未返回明确 errMsg，请查看页面完整错误信息。',
      showCancel: false,
    });
  },

  handleComplete(apiKey, payload, requestId) {
    if (this.isStaleRequest(requestId)) {
      return;
    }

    this.finishRequest(requestId, apiKey, 'complete 已触发：' + safeStringify(payload));
  },

  callGetLocation(requestId) {
    const interfaceName = 'wx.getLocation';

    if (typeof wx.getLocation !== 'function' || !getCanIUseResult('getLocation')) {
      this.handleFail('getLocation', interfaceName, buildUnsupportedError(interfaceName, 'getLocation'), requestId);
      this.finishRequest(requestId, 'getLocation', '未进入原生界面');
      return;
    }

    wx.getLocation({
      type: 'gcj02',
      success: (result) => {
        this.handleSuccess('getLocation', interfaceName, result, requestId);
      },
      fail: (error) => {
        if (isCancelError(error)) {
          this.handleCancel('getLocation', error, requestId);
          return;
        }

        this.handleFail('getLocation', interfaceName, error, requestId);
      },
      complete: (payload) => {
        this.handleComplete('getLocation', payload, requestId);
      },
    });
  },

  callChoosePoi(requestId) {
    const interfaceName = 'wx.choosePoi';

    if (typeof wx.choosePoi !== 'function' || !getCanIUseResult('choosePoi')) {
      this.handleFail('choosePoi', interfaceName, buildUnsupportedError(interfaceName, 'choosePoi'), requestId);
      this.finishRequest(requestId, 'choosePoi', '未进入原生界面');
      return;
    }

    wx.choosePoi({
      success: (result) => {
        this.handleSuccess('choosePoi', interfaceName, result, requestId);
      },
      fail: (error) => {
        if (isCancelError(error)) {
          this.handleCancel('choosePoi', error, requestId);
          return;
        }

        this.handleFail('choosePoi', interfaceName, error, requestId);
      },
      complete: (payload) => {
        this.handleComplete('choosePoi', payload, requestId);
      },
    });
  },

  callChooseLocation(requestId) {
    const interfaceName = 'wx.chooseLocation';

    if (typeof wx.chooseLocation !== 'function' || !getCanIUseResult('chooseLocation')) {
      this.handleFail('chooseLocation', interfaceName, buildUnsupportedError(interfaceName, 'chooseLocation'), requestId);
      this.finishRequest(requestId, 'chooseLocation', '未进入原生界面');
      return;
    }

    wx.chooseLocation({
      success: (result) => {
        this.handleSuccess('chooseLocation', interfaceName, result, requestId);
      },
      fail: (error) => {
        if (isCancelError(error)) {
          this.handleCancel('chooseLocation', error, requestId);
          return;
        }

        this.handleFail('chooseLocation', interfaceName, error, requestId);
      },
      complete: (payload) => {
        this.handleComplete('chooseLocation', payload, requestId);
      },
    });
  },

  runApiTest(apiKey, interfaceName, caller) {
    if (this.data.clickLocked) {
      wx.showToast({
        title: '接口调用中，请稍候',
        icon: 'none',
      });
      return;
    }

    const requestId = this.beginApiCall(apiKey, interfaceName);

    try {
      caller.call(this, requestId);
    } catch (error) {
      this.handleFail(apiKey, interfaceName, {
        errMsg: interfaceName + ':fail sync exception',
        error: {
          name: error && error.name ? error.name : 'Error',
          message: error && error.message ? error.message : String(error),
          stack: error && error.stack ? error.stack : '',
        },
      }, requestId);
      this.finishRequest(requestId, apiKey, '同步异常后结束');
    }
  },

  testGetLocation() {
    this.runApiTest('getLocation', 'wx.getLocation', this.callGetLocation);
  },

  testChoosePoi() {
    this.runApiTest('choosePoi', 'wx.choosePoi', this.callChoosePoi);
  },

  testChooseLocation() {
    this.runApiTest('chooseLocation', 'wx.chooseLocation', this.callChooseLocation);
  },
});
