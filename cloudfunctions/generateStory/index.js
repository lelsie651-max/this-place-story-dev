const https = require('https');

let cloud = null;

try {
  cloud = require('wx-server-sdk');
} catch (error) {
  cloud = {
    DYNAMIC_CURRENT_ENV: '',
    init: function init() {},
  };
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_CHAT_PATH = '/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-flash';
const REQUEST_TIMEOUT_MS = 25000;
const MAX_LOCATION_ID_LENGTH = 128;
const MAX_LOCATION_NAME_LENGTH = 80;
const MAX_LOCATION_DESCRIPTION_LENGTH = 300;
const MAX_CITY_LENGTH = 40;
const MAX_TITLE_LENGTH = 60;
const MAX_CONTENT_LENGTH = 1800;
const SUPPORTED_STORY_TYPES = {
  AI说: true,
  民间传说: true,
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  CONFIG_ERROR: true,
  PROVIDER_ERROR: true,
  PROVIDER_TIMEOUT: true,
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

function validateEvent(event) {
  if (!isPlainObject(event)) {
    throw new GenerateStoryError('INVALID_INPUT', '故事生成参数格式不正确');
  }

  if (
    typeof event.locationId !== 'undefined' &&
    event.locationId !== null &&
    typeof event.locationId !== 'string'
  ) {
    throw new GenerateStoryError('INVALID_INPUT', 'locationId 必须是字符串或空值');
  }

  if (typeof event.locationName !== 'string') {
    throw new GenerateStoryError('INVALID_INPUT', 'locationName 必须是字符串');
  }

  if (typeof event.type !== 'string') {
    throw new GenerateStoryError('INVALID_INPUT', 'type 必须是字符串');
  }

  if (typeof event.locationDescription !== 'undefined' && event.locationDescription !== null && typeof event.locationDescription !== 'string') {
    throw new GenerateStoryError('INVALID_INPUT', 'locationDescription 必须是字符串');
  }

  if (typeof event.city !== 'undefined' && event.city !== null && typeof event.city !== 'string') {
    throw new GenerateStoryError('INVALID_INPUT', 'city 必须是字符串');
  }

  const locationId = typeof event.locationId === 'string' ? trimString(event.locationId) : '';
  const locationName = normalizeWhitespace(event.locationName);
  const locationDescription = trimString(event.locationDescription || '');
  const city = normalizeWhitespace(event.city || '');
  const type = trimString(event.type);

  if (!locationName) {
    throw new GenerateStoryError('INVALID_INPUT', 'locationName 不能为空');
  }

  if (!SUPPORTED_STORY_TYPES[type]) {
    throw new GenerateStoryError('INVALID_INPUT', '当前仅支持 AI说 或 民间传说');
  }

  if (locationId) {
    validateLength(locationId, MAX_LOCATION_ID_LENGTH, 'locationId');
  }
  validateLength(locationName, MAX_LOCATION_NAME_LENGTH, 'locationName');
  validateLength(locationDescription, MAX_LOCATION_DESCRIPTION_LENGTH, 'locationDescription');
  validateLength(city, MAX_CITY_LENGTH, 'city');

  return {
    locationId: locationId || null,
    locationName: locationName,
    locationDescription: locationDescription,
    city: city,
    type: type,
  };
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
    '{"title":"string","content":"string"}',
    'title 为适合故事详情页展示的中文标题。',
    'content 为可直接展示的中文正文，2 到 5 段，总长度适中。',
    '内容不得包含违法、色情、仇恨、血腥或危险内容。',
  ].join('\n');
}

function buildUserPrompt(input) {
  const contentInstruction = input.type === '民间传说'
    ? '4. content 要像围绕地点流传的一则传说或讲述，允许有传说氛围，但不要写成可验证史实。'
    : '4. content 要像 AI 观察者在地点现场产生的想法，不要写成历史考据。';

  return [
    '请根据以下地点信息生成一篇“' + input.type + '”故事。',
    '地点名称：' + input.locationName,
    '所在城市：' + (input.city || '未提供'),
    '地点简介：' + (input.locationDescription || '未提供'),
    '输出要求：',
    '1. 只输出 JSON。',
    '2. JSON 只能包含 title 和 content 两个字段。',
    '3. title 要自然、具体，避免口号式标题。',
    contentInstruction,
    '5. 正文不要出现“JSON”“字段”“提示词”“system prompt”等词。',
  ].join('\n');
}

function requestDeepSeek(options) {
  const requestBody = JSON.stringify({
    model: DEEPSEEK_MODEL,
    stream: false,
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
        content: buildUserPrompt(options.input),
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
            reject(new GenerateStoryError('PROVIDER_ERROR', 'AI故事生成失败，请稍后重试'));
            return;
          }

          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            console.error('[generateStory] Provider response parse failed');
            reject(new GenerateStoryError('PROVIDER_ERROR', 'AI故事生成失败，请稍后重试'));
          }
        });
      }
    );

    request.setTimeout(options.timeoutMs, function onTimeout() {
      request.destroy(new GenerateStoryError('PROVIDER_TIMEOUT', 'AI故事生成超时，请稍后重试'));
    });

    request.on('error', function onError(error) {
      if (error instanceof GenerateStoryError) {
        reject(error);
        return;
      }

      console.error('[generateStory] Provider request failed', {
        name: error && error.name ? error.name : 'Error',
      });
      reject(new GenerateStoryError('PROVIDER_ERROR', 'AI故事生成失败，请稍后重试'));
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
  const text = trimString(value);

  if (text.indexOf('```') !== 0) {
    return text;
  }

  return text
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

function extractJsonText(value) {
  const text = stripCodeFence(value);

  if (text.indexOf('{') === 0 && text.lastIndexOf('}') === text.length - 1) {
    return text;
  }

  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果格式不正确');
  }

  return text.slice(startIndex, endIndex + 1);
}

function normalizeStoryPayload(rawContent) {
  let parsed = null;

  try {
    parsed = JSON.parse(extractJsonText(rawContent));
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

  if (!title || !content) {
    throw new GenerateStoryError('NORMALIZATION_ERROR', 'AI返回结果缺少标题或正文');
  }

  validateLength(title, MAX_TITLE_LENGTH, 'title');
  validateLength(content, MAX_CONTENT_LENGTH, 'content');

  return {
    title: title,
    content: content,
  };
}

function createGeneratedStoryId() {
  return 'generated-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

async function main(event) {
  try {
    const input = validateEvent(event);
    const apiKey = trimString(process.env.DEEPSEEK_API_KEY);

    if (!apiKey) {
      console.error('[generateStory] Missing DEEPSEEK_API_KEY configuration');
      return buildError('CONFIG_ERROR', 'AI服务暂未配置');
    }

    const providerResponse = await requestDeepSeek({
      apiKey: apiKey,
      input: input,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    const providerMessage = extractProviderMessage(providerResponse);
    const normalizedStory = normalizeStoryPayload(providerMessage);

    return buildSuccess({
      storyId: createGeneratedStoryId(),
      locationId: input.locationId,
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
    return buildError('PROVIDER_ERROR', 'AI故事生成失败，请稍后重试');
  }
}

module.exports = {
  main: main,
  _private: {
    ALLOWED_ERROR_CODES: ALLOWED_ERROR_CODES,
    DEEPSEEK_BASE_URL: DEEPSEEK_BASE_URL,
    DEEPSEEK_CHAT_PATH: DEEPSEEK_CHAT_PATH,
    DEEPSEEK_MODEL: DEEPSEEK_MODEL,
    GenerateStoryError: GenerateStoryError,
    MAX_CITY_LENGTH: MAX_CITY_LENGTH,
    MAX_CONTENT_LENGTH: MAX_CONTENT_LENGTH,
    MAX_LOCATION_DESCRIPTION_LENGTH: MAX_LOCATION_DESCRIPTION_LENGTH,
    MAX_LOCATION_ID_LENGTH: MAX_LOCATION_ID_LENGTH,
    MAX_LOCATION_NAME_LENGTH: MAX_LOCATION_NAME_LENGTH,
    MAX_TITLE_LENGTH: MAX_TITLE_LENGTH,
    REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS,
    buildError: buildError,
    buildSuccess: buildSuccess,
    buildSystemPrompt: buildSystemPrompt,
    buildUserPrompt: buildUserPrompt,
    createGeneratedStoryId: createGeneratedStoryId,
    extractJsonText: extractJsonText,
    extractProviderMessage: extractProviderMessage,
    normalizeStoryPayload: normalizeStoryPayload,
    normalizeWhitespace: normalizeWhitespace,
    requestDeepSeek: requestDeepSeek,
    trimString: trimString,
    validateEvent: validateEvent,
  },
};
