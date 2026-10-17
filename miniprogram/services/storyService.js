const { getCollections, getDatabase } = require('./cloud');

const PRESET_SOURCE_VALUES = {
  preset: true,
  folk_archive: true,
};

const AI_SOURCE_VALUES = {
  ai_observer: true,
  deepseek: true,
};

const USER_SOURCE_VALUES = {
  user: true,
};

function normalizeStorySource(doc) {
  if (!doc || typeof doc !== 'object') {
    return '';
  }

  if (PRESET_SOURCE_VALUES[doc.source]) {
    return 'preset';
  }

  if (AI_SOURCE_VALUES[doc.source]) {
    return 'deepseek';
  }

  if (USER_SOURCE_VALUES[doc.source]) {
    return 'user';
  }

  if (!doc.source) {
    if (doc.type === 'traveler' || doc.type === '网友说') {
      return 'user';
    }

    return 'preset';
  }

  return doc.source;
}

function normalizeStory(doc) {
  return {
    id: doc._id,
    locationId: doc.locationId,
    type: doc.type,
    title: doc.title,
    summary: doc.summary,
    content: doc.content,
    source: normalizeStorySource(doc),
    language: doc.language,
    authorId: doc.authorId,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePlaceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const name = trimString(snapshot.name);

  if (!name) {
    return null;
  }

  const latitude = typeof snapshot.latitude === 'number' ? snapshot.latitude : Number(snapshot.latitude);
  const longitude = typeof snapshot.longitude === 'number' ? snapshot.longitude : Number(snapshot.longitude);

  return {
    name: name,
    address: trimString(snapshot.address),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    poiid: trimString(snapshot.poiid),
  };
}

function validateRequiredLocationId(locationId, actionText) {
  if (typeof locationId !== 'string' || !locationId.trim() || locationId.trim().toLowerCase() === 'null') {
    throw new Error((actionText || '当前操作') + '需要正式地点的有效 locationId。');
  }

  return locationId.trim();
}

function pickRandomStory(stories) {
  if (!stories || stories.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * stories.length);
  return stories[randomIndex];
}

function isPresetStory(doc) {
  if (!doc || typeof doc !== 'object') {
    return false;
  }

  return normalizeStorySource(doc) === 'preset';
}

function isUserStory(doc) {
  if (!doc || typeof doc !== 'object') {
    return false;
  }

  return normalizeStorySource(doc) === 'user';
}

async function listStories() {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    return result.data.map(normalizeStory);
  } catch (error) {
    throw new Error('Failed to list stories from CloudBase: ' + error.message);
  }
}

async function getStoryByType(type) {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        type: type,
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!result.data || result.data.length === 0) {
      throw new Error('No published story found for type "' + type + '".');
    }

    return normalizeStory(result.data[0]);
  } catch (error) {
    throw new Error('Failed to load story from CloudBase: ' + error.message);
  }
}

async function getStoryById(storyId) {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db.collection(getCollections().stories).doc(storyId).get();

    if (!result.data) {
      throw new Error('Story "' + storyId + '" does not exist.');
    }

    return normalizeStory(result.data);
  } catch (error) {
    throw new Error('Failed to load story by id from CloudBase: ' + error.message);
  }
}

async function listStoriesByLocation(locationId) {
  const db = getDatabase();
  const normalizedLocationId = validateRequiredLocationId(locationId, '按地点读取故事');

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: normalizedLocationId,
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    return result.data.map(normalizeStory);
  } catch (error) {
    throw new Error('Failed to load stories by location from CloudBase: ' + error.message);
  }
}

async function getRandomStoryByLocationAndType(locationId, type) {
  const db = getDatabase();
  const normalizedLocationId = validateRequiredLocationId(locationId, '按地点和类型读取故事');

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: normalizedLocationId,
        type: type,
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    if (!result.data || result.data.length === 0) {
      throw new Error('这个地点暂时还没有这种类型的已发布故事。');
    }

    return normalizeStory(pickRandomStory(result.data));
  } catch (error) {
    throw new Error('Failed to load story by location and type from CloudBase: ' + error.message);
  }
}

async function getRandomPresetStoryByLocationAndType(locationId, type) {
  const db = getDatabase();
  const normalizedLocationId = validateRequiredLocationId(locationId, '按地点和类型读取预设故事');

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: normalizedLocationId,
        type: type,
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    const presetStories = (result.data || []).filter(isPresetStory);

    if (presetStories.length === 0) {
      throw new Error('这个地点暂时还没有这种类型的预设故事。');
    }

    return normalizeStory(pickRandomStory(presetStories));
  } catch (error) {
    throw new Error('Failed to load preset story by location and type from CloudBase: ' + error.message);
  }
}

async function getRandomUserStoryByLocation(locationId) {
  const db = getDatabase();
  const normalizedLocationId = validateRequiredLocationId(locationId, '按地点读取网友投稿');

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: normalizedLocationId,
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    const userStories = (result.data || []).filter(isUserStory);

    if (userStories.length === 0) {
      throw new Error('这里暂时还没有网友投稿。');
    }

    return normalizeStory(pickRandomStory(userStories));
  } catch (error) {
    throw new Error('Failed to load user story by location from CloudBase: ' + error.message);
  }
}

async function listPublishedUserStoriesByLocation(locationId) {
  const db = getDatabase();
  const normalizedLocationId = validateRequiredLocationId(locationId, '按地点读取网友投稿列表');

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: normalizedLocationId,
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    return (result.data || [])
      .filter(isUserStory)
      .map(normalizeStory);
  } catch (error) {
    throw new Error('Failed to load user stories by location from CloudBase: ' + error.message);
  }
}

async function submitTravelerStory(payload) {
  const isTemporary = !!(payload && payload.isTemporary);
  const rawLocationId = payload ? payload.locationId : null;
  const locationId = isTemporary ? null : validateRequiredLocationId(rawLocationId, '提交网友投稿');
  const placeSnapshot = normalizePlaceSnapshot(payload && payload.placeSnapshot);
  const title = trimString(payload && payload.title);
  const content = trimString(payload && payload.content);

  if (!placeSnapshot) {
    throw new Error('请选择一个有效地点。');
  }

  if (!title) {
    throw new Error('请输入故事标题。');
  }

  if (!content) {
    throw new Error('请输入故事正文。');
  }

  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    throw new Error('投稿服务暂时不可用，请稍后再试。');
  }

  try {
    const result = await new Promise(function callSubmitStory(resolve, reject) {
      wx.cloud.callFunction({
        name: 'submitStory',
        data: {
          locationId: locationId,
          isTemporary: isTemporary,
          placeSnapshot: placeSnapshot,
          title: title,
          content: content,
        },
        success: resolve,
        fail: reject,
      });
    });

    const functionResult = result && result.result ? result.result : null;

    if (!functionResult || functionResult.ok !== true || !functionResult.storyId) {
      const message = functionResult && functionResult.error && functionResult.error.message
        ? functionResult.error.message
        : '投稿提交失败，请稍后再试。';
      throw new Error(message);
    }

    return {
      storyId: functionResult.storyId,
      message: functionResult.message || '投稿已提交，审核通过后会展示。',
    };
  } catch (error) {
    throw new Error(error && error.message ? error.message : '投稿提交失败，请稍后再试。');
  }
}

module.exports = {
  getStoryById,
  getStoryByType,
  getRandomPresetStoryByLocationAndType,
  getRandomStoryByLocationAndType,
  getRandomUserStoryByLocation,
  listPublishedUserStoriesByLocation,
  submitTravelerStory,
  listStories,
  listStoriesByLocation,
};
