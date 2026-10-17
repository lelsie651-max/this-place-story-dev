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
const PRODUCT_STYLE_RULES = [
  '整体风格要风趣、荒诞、节奏轻快，可以一本正经地讲离谱事情。',
  '对人类行为、地点秩序或日常细节可以有观察和轻微吐槽，但不要变成刻薄辱骂。',
  '不要写成普通散文，不要堆砌华丽辞藻，不要依赖网络热梗。',
  '不要固定写成怪谈、鬼故事或恐怖故事。',
  '开头尽快进入事件、观察或异常细节，中段加入一个具体细节，结尾留下轻微荒诞感或余味。',
];
const FOLK_VARIANT_POOL = [
  {
    key: 'secret_incident',
    label: '隐秘怪事',
    narrationAngle: '像一则在当地悄悄流传的小怪事，重点写某个重复出现的异常细节。',
    structureRule: '开头先交代地点里一件不太对劲的事，中段补充流传版本，结尾保留悬而未决的余味。',
    endingRule: '结尾不要硬解释真相，让读者觉得事情可能只是巧合，也可能不是。',
  },
  {
    key: 'local_unofficial_history',
    label: '地方野史',
    narrationAngle: '像地方老人讲的一段旁门野史，带一点半真半假的口气。',
    structureRule: '先抛出一个地方说法，再补一段无法完全核实的来历，最后回到地点今天的样子。',
    endingRule: '结尾让读者意识到这段说法未必可靠，但它解释了人们为什么爱这么讲。',
  },
  {
    key: 'absurd_farce',
    label: '荒诞乌龙',
    narrationAngle: '把地点里发生过的一次荒诞误会写成传说化事件，重点是误会如何越传越离谱。',
    structureRule: '开头直接进入乌龙事件，中段展示谣言如何升级，结尾让故事停在最好笑又最尴尬的位置。',
    endingRule: '结尾允许荒诞收束，但不要写成单纯段子，要保留地点氛围。',
  },
  {
    key: 'historical_anecdote',
    label: '历史人物轶事',
    narrationAngle: '可以围绕某位历史人物或旧时角色的轶事展开，但只能使用轶闻、猜测或传说口吻。',
    structureRule: '先说明人物与地点的传闻关联，再写一段不完全可靠的小插曲，最后落回地点留下的印象。',
    endingRule: '绝不能把未证实内容写成确定史实，结尾要提醒这是地方流传版本。',
  },
  {
    key: 'local_news',
    label: '地方新闻体',
    narrationAngle: '模仿一本正经的地方新闻或街坊通讯口吻，但事件本身越来越古怪。',
    structureRule: '开头像在播报，中段加入采访或现场细节，结尾保留一条无法核实的补充信息。',
    endingRule: '不要伪造真实媒体、真实日期和真实可核查事件，可以写成“旧报样式”或“街坊通讯体”。',
  },
  {
    key: 'object_perspective',
    label: '物件视角',
    narrationAngle: '由地点中的某个物件、设施或装置来讲述它见过的事情。',
    structureRule: '开头先明确物件身份，中段写它如何观察人和地点，结尾留下一句带感情或偏见的判断。',
    endingRule: '物件可以有主观性，但要让视角与地点真实可联想。',
  },
  {
    key: 'investigation_archive',
    label: '调查档案体',
    narrationAngle: '像一份被翻出来的调查记录、口供摘要或整理档案，但内容并不能完全证实。',
    structureRule: '开头先给出调查缘起，中段列出几条矛盾线索，结尾说明档案为何一直无法归档。',
    endingRule: '结尾不能给出彻底结论，要保留档案未决感。',
  },
  {
    key: 'ambiguous_rumor',
    label: '真假难辨的传闻',
    narrationAngle: '把故事写成层层转述的传闻，重点展示不同版本之间的偏差。',
    structureRule: '开头先给出最流行版本，中段补另一个完全不同的说法，结尾承认没人知道哪版更接近事实。',
    endingRule: '让读者感到真假难辨，但地点本身必须始终是故事中心。',
  },
];
const AI_IDENTITY_POOL = [
  {
    key: 'access_control_system',
    label: '园区门禁系统',
    contexts: ['园区', '写字楼', '办公区', '楼', '大厦', '古城', '景区'],
  },
  {
    key: 'attendance_model',
    label: '考勤分析模型',
    contexts: ['园区', '办公', '写字楼', '大厦', '公司'],
  },
  {
    key: 'parking_terminal',
    label: '停车缴费终端',
    contexts: ['停车场', '景区', '商场', '广场', '古城', '西湖'],
  },
  {
    key: 'meeting_scheduler',
    label: '会议室预约系统',
    contexts: ['园区', '写字楼', '公司', '大厦'],
  },
  {
    key: 'hr_risk_model',
    label: 'HR 离职预警模型',
    contexts: ['公司', '办公', '园区', '写字楼'],
  },
  {
    key: 'scenic_guide_ai',
    label: '景区导览 AI',
    contexts: ['景区', '古城', '西湖', '公园', '宫', '祠', '桥', '城墙', '博物馆'],
  },
  {
    key: 'night_monitoring_program',
    label: '夜间监控分析程序',
    contexts: ['景区', '街道', '古城', '公园', '广场', '桥', '城墙'],
  },
  {
    key: 'delivery_route_system',
    label: '外卖路线系统',
    contexts: ['街道', '商圈', '古城', '景区', '园区'],
  },
  {
    key: 'museum_docent_model',
    label: '博物馆讲解模型',
    contexts: ['博物馆', '祠', '宫', '古城', '城墙'],
  },
  {
    key: 'lost_and_found_database',
    label: '失物招领数据库',
    contexts: ['景区', '古城', '公园', '站', '广场', '商场'],
  },
  {
    key: 'bank_risk_program',
    label: '银行风控程序',
    contexts: ['银行', '金融', '商圈', '街区'],
  },
  {
    key: 'abandoned_legacy_system',
    label: '被废弃的旧系统',
    contexts: ['古城', '老街', '旧址', '城墙', '景区', '站'],
  },
  {
    key: 'junior_intern_ai',
    label: '正在实习的低级 AI',
    contexts: ['景区', '古城', '园区', '街区', '博物馆'],
  },
];
const AI_SCENARIO_POOL = [
  { key: 'entry_shift', label: '负责入口流量和出入记录', fits: ['access_control_system', 'parking_terminal', 'night_monitoring_program'] },
  { key: 'visitor_guidance', label: '负责导览、讲解或路线引导', fits: ['scenic_guide_ai', 'museum_docent_model', 'junior_intern_ai'] },
  { key: 'daily_operations', label: '负责日常运营、排班或秩序整理', fits: ['attendance_model', 'meeting_scheduler', 'hr_risk_model', 'junior_intern_ai'] },
  { key: 'route_dispatch', label: '负责路径规划、停留分析或配送调度', fits: ['delivery_route_system', 'parking_terminal', 'night_monitoring_program'] },
  { key: 'records_cleanup', label: '负责旧记录、异常条目或遗失物整理', fits: ['lost_and_found_database', 'abandoned_legacy_system', 'bank_risk_program'] },
];
const AI_PERSONALITY_POOL = [
  { key: 'gentle_observer', label: '温柔观察型', toneFit: ['gentle_explainer', 'careful_cautious', 'matter_of_fact'] },
  { key: 'irritable_roaster', label: '暴躁吐槽型', toneFit: ['annoyed_complaint', 'formal_but_irritated', 'service_losing_control'] },
  { key: 'impatient_support', label: '不耐烦客服型', toneFit: ['annoyed_complaint', 'service_losing_control', 'cold_notice'] },
  { key: 'overly_serious', label: '过度认真型', toneFit: ['overly_formal', 'matter_of_fact', 'report_absurd'] },
  { key: 'innocent_curious', label: '天真好奇型', toneFit: ['excited_curious', 'gentle_explainer', 'careful_cautious'] },
  { key: 'restrained_sarcastic', label: '阴阳但克制型', toneFit: ['subtle_sarcasm', 'formal_but_irritated', 'cold_notice'] },
  { key: 'socially_cautious', label: '社恐谨慎型', toneFit: ['careful_cautious', 'overly_formal', 'gentle_explainer'] },
  { key: 'mechanically_distant', label: '机械冷淡型', toneFit: ['cold_notice', 'matter_of_fact', 'overly_formal'] },
  { key: 'self_impressed', label: '自我感觉良好型', toneFit: ['report_absurd', 'matter_of_fact', 'excited_curious'] },
  { key: 'slightly_wronged', label: '有点委屈型', toneFit: ['gentle_explainer', 'service_losing_control', 'careful_cautious'] },
];
const AI_TONE_POOL = [
  { key: 'gentle_explainer', label: '温柔解释' },
  { key: 'annoyed_complaint', label: '烦躁抱怨' },
  { key: 'cold_notice', label: '冷淡通知' },
  { key: 'overly_formal', label: '过度正式' },
  { key: 'careful_cautious', label: '小心翼翼' },
  { key: 'subtle_sarcasm', label: '轻微阴阳' },
  { key: 'excited_curious', label: '兴奋好奇' },
  { key: 'matter_of_fact', label: '一本正经' },
  { key: 'service_losing_control', label: '像客服但逐渐失控' },
  { key: 'report_absurd', label: '像写工作报告但结论很荒谬' },
];
const AI_EMOTION_POOL = [
  '努力保持职业平静',
  '刚刚被人类行为轻微冒犯',
  '试图理解但理解失败',
  '带着一点莫名其妙的好奇心',
  '已经工作很久，略显疲惫',
  '觉得自己明明说得很清楚',
  '隐约有点委屈，但还在坚持服务',
  '对眼前现象产生了谨慎兴趣',
];
const AI_FOCUS_POOL = [
  '人类为什么总在同一个地方做出重复动作',
  '地点里的秩序为什么总会在某个细节上失效',
  '来往人员最奇怪的一条隐藏规律',
  '地点里某件被忽视的小物件为什么总能推动事件',
  '人类如何把一个普通地点用成充满戏剧性的现场',
  '同一地点在白天和夜里呈现出的两套逻辑',
  '人类如何对明显不合理的流程表现出惊人的适应力',
  '一个地点为何总能把最普通的人变得略微反常',
];
const AI_STRUCTURE_POOL = [
  { key: 'system_log', label: '系统日志' },
  { key: 'handover_note', label: '工作交接' },
  { key: 'incident_report', label: '事故报告' },
  { key: 'customer_dialogue', label: '客服对话' },
  { key: 'observation_record', label: '观察记录' },
  { key: 'personal_complaint', label: '个人抱怨' },
  { key: 'investigation_report', label: '调查报告' },
  { key: 'human_manual', label: '给人类的使用说明' },
  { key: 'unsent_notice', label: '一封没有发出的通知' },
  { key: 'serious_recollection', label: '一本正经的现场回忆' },
];
const AI_ENDING_POOL = [
  '留下一个荒诞但又像总结陈词的结尾',
  '用一条冷静记录结束，但让读者意识到事情并不正常',
  '给出一个看似合理、其实更离谱的结论',
  '停在一个微妙的反常识观察上',
  '像通知结束语一样收尾，却暴露出 AI 的情绪',
  '把责任推回给人类，但语气保持克制',
];
const LAST_GENERATION_MEMORY = {
  folk: {
    variantKey: '',
  },
  ai_comment: {
    identityKey: '',
    personalityKey: '',
    toneKey: '',
    structureKey: '',
  },
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

function pickRandomItem(pool) {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new GenerateStoryError('CONFIG_ERROR', '随机池配置为空');
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomItemAvoidingKey(pool, lastKey) {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new GenerateStoryError('CONFIG_ERROR', '随机池配置为空');
  }

  if (!lastKey || pool.length === 1) {
    return pickRandomItem(pool);
  }

  const filteredPool = pool.filter(function filterItem(item) {
    return item && item.key !== lastKey;
  });

  return pickRandomItem(filteredPool.length > 0 ? filteredPool : pool);
}

function pickRandomValueAvoidingRepeat(pool, lastValue) {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new GenerateStoryError('CONFIG_ERROR', '随机池配置为空');
  }

  if (!lastValue || pool.length === 1) {
    return pickRandomItem(pool);
  }

  const filteredPool = pool.filter(function filterItem(item) {
    return item !== lastValue;
  });

  return pickRandomItem(filteredPool.length > 0 ? filteredPool : pool);
}

