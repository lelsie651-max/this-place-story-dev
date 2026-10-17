const { initCloud, isCloudAvailable } = require('./services/cloud');

App({
  globalData: {
    cloudReady: false,
    pendingGeneratedStory: null,
    pendingSelectedPlace: null,
    pendingPublishLocation: null,
  },

  onLaunch() {
    const cloudReady = initCloud();

    this.globalData.cloudReady = cloudReady;

    if (!cloudReady && !isCloudAvailable()) {
      console.warn('CloudBase is unavailable. The app will continue with local mock data.');
    }
  },
});
