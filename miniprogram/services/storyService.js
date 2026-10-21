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
const CONTENT_NOT_AVAILABLE_CODE = 'CONTENT_NOT_AVAILABLE';
const CONTENT_NOT_AVAILABLE_MESSAGE = '该内容暂不可查看。';
const TITLE_MAX_LENGTH = 40;
const CONTENT_MAX_LENGTH = 2000;
const EDITABLE_MY_STORY_STATUSES = {
  pending: true,
  rejected: true,
};
const DELETABLE_MY_STORY_STATUSES = {
  rejected: true,
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
    updatedAt: doc.updatedAt,
    storyMeta: doc.storyMeta || null,
    isTemporary: !!doc.isTemporary,
    placeSnapshot: doc.placeSnapshot || null,
    poolCycle: doc.poolCycle || '',
    poolStatus: doc.poolStatus || '',
    archivedAt: doc.archivedAt || null,
  };
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createServiceError(code, message) {
  const error = new Error(message);

  if (code) {
    error.code = code;
  }

  return error;
}

function createContentNotAvailableError() {
  return createServiceError(CONTENT_NOT_AVAILABLE_CODE, CONTENT_NOT_AVAILABLE_MESSAGE);
}

function padNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '00';
  }

  return numericValue < 10 ? '0' + numericValue : String(numericValue);
}

function normalizeDateInputToTimestamp(value) {
  if (!value && value !== 0) {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue) && value.trim()) {
      return numericValue;
    }

    const parsedTimestamp = Date.parse(value);
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : null;
  }

  if (typeof value === 'object') {
    if (typeof value.$date !== 'undefined') {
      return normalizeDateInputToTimestamp(value.$date);
    }

    if (typeof value.toDate === 'function') {
      return normalizeDateInputToTimestamp(value.toDate());
    }

    if (typeof value._seconds !== 'undefined') {
      const seconds = Number(value._seconds);
      const nanos = Number(value._nanoseconds || 0);

      if (Number.isFinite(seconds) && Number.isFinite(nanos)) {
        return seconds * 1000 + Math.floor(nanos / 1000000);
      }
    }

    if (typeof value.seconds !== 'undefined') {
      const seconds = Number(value.seconds);
      const nanos = Number(value.nanoseconds || 0);

      if (Number.isFinite(seconds) && Number.isFinite(nanos)) {
        return seconds * 1000 + Math.floor(nanos / 1000000);
      }
    }
  }

  return null;
}

function pickStorySubmissionTimeValue(valueOrStory) {
  if (
    valueOrStory
    && typeof valueOrStory === 'object'
    && (
      Object.prototype.hasOwnProperty.call(valueOrStory, 'updatedAt')
      || Object.prototype.hasOwnProperty.call(valueOrStory, 'createdAt')
    )
  ) {
    const updatedAt = typeof valueOrStory.updatedAt === 'undefined' ? null : valueOrStory.updatedAt;
    return updatedAt || valueOrStory.createdAt || null;
  }

  return valueOrStory;
}

function formatStorySubmissionTime(valueOrStory) {
  const timestamp = normalizeDateInputToTimestamp(pickStorySubmissionTimeValue(valueOrStory));

  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    date.getFullYear(),
    '年',
    padNumber(date.getMonth() + 1),
    '月',
    padNumber(date.getDate()),
    '日 ',
    padNumber(date.getHours()),
    ':',
    padNumber(date.getMinutes()),
  ].join('');
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

function isPublishedStory(doc) {
  return trimString(doc && doc.status) === 'published';
}

function normalizeRejectionReason(value) {
  return trimString(value);
}

function normalizeStoryDetail(story) {
  return {
    id: story.id || story._id || '',
    title: story.title || '',
    content: story.content || '',
    summary: story.summary || '',
    status: story.status || 'pending',
    statusLabel: story.statusLabel || normalizeMyStoryStatus(story.status),
    rejectionReason: normalizeRejectionReason(story.rejectionReason),
    locationId: typeof story.locationId === 'string' && story.locationId.trim() ? story.locationId.trim() : null,
    isTemporary: !!story.isTemporary,
    placeSnapshot: story.placeSnapshot && typeof story.placeSnapshot === 'object' ? story.placeSnapshot : null,
    locationName: story.locationName || '',
    createdAt: typeof story.createdAt === 'undefined' ? null : story.createdAt,
    updatedAt: typeof story.updatedAt === 'undefined' ? null : story.updatedAt,
  };
}

