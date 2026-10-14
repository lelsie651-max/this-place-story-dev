const { getCollections, getDatabase } = require('./cloud');

function normalizeStory(doc) {
  return {
    id: doc._id,
    locationId: doc.locationId,
    type: doc.type,
    title: doc.title,
    content: doc.content,
    source: doc.source,
    language: doc.language,
    authorId: doc.authorId,
    status: doc.status,
    createdAt: doc.createdAt,
  };
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
      return null;
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

module.exports = {
  getStoryById,
  getStoryByType,
  listStories,
  listStoriesByLocation,
};
