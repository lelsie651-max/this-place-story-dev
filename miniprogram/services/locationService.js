const { getCollections, getDatabase } = require('./cloud');

function normalizeLocation(doc) {
  return {
    id: doc._id || doc.id,
    name: doc.name,
    city: doc.city,
    province: doc.province,
    country: doc.country,
    latitude: doc.latitude,
    longitude: doc.longitude,
    level: doc.level,
    tags: doc.tags,
    intro: doc.intro || doc.description || doc.introduction || doc.summary || '',
    description: doc.description || doc.introduction || doc.summary || '',
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

function normalizeStorySummary(doc) {
  return {
    id: doc._id,
    locationId: doc.locationId,
    type: doc.type,
    title: doc.title,
    summary: doc.summary || '',
    content: doc.content,
    source: doc.source,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

async function getPublishedLocations() {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().locations)
      .where({
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return (result.data || []).map(normalizeLocation);
  } catch (error) {
    throw new Error('Failed to list published locations from CloudBase: ' + error.message);
  }
}

async function listLocations() {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db.collection(getCollections().locations).get();
    return result.data.map(normalizeLocation);
  } catch (error) {
    throw new Error('Failed to list locations from CloudBase: ' + error.message);
  }
}

async function getLocationById(locationId) {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db.collection(getCollections().locations).doc(locationId).get();

    if (result.data) {
      return normalizeLocation(result.data);
    }
  } catch (error) {
    const message = error && error.message ? error.message : '';

    if (message.indexOf('document') === -1 && message.indexOf('not exist') === -1) {
      throw new Error('Failed to load location from CloudBase: ' + message);
    }
  }

  try {
    const fallbackResult = await db
      .collection(getCollections().locations)
      .where({
        id: locationId,
      })
      .limit(1)
      .get();

    if (!fallbackResult.data || fallbackResult.data.length === 0) {
      return null;
    }

    return normalizeLocation(fallbackResult.data[0]);
  } catch (error) {
    throw new Error('Failed to load location from CloudBase: ' + error.message);
  }
}

async function getStoriesByLocationId(locationId) {
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

    return (result.data || []).map(normalizeStorySummary);
  } catch (error) {
    throw new Error('Failed to load stories by location from CloudBase: ' + error.message);
  }
}

module.exports = {
  getLocationById,
  getPublishedLocations,
  getStoriesByLocationId,
  listLocations,
};
