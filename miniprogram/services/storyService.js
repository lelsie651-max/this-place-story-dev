const { getCollections, getDatabase } = require('./cloud');

const PRESET_SOURCE_VALUES = {
  preset: true,
  folk_archive: true,
  ai_observer: true,
};

const USER_SOURCE_VALUES = {
  user: true,
};

function normalizeStory(doc) {
  return {
    id: doc._id,
    locationId: doc.locationId,
    type: doc.type,
    title: doc.title,
    summary: doc.summary,
    content: doc.content,
    source: doc.source,
    language: doc.language,
    authorId: doc.authorId,
    status: doc.status,
    createdAt: doc.createdAt,
  };
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

  if (!doc.source) {
    return true;
  }

  return !!PRESET_SOURCE_VALUES[doc.source];
}

function isUserStory(doc) {
  if (!doc || typeof doc !== 'object') {
    return false;
  }

  if (USER_SOURCE_VALUES[doc.source]) {
    return true;
  }

  return doc.type === 'traveler' || doc.type === '网友说';
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

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: locationId,
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

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: locationId,
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

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: locationId,
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

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().stories)
      .where({
        locationId: locationId,
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

module.exports = {
  getStoryById,
  getStoryByType,
  getRandomPresetStoryByLocationAndType,
  getRandomStoryByLocationAndType,
  getRandomUserStoryByLocation,
  listStories,
  listStoriesByLocation,
};
