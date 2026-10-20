const crypto = require('crypto');

let cloud = null;

try {
  cloud = require('wx-server-sdk');
} catch (error) {
  cloud = {
    DYNAMIC_CURRENT_ENV: '',
    init: function init() {},
    database: function database() {
      return null;
    },
    getWXContext: function getWXContext() {
      return {};
    },
  };
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database ? cloud.database() : null;
const _ = db && db.command ? db.command : null;

const LOCATIONS_COLLECTION = 'locations';
const MATCHABLE_STATUSES = {
  candidate: true,
  published: true,
};
const COORDINATE_AUXILIARY_DISTANCE_METERS = 300;
const ALLOWED_ERROR_CODES = {
  CONFIG_ERROR: true,
  INTERNAL_ERROR: true,
  INVALID_INPUT: true,
};

class EnsureLocationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EnsureLocationError';
    this.code = code;
  }
}

function buildSuccess(data) {
  return {
    ok: true,
    data: data,
  };
}

function buildError(code, message) {
  return {
    ok: false,
    error: {
      code: code,
      message: message,
    },
  };
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value) {
  return trimString(String(value || ''))
    .toLowerCase()
    .replace(/[\s·•,，。、“”"'‘’（）()【】\[\]《》:：;；/\\\-]/g, '');
}

function normalizeAddress(value) {
  return trimString(String(value || ''))
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、“”"'‘’（）()【】\[\]《》:：;；/\\\-]/g, '');
}

function normalizeCoordinate(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

function hasValidCoordinates(latitude, longitude) {
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0);
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

function createDigest(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}

function createLocationIdFromDedupeKey(dedupeKey) {
  return 'loc_auto_' + createDigest(dedupeKey).slice(0, 24);
}

function isMatchableStatus(status) {
  return !!MATCHABLE_STATUSES[trimString(status)];
}

function normalizeLocationDoc(doc) {
  return {
    _id: doc._id,
    name: trimString(doc.name),
    address: trimString(doc.address),
    city: trimString(doc.city),
    province: trimString(doc.province),
    latitude: normalizeCoordinate(doc.latitude),
    longitude: normalizeCoordinate(doc.longitude),
    poiid: trimString(doc.poiid),
    source: trimString(doc.source),
    dedupeKey: trimString(doc.dedupeKey),
    status: trimString(doc.status) || 'candidate',
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new EnsureLocationError('INVALID_INPUT', '地点信息不完整，请重新选择地点。');
  }

  const source = trimString(event.source) || 'wechat_chooseLocation';
  const name = trimString(event.name);
  const address = trimString(event.address);
  const city = trimString(event.city);
  const province = trimString(event.province);
  const poiid = trimString(event.poiid);
  const latitude = normalizeCoordinate(event.latitude);
  const longitude = normalizeCoordinate(event.longitude);

  if (!name) {
    throw new EnsureLocationError('INVALID_INPUT', '地点名称不能为空，请重新选择地点。');
  }

  if (!hasValidCoordinates(latitude, longitude)) {
    throw new EnsureLocationError('INVALID_INPUT', '地点坐标无效，请重新选择地点。');
  }

  return {
    source: source,
    name: name,
    address: address,
    city: city,
    province: province,
    latitude: latitude,
    longitude: longitude,
    poiid: poiid,
    normalizedName: normalizeText(name),
    normalizedAddress: normalizeAddress(address),
    normalizedCity: normalizeText(city),
    normalizedProvince: normalizeText(province),
  };
}

function buildTemporaryFallback(input, reason) {
  return {
    locationId: null,
    isTemporary: true,
    fallbackToTemporary: true,
    fallbackReason: reason,
    matchReason: '',
    created: false,
    reused: false,
    status: '',
    location: {
      name: input.name,
      address: input.address,
      city: input.city,
      province: input.province,
      latitude: input.latitude,
      longitude: input.longitude,
      poiid: input.poiid,
      source: input.source,
      status: 'temporary',
    },
  };
}

function formatLocationAddress(location) {
  return trimString(location.address) || [location.province, location.city, location.name].filter(Boolean).join('');
}

async function safeGetDocument(actor, collectionName, docId) {
  try {
    const result = await actor.collection(collectionName).doc(docId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    const message = error && error.message ? String(error.message) : '';

    if (
      message.indexOf('does not exist') !== -1
      || message.indexOf('non-existent') !== -1
      || message.indexOf('document.get:fail') !== -1
    ) {
      return null;
    }

    throw error;
  }
}

async function listCandidateLocationsByName(name) {
  if (!db || !_ || !name) {
    return [];
  }

  const result = await db
    .collection(LOCATIONS_COLLECTION)
    .where({
      name: name,
      status: _.in(['candidate', 'published']),
    })
    .limit(30)
    .get();

  return (result.data || []).map(normalizeLocationDoc);
}

async function listLocationsByPoiid(poiid) {
  if (!db || !_ || !poiid) {
    return [];
  }

  const result = await db
    .collection(LOCATIONS_COLLECTION)
    .where({
      poiid: poiid,
      status: _.in(['candidate', 'published']),
    })
    .limit(5)
    .get();

  return (result.data || []).map(normalizeLocationDoc);
}

function narrowMatchesByCoordinate(input, locations) {
  const locationList = Array.isArray(locations) ? locations : [];

  return locationList.filter(function filterLocation(location) {
    const distanceMeters = calculateDistanceMeters(
      input.latitude,
      input.longitude,
      normalizeCoordinate(location.latitude),
      normalizeCoordinate(location.longitude)
    );

    return typeof distanceMeters === 'number' && distanceMeters <= COORDINATE_AUXILIARY_DISTANCE_METERS;
  });
}

function chooseSingleMatch(input, locations) {
  const locationList = Array.isArray(locations) ? locations : [];

  if (locationList.length === 1) {
    return locationList[0];
  }

  const narrowedLocations = narrowMatchesByCoordinate(input, locationList);

  if (narrowedLocations.length === 1) {
    return narrowedLocations[0];
  }

  return null;
}

function matchByNameAndCity(input, locations) {
  if (!input.normalizedCity) {
    return null;
  }

  const matchedLocations = (locations || []).filter(function filterLocation(location) {
    return isMatchableStatus(location.status)
      && normalizeText(location.name) === input.normalizedName
      && normalizeText(location.city) === input.normalizedCity;
  });

  return chooseSingleMatch(input, matchedLocations);
}

function matchByNameAndAddress(input, locations) {
  if (!input.normalizedAddress) {
    return null;
  }

  const matchedLocations = (locations || []).filter(function filterLocation(location) {
    return isMatchableStatus(location.status)
      && normalizeText(location.name) === input.normalizedName
      && normalizeAddress(formatLocationAddress(location)) === input.normalizedAddress;
  });

  return chooseSingleMatch(input, matchedLocations);
}

function computeDedupeKey(input) {
  if (input.poiid) {
    return 'ensure_location:v1:poiid:' + createDigest([
      input.source,
      input.poiid,
    ].join('|'));
  }

  if (!input.normalizedAddress || (!input.normalizedCity && !input.normalizedProvince)) {
    return '';
  }

  return 'ensure_location:v1:text:' + createDigest([
    input.source,
    input.normalizedName,
    input.normalizedCity,
    input.normalizedProvince,
    input.normalizedAddress,
  ].join('|'));
}

function buildLocationDocument(input, openId, dedupeKey) {
  return {
    name: input.name,
    address: input.address,
    city: input.city,
    province: input.province,
    latitude: input.latitude,
    longitude: input.longitude,
    poiid: input.poiid,
    source: input.source,
    createdBy: openId || '',
    dedupeKey: dedupeKey,
    status: 'candidate',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  };
}

async function patchMatchedLocation(location, input) {
  if (!db || !location || !location._id) {
    return location;
  }

  const patchData = {
    updatedAt: db.serverDate(),
  };
  let shouldPatch = false;

  if (!trimString(location.address) && input.address) {
    patchData.address = input.address;
    shouldPatch = true;
  }

  if (!trimString(location.city) && input.city) {
    patchData.city = input.city;
    shouldPatch = true;
  }

  if (!trimString(location.province) && input.province) {
    patchData.province = input.province;
    shouldPatch = true;
  }

  if (!trimString(location.poiid) && input.poiid) {
    patchData.poiid = input.poiid;
    shouldPatch = true;
  }

  if (!trimString(location.source) && input.source) {
    patchData.source = input.source;
    shouldPatch = true;
  }

  if (!hasValidCoordinates(location.latitude, location.longitude)) {
    patchData.latitude = input.latitude;
    patchData.longitude = input.longitude;
    shouldPatch = true;
  }

  if (!shouldPatch) {
    return location;
  }

  await db.collection(LOCATIONS_COLLECTION).doc(location._id).update({
    data: patchData,
  });

  return Object.assign({}, location, {
    address: patchData.address || location.address,
    city: patchData.city || location.city,
    province: patchData.province || location.province,
    poiid: patchData.poiid || location.poiid,
    source: patchData.source || location.source,
    latitude: typeof patchData.latitude === 'number' ? patchData.latitude : location.latitude,
    longitude: typeof patchData.longitude === 'number' ? patchData.longitude : location.longitude,
  });
}

async function findExistingLocation(input) {
  if (input.poiid) {
    const poiidLocations = await listLocationsByPoiid(input.poiid);

    if (poiidLocations.length === 1) {
      return {
        location: poiidLocations[0],
        matchReason: '通过 poiid 复用已有正式地点',
      };
    }
  }

  const namedLocations = await listCandidateLocationsByName(input.name);
  const nameAndCityMatch = matchByNameAndCity(input, namedLocations);

  if (nameAndCityMatch) {
    return {
      location: nameAndCityMatch,
      matchReason: '通过名称和城市复用已有正式地点',
    };
  }

  const nameAndAddressMatch = matchByNameAndAddress(input, namedLocations);

  if (nameAndAddressMatch) {
    return {
      location: nameAndAddressMatch,
      matchReason: '通过名称和地址复用已有正式地点',
    };
  }

  return null;
}

async function createOrReuseCandidateLocation(input, openId, dedupeKey) {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new EnsureLocationError('CONFIG_ERROR', '地点服务暂时不可用，请稍后再试。');
  }

  const locationId = createLocationIdFromDedupeKey(dedupeKey);

  return db.runTransaction(async function createLocationTransaction(transaction) {
    const existingLocation = await safeGetDocument(transaction, LOCATIONS_COLLECTION, locationId);

    if (existingLocation) {
      return {
        location: normalizeLocationDoc(existingLocation),
        created: false,
        reused: true,
      };
    }

    const locationDoc = buildLocationDocument(input, openId, dedupeKey);

    await transaction.collection(LOCATIONS_COLLECTION).doc(locationId).set({
      data: locationDoc,
    });

    return {
      location: normalizeLocationDoc(Object.assign({
        _id: locationId,
      }, locationDoc)),
      created: true,
      reused: false,
    };
  });
}

async function ensureLocationIdentity(input, openId) {
  const matchedResult = await findExistingLocation(input);

  if (matchedResult && matchedResult.location) {
    const patchedLocation = await patchMatchedLocation(matchedResult.location, input);

    return {
      locationId: patchedLocation._id,
      isTemporary: false,
      fallbackToTemporary: false,
      fallbackReason: '',
      matchReason: matchedResult.matchReason,
      created: false,
      reused: true,
      status: patchedLocation.status,
      location: patchedLocation,
    };
  }

  const dedupeKey = computeDedupeKey(input);

  if (!dedupeKey) {
    return buildTemporaryFallback(input, '当前地点资料不足以安全建立正式地点身份，本次按临时地点处理。');
  }

  try {
    const createResult = await createOrReuseCandidateLocation(input, openId, dedupeKey);

    return {
      locationId: createResult.location._id,
      isTemporary: false,
      fallbackToTemporary: false,
      fallbackReason: '',
      matchReason: createResult.created
        ? '已为该微信选点建立新的正式地点身份'
        : '复用了已存在的候选地点身份',
      created: createResult.created,
      reused: createResult.reused,
      status: createResult.location.status,
      location: createResult.location,
    };
  } catch (error) {
    console.warn('[ensureLocation] create candidate failed, fallback to temporary', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : '',
      message: error && error.message ? error.message : '',
    });
    return buildTemporaryFallback(input, '正式地点创建失败，本次按临时地点处理。');
  }
}

exports.main = async function main(event) {
  try {
    const input = validateEvent(event);
    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    return buildSuccess(await ensureLocationIdentity(input, openId));
  } catch (error) {
    if (error instanceof EnsureLocationError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[ensureLocation] Unexpected error', error);
    return buildError('INTERNAL_ERROR', '地点确认失败，请稍后再试。');
  }
};

module.exports._private = {
  COORDINATE_AUXILIARY_DISTANCE_METERS: COORDINATE_AUXILIARY_DISTANCE_METERS,
  buildLocationDocument: buildLocationDocument,
  buildTemporaryFallback: buildTemporaryFallback,
  calculateDistanceMeters: calculateDistanceMeters,
  chooseSingleMatch: chooseSingleMatch,
  computeDedupeKey: computeDedupeKey,
  createOrReuseCandidateLocation: createOrReuseCandidateLocation,
  createLocationIdFromDedupeKey: createLocationIdFromDedupeKey,
  ensureLocationIdentity: ensureLocationIdentity,
  findExistingLocation: findExistingLocation,
  formatLocationAddress: formatLocationAddress,
  matchByNameAndAddress: matchByNameAndAddress,
  matchByNameAndCity: matchByNameAndCity,
  narrowMatchesByCoordinate: narrowMatchesByCoordinate,
  normalizeAddress: normalizeAddress,
  normalizeLocationDoc: normalizeLocationDoc,
  normalizeText: normalizeText,
  validateEvent: validateEvent,
};
