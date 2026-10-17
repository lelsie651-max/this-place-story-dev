const crypto = require('crypto');
const https = require('https');

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
const AI_USAGE_DAILY_COLLECTION = 'ai_usage_daily';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_CHAT_PATH = '/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-flash';
const AI_GUARD_LIMITS = {
  GLOBAL_DAILY_LIMIT: 200,
  REQUEST_TIMEOUT_MS: 60000,
  MAX_PROVIDER_INPUT_CHARS: 500,
  MAX_PROVIDER_OUTPUT_TOKENS: 1200,
  MAX_LOCATION_ID_LENGTH: 128,
  MAX_LOCATION_NAME_LENGTH: 80,
  MAX_LOCATION_DESCRIPTION_LENGTH: 300,
  MAX_CITY_LENGTH: 40,
  MAX_TITLE_LENGTH: 80,
  MAX_CONTENT_LENGTH: 2000,
  REQUEST_LOCK_WINDOW_MS: 70000,
};
const SUPPORTED_STORY_TYPES = {
  AI说: true,
  民间传说: true,
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  CONFIG_ERROR: true,
  UNAUTHORIZED: true,
  AI_GLOBAL_LIMIT: true,
  AI_CIRCUIT_OPEN: true,
  AI_REQUEST_IN_PROGRESS: true,
  AI_TIMEOUT: true,
  AI_PROVIDER_ERROR: true,
  NORMALIZATION_ERROR: true,
};

class GenerateStoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GenerateStoryError';
    this.code = code;
  }
}

function buildSuccess(story) {
  return {
    ok: true,
    story: story,
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

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWhitespace(value) {
  return trimString(value).replace(/\s+/g, ' ');
}

function validateLength(value, maxLength, fieldName) {
  if (value.length > maxLength) {
    throw new GenerateStoryError('INVALID_INPUT', fieldName + ' 长度超出限制');
  }
}

function getNumericValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function createDigest(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}

function getUsageDateKey(nowMs) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(typeof nowMs === 'number' ? nowMs : Date.now()));
}

function buildGlobalUsageDocId(dateKey) {
  return 'global__' + dateKey;
}

function buildUserUsageDocId(dateKey, userId) {
  return 'user__' + dateKey + '__' + createDigest(userId).slice(0, 24);
}

function isMissingDocumentError(error) {
  const message = error && error.message ? String(error.message) : '';

  return (
    message.indexOf('does not exist') !== -1
    || message.indexOf('non-existent') !== -1
    || message.indexOf('document.get:fail') !== -1
  );
}

async function safeGetDocument(actor, collectionName, docId) {
  try {
    const result = await actor.collection(collectionName).doc(docId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isMissingDocumentError(error)) {
      return null;
    }

    throw error;
  }
}

function buildUserUsageDocument(options) {
  const existing = isPlainObject(options.existing) ? options.existing : {};

  return {
    scope: 'user',
    date: options.dateKey,
    userId: options.userId,
    userCount: typeof options.userCount === 'number' ? options.userCount : getNumericValue(existing.userCount),
    globalCount: 0,
    updatedAt: db.serverDate(),
    requestLockUntil: typeof options.requestLockUntil === 'number'
      ? options.requestLockUntil
      : getNumericValue(existing.requestLockUntil),
    activeRequestHash: typeof options.activeRequestHash === 'string'
      ? options.activeRequestHash
      : trimString(existing.activeRequestHash),
    lastRequestAt: typeof options.lastRequestAt === 'number'
      ? options.lastRequestAt
      : getNumericValue(existing.lastRequestAt),
    lastUsageAt: typeof options.lastUsageAt === 'number'
      ? options.lastUsageAt
      : getNumericValue(existing.lastUsageAt),
  };
}

function buildGlobalUsageDocument(options) {
  const existing = isPlainObject(options.existing) ? options.existing : {};

  return {
    scope: 'global',
    date: options.dateKey,
    userId: '',
    userCount: 0,
    globalCount: typeof options.globalCount === 'number' ? options.globalCount : getNumericValue(existing.globalCount),
    updatedAt: db.serverDate(),
    lastUsageAt: typeof options.lastUsageAt === 'number'
      ? options.lastUsageAt
      : getNumericValue(existing.lastUsageAt),
  };
}

