const { getCollections, getDatabase, initCloud } = require('./cloud');

const LOCATION_MATCH_DISTANCE_METERS = 1200;

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s·•,，。、“”"'‘’（）()【】\[\]《》:：;；/\\\-]/g, '');
}

function normalizeCoordinate(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

function isValidLatitude(value) {
  return typeof value === 'number' && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return typeof value === 'number' && value >= -180 && value <= 180;
}

function hasValidCoordinates(latitude, longitude) {
  return isValidLatitude(latitude) && isValidLongitude(longitude) && !(latitude === 0 && longitude === 0);
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function calculateDistanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  if (!hasValidCoordinates(latitudeA, longitudeA) || !hasValidCoordinates(latitudeB, longitudeB)) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const originLatitude = toRadians(latitudeA);
  const destinationLatitude = toRadians(latitudeB);
  const haversine = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
    + Math.cos(originLatitude) * Math.cos(destinationLatitude)
    * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Math.round(earthRadiusMeters * angularDistance);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map(function normalizeTagItem(tag) {
        return String(tag || '').trim();
      })
      .filter(Boolean);
  }

  if (typeof tags === 'string') {
    const trimmedTags = tags.trim();

    if (!trimmedTags) {
      return [];
    }

    if (trimmedTags.indexOf('[') === 0) {
      try {
        const parsedTags = JSON.parse(trimmedTags);

        if (Array.isArray(parsedTags)) {
          return parsedTags
            .map(function normalizeParsedTag(tag) {
              return String(tag || '').trim();
            })
            .filter(Boolean);
        }
      } catch (error) {
        // Fall through to delimiter-based parsing for historical string data.
      }
    }

    return trimmedTags
      .split(/[,\n，、|]/)
      .map(function normalizeSplitTag(tag) {
        return String(tag || '').trim();
      })
      .filter(Boolean);
  }

  return [];
}

function formatLocationAddress(location) {
  return [location.province, location.city, location.name].filter(Boolean).join('');
}

function normalizeLocation(doc) {
  return {
    id: doc._id || doc.id,
    name: doc.name,
    address: doc.address || '',
    city: doc.city,
    province: doc.province,
    country: doc.country,
    latitude: doc.latitude,
    longitude: doc.longitude,
    poiid: doc.poiid || '',
    source: doc.source || '',
    dedupeKey: doc.dedupeKey || '',
    level: doc.level,
    tags: normalizeTags(doc.tags),
    intro: doc.intro || doc.description || doc.introduction || doc.summary || '',
    description: doc.description || doc.introduction || doc.summary || '',
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    viewCount: doc.viewCount,
    clickCount: doc.clickCount,
    visitCount: doc.visitCount,
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

function validateRequiredLocationId(locationId, actionText) {
  if (typeof locationId !== 'string' || !locationId.trim() || locationId.trim().toLowerCase() === 'null') {
    throw new Error((actionText || '当前操作') + '需要正式地点的有效 locationId。');
  }

  return locationId.trim();
}

function normalizeSelectedPlace(rawPlace) {
  if (!rawPlace || typeof rawPlace !== 'object') {
    return {
      status: 'invalid_input',
      selectedPlace: null,
      matchReason: '微信地图未返回有效地点信息',
    };
  }

  const name = String(rawPlace.name || '').trim();
  const address = String(rawPlace.address || '').trim();
  const latitude = normalizeCoordinate(rawPlace.latitude);
  const longitude = normalizeCoordinate(rawPlace.longitude);
  const poiid = String(rawPlace.poiid || '').trim();
  const city = String(rawPlace.city || '').trim();
  const province = String(rawPlace.province || '').trim();

  if (!name) {
    return {
      status: 'invalid_input',
      selectedPlace: null,
      matchReason: '微信返回的地点名称为空',
    };
  }

  if (!hasValidCoordinates(latitude, longitude)) {
    return {
      status: 'invalid_input',
      selectedPlace: null,
      matchReason: '微信返回的坐标无效',
    };
  }

  return {
    status: 'valid',
    selectedPlace: {
      source: 'wechat_chooseLocation',
      name: name,
      address: address,
      latitude: latitude,
      longitude: longitude,
      poiid: poiid,
      city: city,
      province: province,
      rawPlace: rawPlace,
    },
  };
}

function createServiceError(code, message) {
  const error = new Error(message || '地点服务暂时不可用，请稍后再试。');

  if (code) {
    error.code = code;
  }

  return error;
}

function shouldUseLocalFallback() {
  return typeof wx === 'undefined'
    || !wx.cloud
    || typeof wx.cloud.callFunction !== 'function';
}

function validateEnsureLocationPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw createServiceError('INVALID_INPUT', '地点信息不完整，请重新选择地点。');
  }

  const source = String(payload.source || '').trim() || 'wechat_chooseLocation';
  const name = String(payload.name || '').trim();
  const address = String(payload.address || '').trim();
  const poiid = String(payload.poiid || '').trim();
  const city = String(payload.city || '').trim();
  const province = String(payload.province || '').trim();
  const latitude = normalizeCoordinate(payload.latitude);
  const longitude = normalizeCoordinate(payload.longitude);

  if (!name) {
    throw createServiceError('INVALID_INPUT', '地点名称不能为空，请重新选择地点。');
  }

  if (!hasValidCoordinates(latitude, longitude)) {
    throw createServiceError('INVALID_INPUT', '地点坐标无效，请重新选择地点。');
  }

  return {
    source: source,
    name: name,
    address: address,
    latitude: latitude,
    longitude: longitude,
    poiid: poiid,
    city: city,
    province: province,
  };
}