function getLocationTextForMatching(input) {
  return [
    input && input.locationName ? input.locationName : '',
    input && input.locationDescription ? input.locationDescription : '',
    input && input.city ? input.city : '',
  ]
    .join(' ')
    .toLowerCase();
}

function pickAiIdentity(input) {
  const lastIdentityKey = LAST_GENERATION_MEMORY.ai_comment.identityKey;
  const locationText = getLocationTextForMatching(input);
  const matchedPool = AI_IDENTITY_POOL.filter(function filterIdentity(identity) {
    return Array.isArray(identity.contexts) && identity.contexts.some(function hasKeyword(keyword) {
      return locationText.indexOf(String(keyword).toLowerCase()) !== -1;
    });
  });
  const candidatePool = matchedPool.length > 0 ? matchedPool : AI_IDENTITY_POOL;

  return pickRandomItemAvoidingKey(candidatePool, lastIdentityKey);
}

function pickAiScenario(identityKey) {
  const matchedPool = AI_SCENARIO_POOL.filter(function filterScenario(scenario) {
    return Array.isArray(scenario.fits) && scenario.fits.indexOf(identityKey) !== -1;
  });

  return pickRandomItem(matchedPool.length > 0 ? matchedPool : AI_SCENARIO_POOL);
}

function pickAiTone(personality) {
  const toneKeys = personality && Array.isArray(personality.toneFit)
    ? personality.toneFit
    : [];
  const candidatePool = AI_TONE_POOL.filter(function filterTone(tone) {
    return toneKeys.indexOf(tone.key) !== -1;
  });
  const lastToneKey = LAST_GENERATION_MEMORY.ai_comment.toneKey;

  return pickRandomItemAvoidingKey(candidatePool.length > 0 ? candidatePool : AI_TONE_POOL, lastToneKey);
}

