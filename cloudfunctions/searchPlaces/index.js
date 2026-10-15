const https = require('https');
const { URL, URLSearchParams } = require('url');
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const SEARCH_URL = 'https://apis.map.qq.com/ws/place/v1/search';
const PROVIDER_NAME = 'tencent';
const DEFAULT_REGION = '全国';
const DEFAULT_REGION_AUTO_EXTEND = 0;
const MAX_KEYWORD_BYTES = 96;
const MAX_RESULTS = 10;
const REQUEST_TIMEOUT_MS = 5000;
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  CONFIG_ERROR: true,
  PROVIDER_ERROR: true,
  PROVIDER_TIMEOUT: true,
  NORMALIZATION_ERROR: true,
};
const BLOCKED_INPUT_FIELDS = ['latitude', 'longitude', 'radius', 'nearby'];

class SearchPlacesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SearchPlacesError';
    this.code = code;
  }
}

function buildSuccess(results) {
  return {
    ok: true,
    results: results,
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

function getUtf8ByteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
}

function toFiniteNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function createBoundary(region) {
  return 'region(' + region + ',' + DEFAULT_REGION_AUTO_EXTEND + ')';
}

function validateEvent(event) {
  if (!isPlainObject(event)) {
    throw new SearchPlacesError('INVALID_INPUT', '搜索参数格式不正确');
  }

  for (let index = 0; index < BLOCKED_INPUT_FIELDS.length; index += 1) {
    const fieldName = BLOCKED_INPUT_FIELDS[index];

    if (Object.prototype.hasOwnProperty.call(event, fieldName)) {
      throw new SearchPlacesError('INVALID_INPUT', '当前仅支持关键词搜索');
    }
  }

  if (typeof event.keyword !== 'string') {
    throw new SearchPlacesError('INVALID_INPUT', 'keyword 必须是字符串');
  }

  const keyword = trimString(event.keyword);

  if (!keyword) {
    throw new SearchPlacesError('INVALID_INPUT', 'keyword 不能为空');
  }

  if (getUtf8ByteLength(keyword) > MAX_KEYWORD_BYTES) {
    throw new SearchPlacesError('INVALID_INPUT', 'keyword 长度超出限制');
  }

  let region = DEFAULT_REGION;
  let usedDefaultRegion = true;

  if (Object.prototype.hasOwnProperty.call(event, 'region') && event.region !== null && typeof event.region !== 'undefined') {
    if (typeof event.region !== 'string') {
      throw new SearchPlacesError('INVALID_INPUT', 'region 必须是字符串');
    }

    const normalizedRegion = trimString(event.region);

    if (normalizedRegion) {
      region = normalizedRegion;
      usedDefaultRegion = false;
    }
  }

  return {
    keyword: keyword,
    region: region,
    usedDefaultRegion: usedDefaultRegion,
  };
}

function requestTencentPlaces(options) {
  const params = new URLSearchParams({
    key: options.key,
    keyword: options.keyword,
    boundary: createBoundary(options.region),
    page_size: String(MAX_RESULTS),
    page_index: '1',
    language: 'cn',
    output: 'json',
  });
  const requestUrl = new URL(SEARCH_URL);
  requestUrl.search = params.toString();

  return new Promise(function executor(resolve, reject) {
    const request = https.request(
      requestUrl,
      {
        method: 'GET',
      },
      function onResponse(response) {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', function onData(chunk) {
          responseBody += chunk;
        });
        response.on('end', function onEnd() {
          if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
            console.error('[searchPlaces] Provider HTTP error', {
              statusCode: response.statusCode,
            });
            reject(new SearchPlacesError('PROVIDER_ERROR', '地点搜索服务暂时不可用'));
            return;
          }

          try {
            const payload = JSON.parse(responseBody);
            resolve(payload);
          } catch (error) {
            console.error('[searchPlaces] Provider response parse failed');
            reject(new SearchPlacesError('PROVIDER_ERROR', '地点搜索服务暂时不可用'));
          }
        });
      }
    );

    request.setTimeout(options.timeoutMs, function onTimeout() {
      request.destroy(new SearchPlacesError('PROVIDER_TIMEOUT', '地点搜索服务请求超时'));
    });

    request.on('error', function onError(error) {
      if (error instanceof SearchPlacesError) {
        reject(error);
        return;
      }

      console.error('[searchPlaces] Provider request failed', {
        name: error && error.name ? error.name : 'Error',
      });
      reject(new SearchPlacesError('PROVIDER_ERROR', '地点搜索服务暂时不可用'));
    });

    request.end();
  });
}