async function ensureLocation(payload) {
  const normalizedPayload = validateEnsureLocationPayload(payload);

  if (shouldUseLocalFallback()) {
    return {
      locationId: '',
      isTemporary: false,
      fallbackToTemporary: false,
      location: {
        id: '',
        name: normalizedPayload.name,
        address: normalizedPayload.address,
        city: normalizedPayload.city,
        province: normalizedPayload.province,
        latitude: normalizedPayload.latitude,
        longitude: normalizedPayload.longitude,
        poiid: normalizedPayload.poiid,
        source: normalizedPayload.source,
        status: 'candidate',
      },
      matchReason: '当前环境未接入云端地点确认，保留本次选点信息。',
    };
  }

  initCloud();

  try {
    const result = await new Promise(function callEnsureLocation(resolve, reject) {
      wx.cloud.callFunction({
        name: 'ensureLocation',
        data: normalizedPayload,
        success: resolve,
        fail: reject,
      });
    });

    const functionResult = result && result.result ? result.result : null;

    if (!functionResult || typeof functionResult.ok !== 'boolean') {
      throw createServiceError('DEPLOY_REQUIRED', '地点确认服务尚未更新，请重新部署 ensureLocation 云函数。');
    }

    if (functionResult.ok !== true) {
      const errorCode = functionResult && functionResult.error && functionResult.error.code
        ? functionResult.error.code
        : 'INTERNAL_ERROR';
      const message = functionResult && functionResult.error && functionResult.error.message
        ? functionResult.error.message
        : '地点确认失败，请稍后再试。';
      throw createServiceError(errorCode, message);
    }

    const data = functionResult.data && typeof functionResult.data === 'object'
      ? functionResult.data
      : {};

    return {
      locationId: typeof data.locationId === 'string' ? data.locationId : '',
      isTemporary: !!data.isTemporary,
      fallbackToTemporary: !!data.fallbackToTemporary,
      matchReason: typeof data.matchReason === 'string' ? data.matchReason : '',
      fallbackReason: typeof data.fallbackReason === 'string' ? data.fallbackReason : '',
      created: !!data.created,
      reused: !!data.reused,
      status: typeof data.status === 'string' ? data.status : '',
      location: data.location ? normalizeLocation(data.location) : null,
    };
  } catch (error) {
    const rawMessage = error && error.message ? String(error.message) : '';
    const errorCode = error && error.code ? String(error.code) : '';

    if (
      rawMessage.indexOf('FunctionName parameter could not be found') !== -1
      || rawMessage.indexOf('找不到') !== -1
      || rawMessage.indexOf('not found') !== -1
    ) {
      throw createServiceError('DEPLOY_REQUIRED', '地点确认服务尚未更新，请重新部署 ensureLocation 云函数。');
    }

    throw createServiceError(errorCode || 'INTERNAL_ERROR', rawMessage || '地点确认失败，请稍后再试。');
  }
}