function createRequestHash(input) {
  return createDigest(JSON.stringify({
    locationId: input.locationId || null,
    locationName: input.locationName || '',
    locationDescription: input.locationDescription || '',
    city: input.city || '',
    type: input.type || '',
    isTemporary: !!input.isTemporary,
    selectedPlace: input.selectedPlace || null,
  }));
}

function normalizeSelectedPlace(selectedPlace) {
  if (!isPlainObject(selectedPlace)) {
    throw new GenerateStoryError('INVALID_INPUT', '临时地点缺少 selectedPlace');
  }

  const name = normalizeWhitespace(selectedPlace.name || '');
  const address = trimString(selectedPlace.address || '');
  const poiid = trimString(selectedPlace.poiid || '');
  const latitude = Number(selectedPlace.latitude);
  const longitude = Number(selectedPlace.longitude);

  if (!name) {
    throw new GenerateStoryError('INVALID_INPUT', '临时地点名称不能为空');
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new GenerateStoryError('INVALID_INPUT', '临时地点坐标无效');
  }

  return {
    name: name,
    address: address,
    latitude: latitude,
    longitude: longitude,
    poiid: poiid,
  };
}

function validateProviderInputLength(input) {
  const totalLength = [
    input.locationName,
    input.locationDescription,
    input.city,
    input.type,
  ]
    .map(function mapText(value) {
      return trimString(value);
    })
    .join('')
    .length;

  if (totalLength > AI_GUARD_LIMITS.MAX_PROVIDER_INPUT_CHARS) {
    throw new GenerateStoryError('INVALID_INPUT', '单次地点信息长度超出限制');
  }
}

function validateEvent(event) {
  if (!isPlainObject(event)) {
    throw new GenerateStoryError('INVALID_INPUT', '故事生成参数格式不正确');
  }

  if (typeof event.isTemporary !== 'undefined' && !isBoolean(event.isTemporary)) {
    throw new GenerateStoryError('INVALID_INPUT', 'isTemporary 必须是布尔值');
  }

  if (
    typeof event.locationId !== 'undefined'
    && event.locationId !== null
    && typeof event.locationId !== 'string'
  ) {
    throw new GenerateStoryError('INVALID_INPUT', 'locationId 必须是字符串或空值');
  }

  if (typeof event.locationName !== 'string') {
    throw new GenerateStoryError('INVALID_INPUT', 'locationName 必须是字符串');
  }

  if (typeof event.type !== 'string') {
    throw new GenerateStoryError('INVALID_INPUT', 'type 必须是字符串');
  }

  if (
    typeof event.locationDescription !== 'undefined'
    && event.locationDescription !== null
    && typeof event.locationDescription !== 'string'
  ) {
    throw new GenerateStoryError('INVALID_INPUT', 'locationDescription 必须是字符串');
  }

  if (typeof event.city !== 'undefined' && event.city !== null && typeof event.city !== 'string') {
    throw new GenerateStoryError('INVALID_INPUT', 'city 必须是字符串');
  }

  const isTemporary = event.isTemporary === true;
  const locationId = typeof event.locationId === 'string' ? trimString(event.locationId) : '';
  const locationName = normalizeWhitespace(event.locationName);
  const locationDescription = trimString(event.locationDescription || '');
  const city = normalizeWhitespace(event.city || '');
  const type = trimString(event.type);
  let selectedPlace = null;

  if (!locationName) {
    throw new GenerateStoryError('INVALID_INPUT', 'locationName 不能为空');
  }

  if (!SUPPORTED_STORY_TYPES[type]) {
    throw new GenerateStoryError('INVALID_INPUT', '当前仅支持 AI说 或 民间传说');
  }

  if (isTemporary) {
    if (event.locationId !== null) {
      throw new GenerateStoryError('INVALID_INPUT', '临时地点的 locationId 必须为 null');
    }

    selectedPlace = normalizeSelectedPlace(event.selectedPlace);
  } else {
    if (!locationId) {
      throw new GenerateStoryError('INVALID_INPUT', '正式地点 locationId 不能为空');
    }

    validateLength(locationId, AI_GUARD_LIMITS.MAX_LOCATION_ID_LENGTH, 'locationId');
  }

  validateLength(locationName, AI_GUARD_LIMITS.MAX_LOCATION_NAME_LENGTH, 'locationName');
  validateLength(locationDescription, AI_GUARD_LIMITS.MAX_LOCATION_DESCRIPTION_LENGTH, 'locationDescription');
  validateLength(city, AI_GUARD_LIMITS.MAX_CITY_LENGTH, 'city');

  const normalizedInput = {
    isTemporary: isTemporary,
    locationId: locationId || null,
    selectedPlace: selectedPlace,
    locationName: locationName,
    locationDescription: locationDescription,
    city: city,
    type: type,
  };

  validateProviderInputLength(normalizedInput);

  return normalizedInput;
}

