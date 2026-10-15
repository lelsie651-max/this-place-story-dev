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

Page({
  data: {
    currentInterfaceName: '',
    loading: false,
    resultStatus: '',
    rawSuccessResult: '',
    normalizedResult: null,
    rawErrorResult: '',
    likelyPermissionIssue: false,
    supportedApis: {
      choosePoi: typeof wx !== 'undefined' && typeof wx.choosePoi === 'function',
      chooseLocation: typeof wx !== 'undefined' && typeof wx.chooseLocation === 'function',
    },
  },

  resetResultState(interfaceName) {
    this.setData({
      currentInterfaceName: interfaceName,
      loading: true,
      resultStatus: '',
      rawSuccessResult: '',
      normalizedResult: null,
      rawErrorResult: '',
      likelyPermissionIssue: false,
    });
  },

  handleSuccess(interfaceName, result) {
    this.setData({
      currentInterfaceName: interfaceName,
      loading: false,
      resultStatus: 'success',
      rawSuccessResult: safeStringify(result),
      normalizedResult: normalizeLocationResult(interfaceName, result),
      rawErrorResult: '',
      likelyPermissionIssue: false,
    });
  },

  handleFail(interfaceName, error) {
    this.setData({
      currentInterfaceName: interfaceName,
      loading: false,
      resultStatus: 'fail',
      rawSuccessResult: '',
      normalizedResult: null,
      rawErrorResult: safeStringify(error),
      likelyPermissionIssue: detectPermissionHint(error),
    });
  },

  testChoosePoi() {
    const interfaceName = 'wx.choosePoi';

    if (typeof wx.choosePoi !== 'function') {
      this.handleFail(interfaceName, {
        errMsg: 'choosePoi:fail api not supported in current runtime',
      });
      return;
    }

    this.resetResultState(interfaceName);

    wx.choosePoi({
      success: (result) => {
        this.handleSuccess(interfaceName, result);
      },
      fail: (error) => {
        this.handleFail(interfaceName, error);
      },
    });
  },

  testChooseLocation() {
    const interfaceName = 'wx.chooseLocation';

    if (typeof wx.chooseLocation !== 'function') {
      this.handleFail(interfaceName, {
        errMsg: 'chooseLocation:fail api not supported in current runtime',
      });
      return;
    }

    this.resetResultState(interfaceName);

    wx.chooseLocation({
      success: (result) => {
        this.handleSuccess(interfaceName, result);
      },
      fail: (error) => {
        this.handleFail(interfaceName, error);
      },
    });
  },
});