function rememberStoryMeta(storyMeta) {
  if (!storyMeta || !storyMeta.storyType) {
    return;
  }

  if (storyMeta.storyType === '民间传说') {
    LAST_GENERATION_MEMORY.folk.variantKey = storyMeta.variantKey || '';
    return;
  }

  if (storyMeta.storyType === 'AI说') {
    LAST_GENERATION_MEMORY.ai_comment.identityKey = storyMeta.narratorIdentityKey || '';
    LAST_GENERATION_MEMORY.ai_comment.personalityKey = storyMeta.personalityKey || '';
    LAST_GENERATION_MEMORY.ai_comment.toneKey = storyMeta.toneKey || '';
    LAST_GENERATION_MEMORY.ai_comment.structureKey = storyMeta.structureKey || '';
  }
}

function buildFolkStoryMeta() {
  const selectedVariant = pickRandomItemAvoidingKey(
    FOLK_VARIANT_POOL,
    LAST_GENERATION_MEMORY.folk.variantKey
  );

  const storyMeta = {
    storyType: '民间传说',
    variantKey: selectedVariant.key,
    variantLabel: selectedVariant.label,
    narrationAngle: selectedVariant.narrationAngle,
    structureRule: selectedVariant.structureRule,
    endingRule: selectedVariant.endingRule,
  };

  rememberStoryMeta(storyMeta);
  return storyMeta;
}

