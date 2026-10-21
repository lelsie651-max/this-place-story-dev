const { initCloud, isCloudAvailable } = require('./services/cloud');

function getMiniProgramEnvVersion() {
  if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
    return 'release';
  }

  try {
    const accountInfo = wx.getAccountInfoSync();
    const envVersion = accountInfo
      && accountInfo.miniProgram
      && accountInfo.miniProgram.envVersion;

    return typeof envVersion === 'string' && envVersion.trim()
      ? envVersion.trim()
      : 'release';
  } catch (error) {
    console.warn('[app] getAccountInfoSync failed', {
      message: error && error.message ? error.message : '',
    });
    return 'release';
  }
}

App({
  globalData: {
    cloudReady: false,
    miniProgramEnvVersion: 'release',
    rewardedVideoAdUnitId: '',
    pendingGeneratedStory: null,
    pendingSelectedPlace: null,
    pendingPublishLocation: null,
    pendingUserStoriesLocation: null,
    pendingUserStoriesSubmissionNotice: '',
    pendingMyStoryPreviewNotice: null,
    devTestToolsUpdatedAt: 0,
  },

  onLaunch() {
    const cloudReady = initCloud();

    this.globalData.cloudReady = cloudReady;
    this.globalData.miniProgramEnvVersion = getMiniProgramEnvVersion();

    if (!cloudReady && !isCloudAvailable()) {
      console.warn('CloudBase is unavailable. The app will continue with local mock data.');
    }
  },
});
