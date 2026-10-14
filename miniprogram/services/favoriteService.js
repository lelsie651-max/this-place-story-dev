const { getCollections, getDatabase } = require('./cloud');

const TEST_USER_ID = 'system_test_user';

function normalizeFavorite(doc) {
  return {
    id: doc._id,
    userId: doc.userId,
    storyId: doc.storyId,
    locationId: doc.locationId,
    createdAt: doc.createdAt,
  };
}

async function addFavorite(favorite) {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  const payload = {
    userId: favorite.userId,
    storyId: favorite.storyId,
    locationId: favorite.locationId,
    createdAt: favorite.createdAt || new Date().toISOString(),
  };

  try {
    const existing = await db
      .collection(getCollections().favorites)
      .where({
        userId: payload.userId,
        storyId: payload.storyId,
      })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      return normalizeFavorite(existing.data[0]);
    }

    const addResult = await db.collection(getCollections().favorites).add({
      data: payload,
    });

    return Object.assign(
      {
        id: addResult._id,
      },
      payload
    );
  } catch (error) {
    throw new Error('Failed to add favorite: ' + error.message);
  }
}

async function removeFavorite(storyId, userId) {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().favorites)
      .where({
        storyId: storyId,
        userId: userId,
      })
      .get();

    const favoriteList = result.data || [];

    if (favoriteList.length === 0) {
      return {
        removed: 0,
      };
    }

    await Promise.all(
      favoriteList.map(function removeItem(item) {
        return db.collection(getCollections().favorites).doc(item._id).remove();
      })
    );

    return {
      removed: favoriteList.length,
    };
  } catch (error) {
    throw new Error('Failed to remove favorite: ' + error.message);
  }
}

async function checkFavorite(storyId, userId) {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().favorites)
      .where({
        storyId: storyId,
        userId: userId,
      })
      .limit(1)
      .get();

    return !!(result.data && result.data.length > 0);
  } catch (error) {
    throw new Error('Failed to check favorite: ' + error.message);
  }
}

async function getFavorites(userId) {
  const db = getDatabase();

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db
      .collection(getCollections().favorites)
      .where({
        userId: userId,
      })
      .orderBy('createdAt', 'desc')
      .get();

    return (result.data || []).map(normalizeFavorite);
  } catch (error) {
    throw new Error('Failed to load favorites: ' + error.message);
  }
}

module.exports = {
  TEST_USER_ID,
  addFavorite,
  checkFavorite,
  getFavorites,
  removeFavorite,
};