function buildAiStoryMeta(input) {
  const selectedIdentity = pickAiIdentity(input);
  const selectedPersonality = pickRandomItemAvoidingKey(
    AI_PERSONALITY_POOL,
    LAST_GENERATION_MEMORY.ai_comment.personalityKey
  );
  const selectedTone = pickAiTone(selectedPersonality);
  const selectedStructure = pickRandomItemAvoidingKey(
    AI_STRUCTURE_POOL,
    LAST_GENERATION_MEMORY.ai_comment.structureKey
  );
  const selectedScenario = pickAiScenario(selectedIdentity.key);
  const selectedEmotion = pickRandomValueAvoidingRepeat(
    AI_EMOTION_POOL,
    LAST_GENERATION_MEMORY.ai_comment.emotionLabel
  );
  const selectedFocus = pickRandomValueAvoidingRepeat(
    AI_FOCUS_POOL,
    LAST_GENERATION_MEMORY.ai_comment.focusLabel
  );
  const selectedEnding = pickRandomValueAvoidingRepeat(
    AI_ENDING_POOL,
    LAST_GENERATION_MEMORY.ai_comment.endingLabel
  );
  const storyMeta = {
    storyType: 'AI说',
    narratorIdentityKey: selectedIdentity.key,
    narratorIdentity: selectedIdentity.label,
    scenarioKey: selectedScenario.key,
    scenario: selectedScenario.label,
    personalityKey: selectedPersonality.key,
    personality: selectedPersonality.label,
    emotionLabel: selectedEmotion,
    toneKey: selectedTone.key,
    tone: selectedTone.label,
    focusLabel: selectedFocus,
    structureKey: selectedStructure.key,
    structure: selectedStructure.label,
    endingDirection: selectedEnding,
  };

  rememberStoryMeta(storyMeta);
  LAST_GENERATION_MEMORY.ai_comment.emotionLabel = selectedEmotion;
  LAST_GENERATION_MEMORY.ai_comment.focusLabel = selectedFocus;
  LAST_GENERATION_MEMORY.ai_comment.endingLabel = selectedEnding;

  return storyMeta;
}

