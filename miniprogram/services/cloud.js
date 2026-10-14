const COLLECTIONS = {
  users: 'users',
  locations: 'locations',
  stories: 'stories',
  favorites: 'favorites',
  explorations: 'explorations',
};

const CLOUD_ENV_ID = 'cloud1-d8gpv2fu5feccd009';

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
    console.log('[Cloud] init start', CLOUD_ENV_ID);
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true,
    });
    console.log('[Cloud] init success');
    cloudInitialized = true;
  }

  return true;
}

function getDatabase() {
  console.log('[Cloud] getDatabase called');
  if (!initCloud()) {
    return null;
  }

  console.log('[Cloud] database env', CLOUD_ENV_ID);
  return wx.cloud.database({
    env: CLOUD_ENV_ID,
  });
}

function getCollections() {
  return COLLECTIONS;
}

module.exports = {
  COLLECTIONS,
  CLOUD_ENV_ID,
  getCollections,
  getDatabase,
  initCloud,
  isCloudAvailable,
};