function canEditMyStory(status) {
  return !!EDITABLE_MY_STORY_STATUSES[trimString(status)];
}

function canDeleteMyStory(status) {
  return !!DELETABLE_MY_STORY_STATUSES[trimString(status)];
}

async function callCloudFunction(name, data, deployMessage, fallbackMessage) {
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    throw createServiceError('INTERNAL_ERROR', fallbackMessage || '服务暂时不可用，请稍后再试。');
  }

  try {
    const result = await new Promise(function invokeCloudFunction(resolve, reject) {
      wx.cloud.callFunction({
        name: name,
        data: data || {},
        success: resolve,
        fail: reject,
      });
    });
    const functionResult = result && result.result ? result.result : null;

    if (!functionResult || typeof functionResult.ok !== 'boolean') {
      throw createServiceError('DEPLOY_REQUIRED', deployMessage);
    }

    if (functionResult.ok !== true) {
      const errorCode = functionResult && functionResult.error && functionResult.error.code
        ? functionResult.error.code
        : 'INTERNAL_ERROR';
      const message = functionResult && functionResult.error && functionResult.error.message
        ? functionResult.error.message
        : (fallbackMessage || '服务暂时不可用，请稍后再试。');
      throw createServiceError(errorCode, message);
    }

    return functionResult;
  } catch (error) {
    const rawMessage = error && error.message ? String(error.message) : '';

    if (
      rawMessage.indexOf('FunctionName parameter could not be found') !== -1
      || rawMessage.indexOf('找不到') !== -1
      || rawMessage.indexOf('not found') !== -1
    ) {
      throw createServiceError('DEPLOY_REQUIRED', deployMessage);
    }

    throw createServiceError(
      error && error.code ? String(error.code) : 'INTERNAL_ERROR',
      rawMessage || fallbackMessage || '服务暂时不可用，请稍后再试。'
    );
  }
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

    if (!result.data || !isPublishedStory(result.data)) {
      throw createContentNotAvailableError();
    }

    return normalizeStory(result.data);
  } catch (error) {
    if (error && error.code === CONTENT_NOT_AVAILABLE_CODE) {
      throw error;
    }

    const rawMessage = error && error.message ? String(error.message) : '';

    if (
      rawMessage.indexOf('does not exist') !== -1
      || rawMessage.indexOf('non-existent') !== -1
      || rawMessage.indexOf('document.get:fail') !== -1
      || rawMessage.indexOf('not exist') !== -1
      || rawMessage.indexOf('not found') !== -1
    ) {
      throw createContentNotAvailableError();
    }

    throw createServiceError('INTERNAL_ERROR', '故事加载失败，请稍后再试。');
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
        type: 'traveler',
        source: 'user',
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    const userStories = result.data || [];

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
        type: 'traveler',
        source: 'user',
        status: 'published',
      })
      .orderBy('createdAt', 'desc')
      .get();

    return (result.data || []).map(normalizeStory);
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

  const functionResult = await callCloudFunction(
    'submitStory',
    {
      locationId: locationId,
      isTemporary: isTemporary,
      placeSnapshot: placeSnapshot,
      title: title,
      content: content,
    },
    '投稿服务尚未更新，请重新部署 submitStory 云函数。',
    '投稿提交失败，请稍后再试。'
  );

  if (!functionResult.storyId) {
    throw createServiceError('INTERNAL_ERROR', '投稿提交失败，请稍后再试。');
  }

  return {
    storyId: functionResult.storyId,
    status: functionResult.status || 'pending',
    message: functionResult.message || '投稿已提交，审核通过后会展示。',
  };
}

function normalizeMyStoryStatus(status) {
  if (status === 'published') {
    return '已通过';
  }

  if (status === 'rejected') {
    return '未通过';
  }

  if (status === 'hidden') {
    return '已隐藏';
  }

  if (status === 'deleted') {
    return '已删除';
  }

  return '审核中';
}

async function getMyStories() {
  const functionResult = await callCloudFunction(
    'getMyStories',
    {},
    '投稿记录服务尚未更新，请重新部署 getMyStories 云函数。',
    '投稿记录读取失败，请稍后再试。'
  );

  return (functionResult.stories || []).map(function normalizeMyStory(story) {
    return normalizeStoryDetail({
      id: story._id || story.id,
      title: story.title || '',
      content: story.content || '',
      summary: story.summary || '',
      status: story.status || 'pending',
      statusLabel: story.statusLabel || normalizeMyStoryStatus(story.status),
      rejectionReason: story.rejectionReason,
      locationId: story.locationId,
      isTemporary: story.isTemporary,
      placeSnapshot: story.placeSnapshot,
      locationName: story.locationName || '',
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    });
  });
}