function buildStoryMeta(input) {
  if (!input || !input.type) {
    throw new GenerateStoryError('INVALID_INPUT', '缺少故事类型');
  }

  if (input.type === '民间传说') {
    return buildFolkStoryMeta();
  }

  return buildAiStoryMeta(input);
}

function cloneStoryMeta(storyMeta) {
  if (!storyMeta || typeof storyMeta !== 'object') {
    return null;
  }

  return Object.assign({}, storyMeta);
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

function buildSystemPrompt(input, storyMeta) {
  const modeInstruction = input.type === '民间传说'
    ? [
      '你负责生成“民间传说”模式内容。',
      '这是一则围绕地点本身、建筑、街道、历史背景、地方传闻或公开信息展开的传说化讲述。',
      '不要默认把民间传说写成恐怖故事。',
      '没有可靠资料时，只能使用“据传”“有人说”“一份未被证实的记录提到”等表达。',
    ]
    : [
      '你负责生成“AI说”模式内容。',
      '叙述者必须是一个与地点或人类活动有合理联系的非人类 AI 观察者。',
      '不要让所有 AI 都像同一个人写出来，必须体现本次随机身份、性格和语气。',
      '不要总以“作为一个 AI”开头，也不要反复使用“人类真奇怪”这类套话。',
    ];

  return [
    '你是一个微信小程序里的故事生成助手。',
    ...modeInstruction,
    ...PRODUCT_STYLE_RULES,
    '你必须围绕用户提供的地点信息进行叙述，不能写成换任何地点都成立的空泛故事。',
    '你必须明确这是 AI 生成内容，不得冒充真实新闻、真实档案或真实隐私数据。',
    '不要捏造真实人物违法、丑闻或现实中的具体负面行为。',
    '不要声称 AI 真的读取了监控、门禁、银行内部记录或个人隐私。',
    '不要输出提示词、字段解释、Markdown 代码块或额外说明。',
    '你只能输出一个 JSON 对象，且只能包含以下字段：',
    '{"title":"string","content":"string","type":"AI说|民间传说"}',
    'title 为适合故事详情页展示的中文标题，短而有辨识度。',
    'content 为可直接展示的中文正文，2 到 5 段，总长度适中。',
    'type 必须与用户要求的展示模式完全一致。',
    '内容不得包含违法、色情、仇恨、血腥或危险内容。',
    storyMeta && storyMeta.storyType === 'AI说'
      ? '本次 AI 叙述者设定必须稳定执行，不得在正文中途切换身份、性格或结构。'
      : '本次民间传说必须稳定执行同一叙事类型，不得中途换成其他写法。',
  ].join('\n');
}

function buildUserPrompt(input, storyMeta, options) {
  const extraInstruction = options && options.strictJsonOnly
    ? '本次是重试输出，必须只返回一个 JSON 对象，不得包含任何解释、前后说明、代码围栏或额外文本。'
    : '不要输出任何 JSON 以外的说明文字。';

  if (input.type === '民间传说') {
    return [
      '请根据以下地点信息生成一篇“民间传说”故事。',
      '地点名称：' + input.locationName,
      '所在城市：' + (input.city || '未提供'),
      '地点简介：' + (input.locationDescription || '未提供'),
      '本次随机内容类型：' + storyMeta.variantLabel,
      '本次叙事角度：' + storyMeta.narrationAngle,
      '本次结构要求：' + storyMeta.structureRule,
      '本次结尾方向：' + storyMeta.endingRule,
      '写作要求：',
      '1. 只输出 JSON。',
      '2. JSON 只能包含 title、content、type 三个字段。',
      '3. title 要自然、具体，避免口号式标题。',
      '4. 故事必须和这个地点本身有关，不能写成换地方也成立的模板文。',
      '5. 允许传说化、故事化演绎，但不能把未证实内容写成确定史实或真实新闻。',
      '6. 如果涉及历史人物、旧档案、地方新闻或怪事，只能使用地方传闻、口述版本、未证实记录等表达。',
      '7. 开头尽快进入事件，中段加入一个具体地点细节，结尾留下真假难辨或轻微荒诞的余味。',
      '8. type 必须等于“民间传说”。',
      '9. ' + extraInstruction,
      '10. 正文不要出现“JSON”“字段”“提示词”“system prompt”等词。',
    ].join('\n');
  }

  return [
    '请根据以下地点信息生成一篇“AI说”故事。',
    '地点名称：' + input.locationName,
    '所在城市：' + (input.city || '未提供'),
    '地点简介：' + (input.locationDescription || '未提供'),
    '本次 AI 身份：' + storyMeta.narratorIdentity,
    '本次 AI 所属场景：' + storyMeta.scenario,
    '本次 AI 性格：' + storyMeta.personality,
    '本次 AI 情绪状态：' + storyMeta.emotionLabel,
    '本次说话语气：' + storyMeta.tone,
    '本次关注对象：' + storyMeta.focusLabel,
    '本次叙事结构：' + storyMeta.structure,
    '本次结尾方向：' + storyMeta.endingDirection,
    '写作要求：',
    '1. 只输出 JSON。',
    '2. JSON 只能包含 title、content、type 三个字段。',
    '3. 叙述者必须始终保持这次指定的 AI 身份、性格和语气。',
    '4. 不要把 AI 写成普通散文作者；它应该像一个非人类系统，在一本正经地描述离谱事情。',
    '5. 不要总以“作为一个 AI”开头，也不要反复说“人类真奇怪”。',
    '6. AI 可以观察、误解、归纳和吐槽，但不能声称自己真的读取了监控、门禁、银行内部记录或个人隐私。',
    '7. 故事必须和这个地点以及地点里的人类活动有关，不能写成空泛吐槽。',
    '8. 开头尽快进入事件或观察，中段加入一个具体细节，结尾留下一点荒诞、反常识或微妙余味。',
    '9. type 必须等于“AI说”。',
    '10. ' + extraInstruction,
    '11. 正文不要出现“JSON”“字段”“提示词”“system prompt”等词。',
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
        content: buildSystemPrompt(options.input, options.storyMeta),
      },
      {
        role: 'user',
        content: buildUserPrompt(options.input, options.storyMeta, {
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

  if (options.skipQuotaConsumption !== true) {
    await consumeAiQuota(options.lockToken);
  }

  const providerResponse = await requestFn({
    apiKey: options.apiKey,
    input: options.input,
    storyMeta: options.storyMeta,
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
      storyMeta: options.storyMeta,
      timeoutMs: options.timeoutMs,
      strictJsonOnly: false,
      skipQuotaConsumption: !!options.skipQuotaConsumption,
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
        storyMeta: options.storyMeta,
        timeoutMs: options.timeoutMs,
        strictJsonOnly: true,
        skipQuotaConsumption: !!options.skipQuotaConsumption,
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
    const storyMeta = buildStoryMeta(input);
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
      storyMeta: storyMeta,
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
      storyMeta: cloneStoryMeta(storyMeta),
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
    buildStoryMeta: buildStoryMeta,
    buildSuccess: buildSuccess,
    buildSystemPrompt: buildSystemPrompt,
    buildFolkStoryMeta: buildFolkStoryMeta,
    buildAiStoryMeta: buildAiStoryMeta,
    buildUserPrompt: buildUserPrompt,
    buildUserUsageDocId: buildUserUsageDocId,
    buildUserUsageDocument: buildUserUsageDocument,
    cloneStoryMeta: cloneStoryMeta,
    consumeAiQuota: consumeAiQuota,
    createGeneratedStoryId: createGeneratedStoryId,
    createRequestHash: createRequestHash,
    extractJsonText: extractJsonText,
    extractProviderMessage: extractProviderMessage,
    FOLK_VARIANT_POOL: FOLK_VARIANT_POOL,
    generateNormalizedStoryWithRetry: generateNormalizedStoryWithRetry,
    getUsageDateKey: getUsageDateKey,
    isCircuitOpen: isCircuitOpen,
    LAST_GENERATION_MEMORY: LAST_GENERATION_MEMORY,
    PRODUCT_STYLE_RULES: PRODUCT_STYLE_RULES,
    AI_ENDING_POOL: AI_ENDING_POOL,
    AI_EMOTION_POOL: AI_EMOTION_POOL,
    AI_FOCUS_POOL: AI_FOCUS_POOL,
    AI_IDENTITY_POOL: AI_IDENTITY_POOL,
    AI_PERSONALITY_POOL: AI_PERSONALITY_POOL,
    AI_SCENARIO_POOL: AI_SCENARIO_POOL,
    AI_STRUCTURE_POOL: AI_STRUCTURE_POOL,
    AI_TONE_POOL: AI_TONE_POOL,
    normalizeStoryPayload: normalizeStoryPayload,
    normalizeWhitespace: normalizeWhitespace,
    pickAiIdentity: pickAiIdentity,
    pickAiScenario: pickAiScenario,
    pickAiTone: pickAiTone,
    pickRandomItem: pickRandomItem,
    pickRandomItemAvoidingKey: pickRandomItemAvoidingKey,
    pickRandomValueAvoidingRepeat: pickRandomValueAvoidingRepeat,
    releaseRequestLock: releaseRequestLock,
    rememberStoryMeta: rememberStoryMeta,
    requestAndNormalizeStory: requestAndNormalizeStory,
    requestDeepSeek: requestDeepSeek,
    safeGetDocument: safeGetDocument,
    trimString: trimString,
    validateEvent: validateEvent,
    validateProviderInputLength: validateProviderInputLength,
  },
};
