const COLLECTIONS = {
  users: 'users',
  locations: 'locations',
  stories: 'stories',
  favorites: 'favorites',
  explorations: 'explorations',
};

let cloudInitialized = false;

function isCloudAvailable() {
  return typeof wx !== 'undefined' && !!wx.cloud;
}

function initCloud() {
  if (!isCloudAvailable()) {
    console.warn('wx.cloud is not available in the current environment.');
    return false;
  }

  if (!cloudInitialized) {
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true,
    });
    cloudInitialized = true;
  }

  return true;
}

function getDatabase() {
  if (!initCloud()) {
    return null;
  }

  return wx.cloud.database();
}

function getCollections() {
  return COLLECTIONS;
}

module.exports = {
  COLLECTIONS,
  getCollections,
  getDatabase,
  initCloud,
  isCloudAvailable,
};