function matchSelectedPlaceToLocations(selectedPlace, locations) {
  if (!selectedPlace) {
    return {
      status: 'invalid_input',
      locationId: '',
      selectedPlace: null,
      matchReason: '缺少微信选点结果',
      candidates: [],
    };
  }

  const normalizedName = normalizeText(selectedPlace.name);
  const normalizedAddress = normalizeText(selectedPlace.address);
  const locationList = Array.isArray(locations) ? locations : [];
  const exactMatches = [];
  const candidateMatches = [];

  locationList.forEach(function evaluateLocation(location) {
    const locationName = normalizeText(location.name);
    const locationAddress = normalizeText(formatLocationAddress(location));
    const nameMatched = normalizedName && normalizedName === locationName;
    const addressMatched = normalizedAddress && (
      normalizedAddress.indexOf(locationName) !== -1 ||
      normalizedAddress.indexOf(locationAddress) !== -1
    );
    const distanceMeters = calculateDistanceMeters(
      selectedPlace.latitude,
      selectedPlace.longitude,
      normalizeCoordinate(location.latitude),
      normalizeCoordinate(location.longitude)
    );
    const distanceMatched = typeof distanceMeters === 'number' && distanceMeters <= LOCATION_MATCH_DISTANCE_METERS;

    if (nameMatched && (addressMatched || distanceMatched)) {
      exactMatches.push({
        location: location,
        matchReason: addressMatched
          ? '名称与地址能够可靠命中已有地点'
          : '名称与坐标能够可靠命中已有地点',
      });
      return;
    }

    if (nameMatched || addressMatched) {
      candidateMatches.push({
        locationId: location.id,
        name: location.name,
        address: formatLocationAddress(location),
        latitude: location.latitude,
        longitude: location.longitude,
        matchReason: '名称或地址与现有地点接近，但还不能直接复用正式地点',
        confidence: distanceMatched ? 'medium' : 'low',
      });
    }
  });

  if (exactMatches.length === 1) {
    return {
      status: 'matched',
      locationId: exactMatches[0].location.id,
      selectedPlace: selectedPlace,
      matchReason: exactMatches[0].matchReason,
      candidates: [],
    };
  }

  if (exactMatches.length > 1 || candidateMatches.length > 0) {
    return {
      status: 'candidate',
      locationId: '',
      selectedPlace: selectedPlace,
      matchReason: '找到可能匹配的系统地点，但当前不直接复用正式地点',
      candidates: candidateMatches,
    };
  }

  return {
    status: 'unmatched',
    locationId: '',
    selectedPlace: selectedPlace,
    matchReason: '当前没有可靠命中的系统地点，将按临时选定地点处理',
    candidates: [],
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
  const normalizedLocationId = validateRequiredLocationId(locationId, '读取地点详情');

  if (!db) {
    throw new Error('CloudBase database is unavailable.');
  }

  try {
    const result = await db.collection(getCollections().locations).doc(normalizedLocationId).get();

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
        id: normalizedLocationId,
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
  const normalizedLocationId = validateRequiredLocationId(locationId, '读取地点故事列表');

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

    return (result.data || []).map(normalizeStorySummary);
  } catch (error) {
    throw new Error('Failed to load stories by location from CloudBase: ' + error.message);
  }
}

module.exports = {
  ensureLocation,
  getLocationById,
  getPublishedLocations,
  getStoriesByLocationId,
  listLocations,
  matchSelectedPlaceToLocations,
  normalizeTags,
  normalizeSelectedPlace,
};