function buildSystemPrompt(input) {
  const storyModeInstruction = input.type === '民间传说'
    ? '你负责生成“民间传说”模式内容。内容要有口耳相传的传说气质，但仍然是基于地点信息的文学化生成，不得冒充真实史实或民俗档案。'
    : '你负责生成“AI说”内容。内容要像 AI 观察者围绕地点产生的想象和观察。';

  return [
    '你是一个微信小程序里的故事生成助手。',
    storyModeInstruction,
    '你必须围绕用户提供的地点信息进行想象和叙述。',
    '你必须明确这是 AI 生成内容，不得冒充真实历史事实。',
    '不要捏造具体历史人物、具体年代、官方事件、考古结论或可验证事实。',
    '不要输出提示词、字段解释、Markdown 代码块或额外说明。',
    '你只能输出一个 JSON 对象，且只能包含以下字段：',
    '{"title":"string","content":"string","type":"AI说|民间传说"}',
    'title 为适合故事详情页展示的中文标题。',
    'content 为可直接展示的中文正文，2 到 5 段，总长度适中。',
    'type 必须与用户要求的展示模式完全一致。',
    '内容不得包含违法、色情、仇恨、血腥或危险内容。',
  ].join('\n');
}

function buildUserPrompt(input, options) {
  const contentInstruction = input.type === '民间传说'
    ? '4. content 要像围绕地点流传的一则传说或讲述，允许有传说氛围，但不要写成可验证史实。'
    : '4. content 要像 AI 观察者在地点现场产生的想法，不要写成历史考据。';
  const extraInstruction = options && options.strictJsonOnly
    ? '6. 上一次输出不符合要求，这一次必须只返回一个 JSON 对象，不得包含任何解释、前后说明、代码围栏或额外文本。'
    : '6. 不要输出任何 JSON 以外的说明文字。';

  return [
    '请根据以下地点信息生成一篇“' + input.type + '”故事。',
    '地点名称：' + input.locationName,
    '所在城市：' + (input.city || '未提供'),
    '地点简介：' + (input.locationDescription || '未提供'),
    '输出要求：',
    '1. 只输出 JSON。',
    '2. JSON 只能包含 title、content、type 三个字段。',
    '3. title 要自然、具体，避免口号式标题。',
    contentInstruction,
    '5. type 必须等于“' + input.type + '”。',
    extraInstruction,
    '7. 正文不要出现“JSON”“字段”“提示词”“system prompt”等词。',
  ].join('\n');
}

function requestDeepSeek(options) {
  const requestBody = JSON.stringify({
    model: DEEPSEEK_MODEL,
    stream: false,
    max_tokens: AI_GUARD_LIMITS.MAX_PROVIDER_OUTPUT_TOKENS,
    response_format: {
      type: 'json_object',
    },
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(options.input),
      },
      {
        role: 'user',
        content: buildUserPrompt(options.input, {
          strictJsonOnly: !!options.strictJsonOnly,
        }),
      },
    ],
  });

  return new Promise(function executor(resolve, reject) {
    const request = https.request(
      DEEPSEEK_BASE_URL + DEEPSEEK_CHAT_PATH,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          Authorization: 'Bearer ' + options.apiKey,
        },
      },
      function onResponse(response) {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', function onData(chunk) {
          responseBody += chunk;
        });
        response.on('end', function onEnd() {
          if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
            console.error('[generateStory] Provider HTTP error', {
              statusCode: response.statusCode,
            });
            reject(new GenerateStoryError('AI_PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试'));
            return;
          }

          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            console.error('[generateStory] Provider response parse failed');
            reject(new GenerateStoryError('AI_PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试'));
          }
        });
      }
    );

    request.setTimeout(options.timeoutMs, function onTimeout() {
      request.destroy(new GenerateStoryError('AI_TIMEOUT', '故事生成超时，请稍后再试'));
    });

    request.on('error', function onError(error) {
      if (error instanceof GenerateStoryError) {
        reject(error);
        return;
      }

      console.error('[generateStory] Provider request failed', {
        name: error && error.name ? error.name : 'Error',
      });
      reject(new GenerateStoryError('AI_PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试'));
    });

    request.write(requestBody);
    request.end();
  });
}