function normalizeTencentPlace(place) {
  if (!isPlainObject(place)) {
    return null;
  }

  const providerPlaceId = trimString(place.id);
  const name = trimString(place.title);
  const location = isPlainObject(place.location) ? place.location : {};
  const latitude = toFiniteNumber(location.lat);
  const longitude = toFiniteNumber(location.lng);

  if (!providerPlaceId || !name || latitude === null || longitude === null) {
    return null;
  }

  const adInfo = isPlainObject(place.ad_info) ? place.ad_info : {};
  const regionInfo = isPlainObject(place.region) ? place.region : {};

  return {
    provider: PROVIDER_NAME,
    providerPlaceId: providerPlaceId,
    name: name,
    address: trimString(place.address),
    city: trimString(adInfo.city),
    province: trimString(adInfo.province),
    country: trimString(adInfo.country || regionInfo.title || ''),
    latitude: latitude,
    longitude: longitude,
    category: trimString(place.category),
  };
}

function normalizeTencentResults(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.data)) {
    throw new SearchPlacesError('NORMALIZATION_ERROR', '地点搜索结果处理失败');
  }

  const rawItems = payload.data.slice(0, MAX_RESULTS);
  const normalizedResults = rawItems
    .map(normalizeTencentPlace)
    .filter(function keepValid(item) {
      return !!item;
    });

  if (rawItems.length > 0 && normalizedResults.length === 0) {
    console.error('[searchPlaces] Provider results could not be normalized', {
      rawCount: rawItems.length,
    });
    throw new SearchPlacesError('NORMALIZATION_ERROR', '地点搜索结果处理失败');
  }

  return normalizedResults;
}

async function main(event) {
  try {
    const input = validateEvent(event);
    const apiKey = trimString(process.env.TENCENT_LBS_KEY);

    if (!apiKey) {
      console.error('[searchPlaces] Missing TENCENT_LBS_KEY configuration');
      return buildError('CONFIG_ERROR', '地点搜索服务配置缺失');
    }

    const providerResponse = await requestTencentPlaces({
      key: apiKey,
      keyword: input.keyword,
      region: input.region,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (!isPlainObject(providerResponse) || typeof providerResponse.status !== 'number') {
      console.error('[searchPlaces] Provider payload shape is invalid');
      return buildError('PROVIDER_ERROR', '地点搜索服务暂时不可用');
    }

    if (providerResponse.status !== 0) {
      console.error('[searchPlaces] Provider returned non-zero status', {
        providerStatus: providerResponse.status,
        requestId: trimString(providerResponse.request_id),
      });
      return buildError('PROVIDER_ERROR', '地点搜索服务暂时不可用');
    }

    const normalizedResults = normalizeTencentResults(providerResponse);

    console.log('[searchPlaces] Search completed', {
      keywordLength: getUtf8ByteLength(input.keyword),
      usedDefaultRegion: input.usedDefaultRegion,
      resultCount: normalizedResults.length,
      providerCount: typeof providerResponse.count === 'number' ? providerResponse.count : null,
      requestId: trimString(providerResponse.request_id),
    });

    return buildSuccess(normalizedResults);
  } catch (error) {
    if (error instanceof SearchPlacesError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message);
    }

    console.error('[searchPlaces] Unexpected error', {
      name: error && error.name ? error.name : 'Error',
    });
    return buildError('PROVIDER_ERROR', '地点搜索服务暂时不可用');
  }
}

module.exports = {
  main: main,
  _private: {
    MAX_KEYWORD_BYTES: MAX_KEYWORD_BYTES,
    MAX_RESULTS: MAX_RESULTS,
    DEFAULT_REGION: DEFAULT_REGION,
    DEFAULT_REGION_AUTO_EXTEND: DEFAULT_REGION_AUTO_EXTEND,
    REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS,
    SearchPlacesError: SearchPlacesError,
    buildError: buildError,
    buildSuccess: buildSuccess,
    createBoundary: createBoundary,
    getUtf8ByteLength: getUtf8ByteLength,
    normalizeTencentPlace: normalizeTencentPlace,
    normalizeTencentResults: normalizeTencentResults,
    requestTencentPlaces: requestTencentPlaces,
    trimString: trimString,
    validateEvent: validateEvent,
  },
};