async function getMyStoryById(storyId) {
  const normalizedStoryId = trimString(storyId);

  if (!normalizedStoryId) {
    throw createServiceError('INVALID_INPUT', '缺少有效的投稿标识。');
  }

  const functionResult = await callCloudFunction(
    'getMyStoryById',
    {
      storyId: normalizedStoryId,
    },
    '投稿详情服务尚未更新，请重新部署 getMyStoryById 云函数。',
    '投稿详情读取失败，请稍后再试。'
  );

  if (!functionResult.story || !functionResult.story.id) {
    throw createServiceError('INTERNAL_ERROR', '投稿详情读取失败，请稍后再试。');
  }

  return normalizeStoryDetail(functionResult.story);
}

async function updateTravelerStory(payload) {
  const storyId = trimString(payload && payload.storyId);
  const title = trimString(payload && payload.title);
  const content = trimString(payload && payload.content);

  if (!storyId) {
    throw createServiceError('INVALID_INPUT', '缺少有效的投稿标识。');
  }

  if (!title) {
    throw createServiceError('INVALID_INPUT', '请输入故事标题。');
  }

  if (!content) {
    throw createServiceError('INVALID_INPUT', '请输入故事正文。');
  }

  if (title.length > TITLE_MAX_LENGTH) {
    throw createServiceError('INVALID_INPUT', '标题请控制在 40 字以内。');
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw createServiceError('INVALID_INPUT', '正文请控制在 2000 字以内。');
  }

  const functionResult = await callCloudFunction(
    'submitStory',
    {
      storyId: storyId,
      title: title,
      content: content,
    },
    '投稿服务尚未更新，请重新部署 submitStory 云函数。',
    '投稿修改失败，请稍后再试。'
  );

  if (!functionResult.storyId) {
    throw createServiceError('INTERNAL_ERROR', '投稿修改失败，请稍后再试。');
  }

  return {
    storyId: functionResult.storyId,
    status: functionResult.status || 'pending',
    updated: !!functionResult.updated,
    message: functionResult.message || '修改已提交，审核通过后会展示。',
  };
}

async function deleteMyStory(storyId) {
  const normalizedStoryId = trimString(storyId);

  if (!normalizedStoryId) {
    throw createServiceError('INVALID_INPUT', '缺少有效的投稿标识。');
  }

  const functionResult = await callCloudFunction(
    'deleteMyStory',
    {
      storyId: normalizedStoryId,
    },
    '删除服务尚未更新，请重新部署 deleteMyStory 云函数。',
    '投稿删除失败，请稍后再试。'
  );

  if (!functionResult.storyId || functionResult.deleted !== true) {
    throw createServiceError('INTERNAL_ERROR', '投稿删除失败，请稍后再试。');
  }

  return {
    storyId: functionResult.storyId,
    deleted: true,
  };
}

module.exports = {
  canDeleteMyStory,
  canEditMyStory,
  deleteMyStory,
  formatStorySubmissionTime,
  getStoryById,
  getStoryByType,
  getMyStoryById,
  getRandomPresetStoryByLocationAndType,
  getRandomStoryByLocationAndType,
  getRandomUserStoryByLocation,
  listPublishedUserStoriesByLocation,
  getMyStories,
  submitTravelerStory,
  updateTravelerStory,
  listStories,
  listStoriesByLocation,
};

module.exports._private = {
  CONTENT_MAX_LENGTH: CONTENT_MAX_LENGTH,
  DELETABLE_MY_STORY_STATUSES: DELETABLE_MY_STORY_STATUSES,
  EDITABLE_MY_STORY_STATUSES: EDITABLE_MY_STORY_STATUSES,
  TITLE_MAX_LENGTH: TITLE_MAX_LENGTH,
  callCloudFunction: callCloudFunction,
  canDeleteMyStory: canDeleteMyStory,
  canEditMyStory: canEditMyStory,
  formatStorySubmissionTime: formatStorySubmissionTime,
  normalizeDateInputToTimestamp: normalizeDateInputToTimestamp,
  normalizeMyStoryStatus: normalizeMyStoryStatus,
  normalizeStoryDetail: normalizeStoryDetail,
  pickStorySubmissionTimeValue: pickStorySubmissionTimeValue,
};