function extractProviderMessage(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果格式不正确');
  }

  const firstChoice = payload.choices[0];
  const message = isPlainObject(firstChoice && firstChoice.message) ? firstChoice.message : null;
  const content = message && typeof message.content === 'string' ? message.content : '';

  if (!content) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果格式不正确');
  }

  return content;
}

function stripCodeFence(value) {
  return trimString(String(value || ''))
    .replace(/```json/ig, '```')
    .replace(/```/g, '')
    .trim();
}

function extractJsonText(value) {
  const text = stripCodeFence(trimString(String(value || '')));
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果格式不正确');
  }

  return text.slice(startIndex, endIndex + 1);
}

function normalizeStoryPayload(rawContent, expectedType) {
  const responseText = trimString(String(rawContent || ''));
  let parsed = null;

  try {
    parsed = JSON.parse(extractJsonText(responseText));
  } catch (error) {
    if (error instanceof GenerateStoryError) {
      throw error;
    }

    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果不是有效 JSON');
  }

  if (!isPlainObject(parsed)) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果格式不正确');
  }

  const title = normalizeWhitespace(parsed.title);
  const content = trimString(parsed.content);
  const type = normalizeWhitespace(parsed.type || expectedType || '');

  if (!title || !content || !type) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果缺少标题或正文');
  }

  if (!SUPPORTED_STORY_TYPES[type]) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果缺少有效类型');
  }

  if (expectedType && type !== expectedType) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果类型与请求不一致');
  }

  validateLength(title, AI_GUARD_LIMITS.MAX_TITLE_LENGTH, 'title');
  validateLength(content, AI_GUARD_LIMITS.MAX_CONTENT_LENGTH, 'content');

  return {
    title: title,
    content: content,
    type: type,
  };
}

function isCircuitOpen() {
  const value = trimString(process.env.AI_CIRCUIT_OPEN).toLowerCase();
  return value === '1' || value === 'true' || value === 'open' || value === 'on';
}

function ensureDatabaseAvailable() {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new GenerateStoryError('CONFIG_ERROR', 'AI服务暂未配置');
  }
}

async function acquireRequestLock(input, userId) {
  ensureDatabaseAvailable();

  const nowMs = Date.now();
  const dateKey = getUsageDateKey(nowMs);
  const requestHash = createRequestHash(input);
  const userDocId = buildUserUsageDocId(dateKey, userId);

  try {
    await db.runTransaction(async function lockTransaction(transaction) {
      const existingUserDoc = await safeGetDocument(transaction, AI_USAGE_DAILY_COLLECTION, userDocId);
      const requestLockUntil = getNumericValue(existingUserDoc && existingUserDoc.requestLockUntil);

      if (requestLockUntil > nowMs) {
        throw new GenerateStoryError('AI_REQUEST_IN_PROGRESS', '故事生成处理中，请稍后再试');
      }

      const userDoc = buildUserUsageDocument({
        existing: existingUserDoc,
        dateKey: dateKey,
        userId: userId,
        requestLockUntil: nowMs + AI_GUARD_LIMITS.REQUEST_LOCK_WINDOW_MS,
        activeRequestHash: requestHash,
        lastRequestAt: nowMs,
      });

      if (existingUserDoc) {
        await transaction.collection(AI_USAGE_DAILY_COLLECTION).doc(userDocId).update({
          data: userDoc,
        });
      } else {
        await transaction.collection(AI_USAGE_DAILY_COLLECTION).doc(userDocId).set({
          data: Object.assign({
            createdAt: db.serverDate(),
          }, userDoc),
        });
      }
    });
  } catch (error) {
    if (error instanceof GenerateStoryError) {
      throw error;
    }

    console.error('[generateStory] Failed to acquire request lock', {
      name: error && error.name ? error.name : 'Error',
    });
    throw new GenerateStoryError('AI_PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试');
  }

  return {
    dateKey: dateKey,
    userId: userId,
    userDocId: userDocId,
    globalDocId: buildGlobalUsageDocId(dateKey),
    requestHash: requestHash,
  };
}

async function releaseRequestLock(lockToken) {
  if (!db || !lockToken || !lockToken.userDocId) {
    return;
  }

  try {
    const result = await db.collection(AI_USAGE_DAILY_COLLECTION).doc(lockToken.userDocId).get();
    const currentDoc = result && result.data ? result.data : null;

    if (!currentDoc || trimString(currentDoc.activeRequestHash) !== lockToken.requestHash) {
      return;
    }

    await db.collection(AI_USAGE_DAILY_COLLECTION).doc(lockToken.userDocId).update({
      data: {
        requestLockUntil: 0,
        activeRequestHash: '',
        updatedAt: db.serverDate(),
      },
    });
  } catch (error) {
    console.warn('[generateStory] Failed to release request lock', {
      name: error && error.name ? error.name : 'Error',
    });
  }
}

async function consumeAiQuota(lockToken) {
  ensureDatabaseAvailable();

  const nowMs = Date.now();

  try {
    return await db.runTransaction(async function quotaTransaction(transaction) {
      const existingUserDoc = await safeGetDocument(transaction, AI_USAGE_DAILY_COLLECTION, lockToken.userDocId);
      const existingGlobalDoc = await safeGetDocument(transaction, AI_USAGE_DAILY_COLLECTION, lockToken.globalDocId);

      if (!existingUserDoc || trimString(existingUserDoc.activeRequestHash) !== lockToken.requestHash) {
        throw new GenerateStoryError('AI_REQUEST_IN_PROGRESS', '故事生成处理中，请稍后再试');
      }

      const userCount = getNumericValue(existingUserDoc.userCount);
      const globalCount = getNumericValue(existingGlobalDoc && existingGlobalDoc.globalCount);

      if (globalCount >= AI_GUARD_LIMITS.GLOBAL_DAILY_LIMIT) {
        throw new GenerateStoryError('AI_GLOBAL_LIMIT', '当前 AI 服务较忙，请稍后再试。');
      }

      const userDoc = buildUserUsageDocument({
        existing: existingUserDoc,
        dateKey: lockToken.dateKey,
        userId: lockToken.userId,
        userCount: userCount + 1,
        requestLockUntil: getNumericValue(existingUserDoc.requestLockUntil),
        activeRequestHash: trimString(existingUserDoc.activeRequestHash),
        lastRequestAt: getNumericValue(existingUserDoc.lastRequestAt),
        lastUsageAt: nowMs,
      });
      const globalDoc = buildGlobalUsageDocument({
        existing: existingGlobalDoc,
        dateKey: lockToken.dateKey,
        globalCount: globalCount + 1,
        lastUsageAt: nowMs,
      });

      await transaction.collection(AI_USAGE_DAILY_COLLECTION).doc(lockToken.userDocId).update({
        data: userDoc,
      });

      if (existingGlobalDoc) {
        await transaction.collection(AI_USAGE_DAILY_COLLECTION).doc(lockToken.globalDocId).update({
          data: globalDoc,
        });
      } else {
        await transaction.collection(AI_USAGE_DAILY_COLLECTION).doc(lockToken.globalDocId).set({
          data: Object.assign({
            createdAt: db.serverDate(),
          }, globalDoc),
        });
      }

      return {
        userCount: userCount + 1,
        globalCount: globalCount + 1,
      };
    });
  } catch (error) {
    if (error instanceof GenerateStoryError) {
      throw error;
    }

    console.error('[generateStory] Failed to consume AI quota', {
      name: error && error.name ? error.name : 'Error',
    });
    throw new GenerateStoryError('AI_PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试');
  }
}

async function requestAndNormalizeStory(options) {
  const requestFn = typeof options.requestFn === 'function' ? options.requestFn : requestDeepSeek;

  await consumeAiQuota(options.lockToken);

  const providerResponse = await requestFn({
    apiKey: options.apiKey,
    input: options.input,
    timeoutMs: options.timeoutMs,
    strictJsonOnly: !!options.strictJsonOnly,
  });
  const providerMessage = extractProviderMessage(providerResponse);

  return normalizeStoryPayload(providerMessage, options.input.type);
}

async function generateNormalizedStoryWithRetry(options) {
  const requestFn = typeof options.requestFn === 'function' ? options.requestFn : requestDeepSeek;

  try {
    return await requestAndNormalizeStory({
      apiKey: options.apiKey,
      input: options.input,
      timeoutMs: options.timeoutMs,
      strictJsonOnly: false,
      requestFn: requestFn,
      lockToken: options.lockToken,
    });
  } catch (error) {
    if (!(error instanceof GenerateStoryError) || error.code !== 'NORMALIZATION_ERROR') {
      throw error;
    }

    console.warn('[generateStory] Story normalization failed, retrying once', {
      locationName: options.input.locationName,
      type: options.input.type,
      isTemporary: options.input.isTemporary,
    });

    try {
      return await requestAndNormalizeStory({
        apiKey: options.apiKey,
        input: options.input,
        timeoutMs: options.timeoutMs,
        strictJsonOnly: true,
        requestFn: requestFn,
        lockToken: options.lockToken,
      });
    } catch (retryError) {
      if (retryError instanceof GenerateStoryError && retryError.code === 'NORMALIZATION_ERROR') {
        console.error('[generateStory] Story normalization failed after retry', {
          locationName: options.input.locationName,
          type: options.input.type,
          isTemporary: options.input.isTemporary,
        });
        throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI故事暂时生成失败，请稍后再试');
      }

      throw retryError;
    }
  }
}

function createGeneratedStoryId() {
  return 'generated-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

async function main(event) {
  let requestLockToken = null;

  try {
    const input = validateEvent(event);
    const apiKey = trimString(process.env.DEEPSEEK_API_KEY);

    if (!apiKey) {
      console.error('[generateStory] Missing DEEPSEEK_API_KEY configuration');
      return buildError('CONFIG_ERROR', 'AI服务暂未配置');
    }

    if (isCircuitOpen()) {
      return buildError('AI_CIRCUIT_OPEN', 'AI故事服务暂时维护中');
    }

    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openId = trimString(wxContext && wxContext.OPENID);

    if (!openId) {
      return buildError('UNAUTHORIZED', '当前用户身份读取失败，请稍后再试。');
    }

    requestLockToken = await acquireRequestLock(input, openId);

    const normalizedStory = await generateNormalizedStoryWithRetry({
      apiKey: apiKey,
      input: input,
      timeoutMs: AI_GUARD_LIMITS.REQUEST_TIMEOUT_MS,
      lockToken: requestLockToken,
    });

    return buildSuccess({
      storyId: createGeneratedStoryId(),
      isTemporary: input.isTemporary,
      locationId: input.locationId,
      selectedPlace: input.selectedPlace,
      type: input.type,
      title: normalizedStory.title,
      content: normalizedStory.content,
      source: 'deepseek',
    });
  } catch (error) {
    if (error instanceof GenerateStoryError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[generateStory] Unexpected error', {
      name: error && error.name ? error.name : 'Error',
    });
    return buildError('AI_PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试');
  } finally {
    await releaseRequestLock(requestLockToken);
  }
}

module.exports = {
  main: main,
  _private: {
    AI_GUARD_LIMITS: AI_GUARD_LIMITS,
    AI_USAGE_DAILY_COLLECTION: AI_USAGE_DAILY_COLLECTION,
    ALLOWED_ERROR_CODES: ALLOWED_ERROR_CODES,
    DEEPSEEK_BASE_URL: DEEPSEEK_BASE_URL,
    DEEPSEEK_CHAT_PATH: DEEPSEEK_CHAT_PATH,
    DEEPSEEK_MODEL: DEEPSEEK_MODEL,
    GenerateStoryError: GenerateStoryError,
    acquireRequestLock: acquireRequestLock,
    buildError: buildError,
    buildGlobalUsageDocId: buildGlobalUsageDocId,
    buildGlobalUsageDocument: buildGlobalUsageDocument,
    buildSuccess: buildSuccess,
    buildSystemPrompt: buildSystemPrompt,
    buildUserPrompt: buildUserPrompt,
    buildUserUsageDocId: buildUserUsageDocId,
    buildUserUsageDocument: buildUserUsageDocument,
    consumeAiQuota: consumeAiQuota,
    createGeneratedStoryId: createGeneratedStoryId,
    createRequestHash: createRequestHash,
    extractJsonText: extractJsonText,
    extractProviderMessage: extractProviderMessage,
    generateNormalizedStoryWithRetry: generateNormalizedStoryWithRetry,
    getUsageDateKey: getUsageDateKey,
    isCircuitOpen: isCircuitOpen,
    normalizeStoryPayload: normalizeStoryPayload,
    normalizeWhitespace: normalizeWhitespace,
    releaseRequestLock: releaseRequestLock,
    requestAndNormalizeStory: requestAndNormalizeStory,
    requestDeepSeek: requestDeepSeek,
    safeGetDocument: safeGetDocument,
    trimString: trimString,
    validateEvent: validateEvent,
    validateProviderInputLength: validateProviderInputLength,
  },
};
