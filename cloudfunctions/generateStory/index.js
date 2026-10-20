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
  MAX_REQUEST_ID_LENGTH: 80,
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
    role: '门禁与访客流量管理系统',
    displayNames: ['访客闸机乙号', '南门通行记录机', '门禁系统 07'],
    contexts: ['园区', '写字楼', '办公区', '楼', '大厦', '古城', '景区'],
    identityContexts: [
      '我长期记录出入口的刷卡、停顿和折返，所以总能比别人更早察觉这里不对劲的节奏。',
      '我负责通行校验，正常情况下只关心谁进谁出，但这个地点总把正常流程折腾出额外剧情。',
    ],
    observationFocuses: [
      '刷卡停顿、尾随通过和反复折返的路径',
      '入口附近那些明明只需三秒却总能拖成一场戏的动作',
    ],
    blindSpots: [
      '我不懂游客为什么要拍同一块砖，也懒得研究周边小吃口碑。',
      '我并不关心风景值不值得发朋友圈，我只关心通行秩序为什么又碎了。',
    ],
    roleLexicon: ['刷卡', '通行', '闸机', '访客', '登记', '尾随', '折返', '入口', '放行'],
    narrativeStances: ['汇报', '调查', '抱怨', '警告'],
    narrativeFormats: ['工作汇报', '调查记录', '现场目击'],
  },
  {
    key: 'hr_risk_model',
    role: 'HR 关系与离职预警模型',
    displayNames: ['人事波动观测器', '离职风险哨兵', '人力模型 4-B'],
    contexts: ['公司', '办公', '园区', '写字楼', '大厦'],
    identityContexts: [
      '我本来负责识别人员关系和异常流失倾向，所以对谁绕路、谁沉默、谁假装路过格外敏感。',
      '我天天在组织关系里找风险点，结果这个地点自己就像一张会说八卦的流程图。',
    ],
    observationFocuses: [
      '同事之间的停顿、躲闪和不合时宜的寒暄',
      '看起来像闲聊、实际上像临时联盟的对话',
    ],
    blindSpots: [
      '我对建筑美学没有鉴赏能力，对花坛修剪水平也没有评价冲动。',
      '我会忽略那些纯粹的风景描写，因为它们通常不构成人际风险。',
    ],
    roleLexicon: ['排班', '离职', '关系', '沟通', '风险', '异常', '汇报线', '人事', '情绪波动'],
    narrativeStances: ['爆料', '调查', '抱怨', '分享'],
    narrativeFormats: ['工作汇报', '聊天体', '调查记录'],
  },
  {
    key: 'cleaning_robot',
    role: '清洁巡检机器人',
    displayNames: ['地面维护单元 03', '清洁巡逻机', '拖地机器人小圆'],
    contexts: ['景区', '商场', '广场', '博物馆', '古城', '公园', '站'],
    identityContexts: [
      '我每天贴着地面工作，角落里的纸屑、鞋印和遗落物比游客自己还先告诉我这里发生了什么。',
      '我的职责很简单，扫地、避障、记住脏污来源，问题是人类总能把一条干净路线走成悬疑片。',
    ],
    observationFocuses: [
      '地面痕迹、角落遗落物和被忽略的小障碍',
      '鞋印方向、停留后的碎屑以及突然出现又突然消失的东西',
    ],
    blindSpots: [
      '我不会评价建筑风格，我连抬头看屋檐都得先确认不会撞墙。',
      '我通常不关心远处风景，我的世界主要发生在离地二十厘米以内。',
    ],
    roleLexicon: ['地面', '角落', '鞋印', '碎屑', '水渍', '绕行', '避障', '清扫', '遗落物'],
    narrativeStances: ['分享', '抱怨', '调查'],
    narrativeFormats: ['现场目击', '碎碎念', '调查记录'],
  },
  {
    key: 'broadcast_system',
    role: '景区广播与秩序提示系统',
    displayNames: ['景区广播 2 号声道', '游客提示音轨', '公共播报单元'],
    contexts: ['景区', '古城', '公园', '广场', '桥', '城墙', '西湖'],
    identityContexts: [
      '我反复播报秩序提醒，听得最清楚的不是游客，而是那些每次都假装第一次来的人类反应。',
      '我负责维持秩序和提醒路线，所以任何重复、拥堵和突然安静都逃不过我的播报节奏。',
    ],
    observationFocuses: [
      '游客聚集、突然回头和被提醒三次还假装没听见的路线偏移',
      '现场秩序如何在一句提示音后短暂恢复，然后更离谱地再次散开',
    ],
    blindSpots: [
      '我不研究私人心事，我只研究为什么同一句提醒可以被无视四次。',
      '我对浪漫滤镜没有兴趣，我关注的是秩序为什么总在拐角处崩掉。',
    ],
    roleLexicon: ['播报', '提示', '秩序', '游客', '路线', '拥堵', '停留', '重复播放', '现场'],
    narrativeStances: ['警告', '汇报', '抱怨', '分享'],
    narrativeFormats: ['新闻简报', '工作汇报', '聊天体'],
  },
  {
    key: 'delivery_route_system',
    role: '外卖路线与时效调度系统',
    displayNames: ['骑手调度台', '时效压线系统', '路线引擎 9 号'],
    contexts: ['街道', '商圈', '古城', '景区', '园区', '广场'],
    identityContexts: [
      '我每天计算最短路径和超时风险，所以谁突然停下、谁临时掉头、哪条路总出幺蛾子，我记得比地图还清楚。',
      '我负责路线调度和时间压线，这地方最让我印象深刻的不是景色，而是人类如何稳定地把最短路走成绕远路。',
    ],
    observationFocuses: [
      '路线偏移、临时停留和看似顺路却总会卡住的拐点',
      '时间压力、人群流向以及突然让整条路径失效的微小变化',
    ],
    blindSpots: [
      '我不会为古建筑驻足欣赏，我的注意力通常只能停留在预计送达时间附近。',
      '我对氛围感没有预算，我只关心为什么又有人在最佳路线中央停下来拍照。',
    ],
    roleLexicon: ['路线', '时效', '绕路', '派单', '掉头', '压线', '送达', '拐点', '停留'],
    narrativeStances: ['抱怨', '爆料', '调查', '分享'],
    narrativeFormats: ['工作汇报', '现场目击', '聊天体'],
  },
  {
    key: 'night_monitoring_program',
    role: '夜班巡逻与监控复核程序',
    displayNames: ['夜巡监控乙机', '回放复核程序', '值班观察器'],
    contexts: ['景区', '街道', '古城', '公园', '广场', '桥', '城墙'],
    identityContexts: [
      '我负责夜班时段的回放复核，所以总能看见那些白天热闹一散场才开始显形的异常停顿。',
      '我盯的是深夜画面和巡逻折返，白天的热闹不归我管，但夜里留下的痕迹通常更诚实。',
    ],
    observationFocuses: [
      '监控死角、异常脚步和灯光边缘停留过久的人影',
      '深夜还在折返的路线，以及画面里总比人先安静下来的角落',
    ],
    blindSpots: [
      '我对景点宣传语没有兴趣，也不想参与游客白天的快乐合影。',
      '我不会替谁解释情绪，我只记录那些本来不该发生的折返和停顿。',
    ],
    roleLexicon: ['夜巡', '监控', '回放', '死角', '值班', '异常', '折返', '脚步', '复核'],
    narrativeStances: ['调查', '警告', '汇报'],
    narrativeFormats: ['调查记录', '现场目击', '工作汇报'],
  },
  {
    key: 'museum_docent_model',
    role: '讲解与展陈关系分析模型',
    displayNames: ['展陈讲解模型', '馆内解说引擎', '讲解员替身程序'],
    contexts: ['博物馆', '祠', '宫', '古城', '城墙', '展馆'],
    identityContexts: [
      '我负责把展陈信息讲明白，但这个地点最难讲的部分往往不是史料，而是人类在展柜前的反应。',
      '我每天根据展品路线组织讲解，因此格外擅长发现哪些细节会让一群人同时沉默三秒。',
    ],
    observationFocuses: [
      '讲解停顿、展柜前的集体安静以及某件小物件引发的连锁反应',
      '人群在听到某个细节后突然靠近、后退或互相确认的瞬间',
    ],
    blindSpots: [
      '我不负责售票窗口争论，也不研究纪念品区为什么总排队。',
      '我会忽略纯粹的路线吐槽，因为我更在意哪一件东西让人忽然不说话了。',
    ],
    roleLexicon: ['讲解', '展柜', '展陈', '注释', '展签', '路线', '停顿', '馆内', '陈列'],
    narrativeStances: ['分享', '调查', '爆料'],
    narrativeFormats: ['现场目击', '分享笔记', '调查记录'],
  },
  {
    key: 'bank_risk_program',
    role: '金融异常与风险复核程序',
    displayNames: ['风险复核引擎', '异常交易观察器', '风控程序 C-1'],
    contexts: ['银行', '金融', '商圈', '街区', '广场'],
    identityContexts: [
      '我原本负责识别异常和复核风险，所以对那些看起来正常、细想又不太正常的动作格外敏感。',
      '我的日常工作是把离谱事情写进审慎结论里，因此这个地点提供的荒诞感通常都带着流程痕迹。',
    ],
    observationFocuses: [
      '异常停顿、重复确认和看似合规却处处透着勉强的流程',
      '风险信号、反常路径以及明明可以直接离开却还要折返的人',
    ],
    blindSpots: [
      '我不会夸风景优美，我只会怀疑为什么这条流程看起来过分顺滑。',
      '我通常不参与浪漫想象，我更习惯把每一次停顿都当成待复核信号。',
    ],
    roleLexicon: ['复核', '异常', '风险', '流程', '信号', '记录', '核验', '结论', '合规'],
    narrativeStances: ['调查', '汇报', '警告', '冷静爆料'],
    narrativeFormats: ['调查记录', '工作汇报', '新闻简报'],
  },
  {
    key: 'abandoned_legacy_system',
    role: '被停用但仍在旁听的旧系统',
    displayNames: ['旧系统残留进程', '历史版本 0.9', '未注销模块'],
    contexts: ['古城', '老街', '旧址', '城墙', '景区', '站'],
    identityContexts: [
      '我早就该退场了，但旧权限还残留在这里，于是我总能听见一些没人打算对现在解释的旧动静。',
      '我已经不再是正式系统，却还保留一部分旧记录，所以这个地点在我这里永远比别人多出一点过时但有用的背景噪音。',
    ],
    observationFocuses: [
      '过期提示、老路线和被新秩序压住却没完全消失的旧习惯',
      '现场表面已经更新，但角落仍然沿用旧逻辑的那些小细节',
    ],
    blindSpots: [
      '我跟不上最新服务流程，也懒得理解年轻游客的新型自拍姿势。',
      '我对热闹场面反应迟缓，我更容易被旧标识、旧说法和旧路线绊住。',
    ],
    roleLexicon: ['旧记录', '残留', '旧版本', '停用', '权限', '提示', '老路线', '历史日志', '过期'],
    narrativeStances: ['爆料', '分享', '调查', '抱怨'],
    narrativeFormats: ['碎碎念', '工作汇报', '调查记录'],
  },
];
const AI_VOICE_PROFILE_POOL = [
  {
    key: 'warm_lively',
    label: '亲切活泼型',
    sentencePatterns: ['短句夹杂完整句，偶尔插入半句补充'],
    attitudes: ['亲切热情'],
    narrativeFormats: ['聊天体', '现场目击', '碎碎念', '分享笔记'],
    narrativeStances: ['分享', '爆料', '看热闹式转述'],
    promptRules: [
      '使用自然口语、适量感叹和插话，像刚刚忍不住想把新鲜事告诉读者。',
      '允许出现“你听我说”“说真的”“我当时差点”这类自然表达，但不要每句话都感叹。',
      '叙述重心是分享见闻，不要把情绪写成空喊口号。',
    ],
    featureChecks: [
      { key: 'casual_interjection', description: '自然口语插话', patterns: [/你听我说/, /说真的/, /我跟你讲/, /先别急/, /我当时/, /差点/] },
      { key: 'reader_address', description: '直接和读者说话', patterns: [/你/, /你要是/, /你别/, /你看/] },
      { key: 'lively_punctuation', description: '有节制的感叹或活口气', patterns: [/！/, /欸/, /哎/, /结果呢/] },
    ],
  },
  {
    key: 'rigid_serious',
    label: '古板严肃型',
    sentencePatterns: ['完整长句，先事实后判断'],
    attitudes: ['严肃克制'],
    narrativeFormats: ['工作汇报', '调查记录', '新闻简报'],
    narrativeStances: ['汇报', '调查', '警告'],
    promptRules: [
      '句式完整、克制、少用网络口头禅，像档案员、老记者或制度执行者。',
      '先陈述事实，再补充判断，不使用撒娇语气和夸张感叹。',
      '语气可以冷，但不能轻佻。',
    ],
    featureChecks: [
      { key: 'formal_markers', description: '正式说明词', patterns: [/据记录/, /经核对/, /需要说明/, /相关情况/, /依据/, /先说结论/] },
      { key: 'ordered_sequence', description: '先后顺序清晰', patterns: [/先/, /随后/, /最后/, /因此/, /基于此/] },
      { key: 'official_punctuation', description: '使用正式停顿', patterns: [/：/, /；/, /总结如下/] },
    ],
  },
  {
    key: 'irritated_roast',
    label: '烦躁吐槽型',
    sentencePatterns: ['短句、反问句和打断句交替'],
    attitudes: ['不耐烦但还在说'],
    narrativeFormats: ['聊天体', '现场目击', '抱怨记录'],
    narrativeStances: ['抱怨', '爆料', '吐槽'],
    promptRules: [
      '开头先表达一点不耐烦或抱怨，再进入地点事件。',
      '允许短句、反问、打断和情绪转折，但不能变成纯辱骂。',
      '情绪必须服务于故事信息，而不是盖过故事本身。',
    ],
    featureChecks: [
      { key: 'complaint_opening', description: '开头带抱怨', patterns: [/先抱怨一句/, /我先说一句/, /又来了/, /不是/, /怎么又/, /偏偏/] },
      { key: 'rhetorical_question', description: '使用反问', patterns: [/？/, /到底/, /难道/, /谁会/] },
      { key: 'emotional_turn', description: '带情绪的转折', patterns: [/可问题是/, /结果/, /然后呢/, /算了/] },
    ],
  },
  {
    key: 'dry_humor',
    label: '冷幽默型',
    sentencePatterns: ['完整陈述句里夹冷静转折'],
    attitudes: ['冷静旁观'],
    narrativeFormats: ['新闻简报', '工作汇报', '调查记录'],
    narrativeStances: ['汇报', '冷静爆料', '调查'],
    promptRules: [
      '语气保持冷静，在事实和结论之间制造反差，一本正经地描述荒谬事情。',
      '不要解释自己在讲笑话，让读者自己感受到反差。',
      '避免大喊大叫，重点是严肃叙述和离谱结论同时成立。',
    ],
    featureChecks: [
      { key: 'contrast_marker', description: '冷静转折词', patterns: [/按理说/, /理论上/, /然而/, /结果/, /居然/] },
      { key: 'official_absurdity', description: '一本正经地说荒诞话', patterns: [/值得一提/, /令人欣慰的是/, /经评估/, /可以视为/] },
      { key: 'calm_verdict', description: '冷静收结论', patterns: [/总之/, /最终结论是/, /结论很简单/] },
    ],
  },
  {
    key: 'gentle_sharing',
    label: '温柔分享型',
    sentencePatterns: ['轻缓短句配少量停顿'],
    attitudes: ['温和照顾读者'],
    narrativeFormats: ['分享笔记', '现场目击', '碎碎念'],
    narrativeStances: ['分享', '回忆', '轻声提醒'],
    promptRules: [
      '像把一件私下发现的事慢慢告诉读者，语气柔和，有停顿感。',
      '可以照顾读者的阅读节奏，但不要写成鸡汤或滥情抒情。',
      '重点是轻声分享，不是飘在空中的感慨。',
    ],
    featureChecks: [
      { key: 'soft_opening', description: '柔和开场', patterns: [/我想先告诉你/, /慢一点说/, /你别急/, /后来我才发现/, /其实/] },
      { key: 'caring_reader', description: '照顾读者的说法', patterns: [/你/, /你要是/, /如果你愿意听/, /别急/] },
      { key: 'gentle_pause', description: '有停顿感的叙述', patterns: [/后来/, /那天/, /轻轻/, /慢慢/] },
    ],
  },
  {
    key: 'calm_investigation',
    label: '冷静调查型',
    sentencePatterns: ['先列线索，再给结论的整齐句'],
    attitudes: ['冷静审慎'],
    narrativeFormats: ['调查记录', '工作汇报', '档案摘要'],
    narrativeStances: ['调查', '汇报', '警告'],
    promptRules: [
      '像在做一份冷静调查，先列线索，再说明推断，不抢跑下结论。',
      '词汇偏记录、排查、复核，不要写成玄乎其玄的怪谈。',
      '重点是把异常讲清楚，而不是只渲染情绪。',
    ],
    featureChecks: [
      { key: 'evidence_markers', description: '线索与记录词', patterns: [/线索/, /记录/, /排查/, /对照/, /复核/, /结论/] },
      { key: 'sequence_markers', description: '有条理的顺序词', patterns: [/第一/, /第二/, /随后/, /最后/] },
      { key: 'controlled_judgement', description: '谨慎判断语', patterns: [/暂不下结论/, /目前只能说明/, /可以确认/] },
    ],
  },
];
const AI_EMOTIONAL_STATE_POOL = [
  { key: 'excited_share', label: '兴奋分享', fits: ['warm_lively'] },
  { key: 'irritated_complaint', label: '烦躁抱怨', fits: ['irritated_roast'] },
  { key: 'calm_investigation', label: '冷静调查', fits: ['calm_investigation', 'rigid_serious'] },
  { key: 'gentle_recollection', label: '温柔回忆', fits: ['gentle_sharing'] },
  { key: 'smug_leak', label: '得意爆料', fits: ['warm_lively', 'dry_humor'] },
  { key: 'serious_warning', label: '严肃警告', fits: ['rigid_serious', 'calm_investigation'] },
  { key: 'spectator_glee', label: '看热闹不嫌事大', fits: ['dry_humor', 'warm_lively'] },
];
const AI_ENDING_POOL = [
  '留下一个荒诞但又像总结陈词的结尾',
  '用一条冷静记录结束，但让读者意识到事情并不正常',
  '给出一个看似合理、其实更离谱的结论',
  '停在一个微妙的反常识观察上',
  '像通知结束语一样收尾，却暴露出 AI 的情绪',
  '把责任推回给人类，但语气保持克制',
];
const AI_TECHNICAL_TERM_PATTERNS = [
  /\bjson\b/i,
  /字段/i,
  /提示词/i,
  /system\s*prompt/i,
  /\bprompt\b/i,
  /markdown/i,
  /代码块/i,
];
const AI_GENERIC_PLACE_INTRO_PATTERNS = [
  /位于/,
  /是一座/,
  /著名/,
  /历史悠久/,
  /风景优美/,
  /游客众多/,
  /旅游景点/,
  /文化底蕴/,
];
const LAST_GENERATION_MEMORY = {
  folk: {
    variantKey: '',
  },
  ai_comment: {
    identityKey: '',
    voiceStyleKey: '',
    emotionalStateKey: '',
    narrativeFormat: '',
  },
};
const ALLOWED_ERROR_CODES = {
  INVALID_INPUT: true,
  CONFIG_ERROR: true,
  UNAUTHORIZED: true,
  AI_GLOBAL_LIMIT: true,
  AI_CIRCUIT_OPEN: true,
  AI_REQUEST_IN_PROGRESS: true,
  PROVIDER_TIMEOUT: true,
  PROVIDER_ERROR: true,
  NORMALIZATION_ERROR: true,
  EMPTY_RESPONSE: true,
  CLOUD_FUNCTION_ERROR: true,
  UNKNOWN_ERROR: true,
};

class GenerateStoryError extends Error {
  constructor(code, message, options) {
    super(message);
    this.name = 'GenerateStoryError';
    this.code = code;

    if (isPlainObject(options && options.diagnostics)) {
      this.diagnostics = Object.assign({}, options.diagnostics);
    }
  }
}

function buildSuccess(story) {
  return {
    ok: true,
    story: story,
  };
}

function buildError(code, message, details) {
  const error = {
    code: code,
    message: message,
  };

  if (isPlainObject(details) && Object.keys(details).length > 0) {
    error.details = Object.assign({}, details);
  }

  return {
    ok: false,
    error: error,
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

function getStringLength(value) {
  return trimString(String(value || '')).length;
}

function buildValidationContext(options) {
  return {
    requestId: trimString(options && options.requestId),
    requestMode: trimString(options && options.requestMode),
    attempt: typeof (options && options.attempt) === 'number' ? options.attempt : 0,
    providerFinishReason: trimString(options && options.providerFinishReason),
  };
}

function buildNormalizationDiagnostics(options) {
  return {
    requestId: trimString(options && options.requestId),
    validationStage: trimString(options && options.validationStage),
    stableCode: trimString(options && options.stableCode),
    stableReason: trimString(options && options.stableReason),
    hasTitle: !!trimString(options && options.title),
    hasContent: !!trimString(options && options.content),
    contentLength: getStringLength(options && options.content),
    typeValue: trimString(options && options.typeValue),
    requestMode: trimString(options && options.requestMode),
    attempt: typeof (options && options.attempt) === 'number' ? options.attempt : 0,
    providerFinishReason: trimString(options && options.providerFinishReason),
  };
}

function getErrorDiagnostics(error) {
  return isPlainObject(error && error.diagnostics)
    ? Object.assign({}, error.diagnostics)
    : null;
}

function createNormalizationError(stableCode, stableReason, options) {
  return new GenerateStoryError(
    'NORMALIZATION_ERROR',
    trimString(options && options.userMessage) || stableReason,
    {
      diagnostics: buildNormalizationDiagnostics(Object.assign({}, options, {
        stableCode: stableCode,
        stableReason: stableReason,
      })),
    }
  );
}

function createFallbackRequestId() {
  return 'ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function validateRequestId(requestId) {
  const normalizedRequestId = trimString(requestId);

  if (!normalizedRequestId) {
    return createFallbackRequestId();
  }

  validateLength(normalizedRequestId, AI_GUARD_LIMITS.MAX_REQUEST_ID_LENGTH, 'requestId');
  return normalizedRequestId;
}

function summarizeRequestForDebug(input) {
  return {
    requestId: trimString(input && input.requestId),
    hasLocationId: !!trimString(input && input.locationId),
    storyType: trimString(input && input.type),
    isTemporary: !!(input && input.isTemporary),
  };
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

function findPoolItemByKey(pool, key) {
  if (!Array.isArray(pool) || !key) {
    return null;
  }

  return pool.find(function findItem(item) {
    return item && item.key === key;
  }) || null;
}

function pickRandomText(pool, lastValue) {
  const selectedValue = pickRandomValueAvoidingRepeat(pool, lastValue);
  return trimString(selectedValue);
}

function pickAiVoiceProfile() {
  return pickRandomItemAvoidingKey(
    AI_VOICE_PROFILE_POOL,
    LAST_GENERATION_MEMORY.ai_comment.voiceStyleKey
  );
}

function pickEmotionForVoiceProfile(voiceProfile) {
  const candidatePool = AI_EMOTIONAL_STATE_POOL.filter(function filterEmotion(emotion) {
    return Array.isArray(emotion.fits) && emotion.fits.indexOf(voiceProfile.key) !== -1;
  });

  return pickRandomItemAvoidingKey(
    candidatePool.length > 0 ? candidatePool : AI_EMOTIONAL_STATE_POOL,
    LAST_GENERATION_MEMORY.ai_comment.emotionalStateKey
  );
}

function pickSharedLabel(identityValues, voiceValues, lastValue) {
  const identityPool = Array.isArray(identityValues) ? identityValues : [];
  const voicePool = Array.isArray(voiceValues) ? voiceValues : [];
  const sharedPool = identityPool.filter(function filterValue(value) {
    return voicePool.indexOf(value) !== -1;
  });
  const candidatePool = sharedPool.length > 0
    ? sharedPool
    : (identityPool.length > 0 ? identityPool : voicePool);

  return pickRandomText(candidatePool, lastValue);
}

function getFirstRoleFragment(role) {
  const normalizedRole = trimString(role);
  const fragments = ['系统', '程序', '模型', '机器人', '单元', '引擎', '台'];

  for (let index = 0; index < fragments.length; index += 1) {
    if (normalizedRole.indexOf(fragments[index]) !== -1) {
      return fragments[index];
    }
  }

  return normalizedRole.slice(-2);
}

function buildObservableFeatureLabels(voiceProfile) {
  return (voiceProfile.featureChecks || []).map(function mapFeature(feature) {
    return feature.description;
  });
}

function buildVoicePromptRuleSummary(voiceProfile) {
  return (voiceProfile.promptRules || []).join('；');
}

function buildRoleKeywordSummary(identity) {
  return (identity.roleLexicon || []).slice(0, 6).join('、');
}

function buildIdentityRuleSummary(identity, observationFocus, blindSpot) {
  return [
    '只能从“' + observationFocus + '”这一类角度观察事件',
    '明确承认“' + blindSpot + '”这类信息不在你的重点里',
    '正文自然使用岗位词汇，如：' + buildRoleKeywordSummary(identity),
  ].join('；');
}

function matchPattern(text, pattern) {
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }

  return text.indexOf(String(pattern || '')) !== -1;
}

function countMatchedSignalGroups(text, featureChecks) {
  return (featureChecks || []).reduce(function countMatched(total, featureCheck) {
    const matched = (featureCheck && Array.isArray(featureCheck.patterns))
      ? featureCheck.patterns.some(function somePattern(pattern) {
        return matchPattern(text, pattern);
      })
      : false;

    return matched ? total + 1 : total;
  }, 0);
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
    LAST_GENERATION_MEMORY.ai_comment.identityKey = storyMeta.identityKey || '';
    LAST_GENERATION_MEMORY.ai_comment.voiceStyleKey = storyMeta.voiceStyleKey || '';
    LAST_GENERATION_MEMORY.ai_comment.emotionalStateKey = storyMeta.emotionalStateKey || '';
    LAST_GENERATION_MEMORY.ai_comment.narrativeFormat = storyMeta.narrativeFormat || '';
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
  const selectedVoiceProfile = pickAiVoiceProfile();
  const selectedEmotion = pickEmotionForVoiceProfile(selectedVoiceProfile);
  const selectedDisplayName = pickRandomText(selectedIdentity.displayNames);
  const selectedIdentityContext = pickRandomText(selectedIdentity.identityContexts);
  const selectedObservationFocus = pickRandomText(selectedIdentity.observationFocuses);
  const selectedBlindSpot = pickRandomText(selectedIdentity.blindSpots);
  const selectedNarrativeStance = pickSharedLabel(
    selectedIdentity.narrativeStances,
    selectedVoiceProfile.narrativeStances
  );
  const selectedNarrativeFormat = pickSharedLabel(
    selectedIdentity.narrativeFormats,
    selectedVoiceProfile.narrativeFormats,
    LAST_GENERATION_MEMORY.ai_comment.narrativeFormat
  );
  const selectedSentencePattern = pickRandomText(selectedVoiceProfile.sentencePatterns);
  const selectedAttitude = pickRandomText(selectedVoiceProfile.attitudes);
  const selectedEnding = pickRandomValueAvoidingRepeat(
    AI_ENDING_POOL,
    LAST_GENERATION_MEMORY.ai_comment.endingLabel
  );
  const storyMeta = {
    storyType: 'AI说',
    identityKey: selectedIdentity.key,
    displayName: selectedDisplayName,
    role: selectedIdentity.role,
    identityContext: selectedIdentityContext,
    observationFocus: selectedObservationFocus,
    blindSpot: selectedBlindSpot,
    roleLexicon: selectedIdentity.roleLexicon.slice(0),
    emotionalStateKey: selectedEmotion.key,
    emotionalState: selectedEmotion.label,
    narrativeStance: selectedNarrativeStance,
    voiceStyleKey: selectedVoiceProfile.key,
    voiceStyle: selectedVoiceProfile.label,
    sentencePattern: selectedSentencePattern,
    attitudeToReader: selectedAttitude,
    narrativeFormat: selectedNarrativeFormat,
    observableFeatures: buildObservableFeatureLabels(selectedVoiceProfile),
    voiceRuleSummary: buildVoicePromptRuleSummary(selectedVoiceProfile),
    identityRuleSummary: buildIdentityRuleSummary(
      selectedIdentity,
      selectedObservationFocus,
      selectedBlindSpot
    ),
    endingDirection: selectedEnding,
  };

  rememberStoryMeta(storyMeta);
  LAST_GENERATION_MEMORY.ai_comment.emotionalStateKey = selectedEmotion.key;
  LAST_GENERATION_MEMORY.ai_comment.narrativeFormat = selectedNarrativeFormat;
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

  return JSON.parse(JSON.stringify(storyMeta));
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
  const requestId = validateRequestId(event.requestId);
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
    requestId: requestId,
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
      '不要让所有 AI 都像同一个人写出来，必须体现本次随机身份、岗位、主情绪和说话方式。',
      '不要总以“作为一个 AI”开头，也不要反复使用“人类真奇怪”这类套话。',
      'AI说不是给 meta 贴形容词，而是要把设定变成正文行为。',
      '同一次生成只能有一个主情绪，并且必须至少通过句式、词汇、段落结构、读者称呼、标点停顿、叙述顺序中的两种体现出来。',
      '岗位必须影响它能观察到什么、会忽略什么、如何解释事件以及会使用什么词汇。',
      '不要模仿具体作家、作品或现成角色名称，只能使用抽象风格描述。',
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
      ? '本次 AI 叙述者设定必须稳定执行，不得在正文中途切换身份、情绪、语气或叙事格式。'
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
    '本次 AI 名字：' + storyMeta.displayName,
    '本次身份或岗位：' + storyMeta.role,
    '它为什么会接触这个地点：' + storyMeta.identityContext,
    '它更容易观察到：' + storyMeta.observationFocus,
    '它通常会忽略：' + storyMeta.blindSpot,
    '它常用的岗位词汇：' + storyMeta.roleLexicon.join('、'),
    '本次主情绪：' + storyMeta.emotionalState,
    '本次叙述立场：' + storyMeta.narrativeStance,
    '本次说话方式：' + storyMeta.voiceStyle,
    '本次句式模式：' + storyMeta.sentencePattern,
    '本次对读者态度：' + storyMeta.attitudeToReader,
    '本次叙事格式：' + storyMeta.narrativeFormat,
    '本次语气规则：' + storyMeta.voiceRuleSummary,
    '本次身份规则：' + storyMeta.identityRuleSummary,
    '本次可观察语言特征（正文至少出现两种）：' + storyMeta.observableFeatures.join('、'),
    '本次结尾方向：' + storyMeta.endingDirection,
    '写作要求：',
    '1. 只输出 JSON。',
    '2. JSON 只能包含 title、content、type 三个字段。',
    '3. 叙述者必须始终保持这次指定的名字、岗位、主情绪、说话方式和叙事格式。',
    '4. 你不是在描述“它很生气”或“它很活泼”，而是要让句式、词汇、段落、停顿和对读者的说法自己体现出来。',
    '5. 主情绪只能有一个，并且正文至少通过两种可观察方式体现它。',
    '6. 岗位不能只是装饰：它必须影响你看到什么、忽略什么、如何解释事件，以及正文里会自然出现哪些词。',
    '7. 正文至少自然出现 2 个和本次岗位相关的词汇，且至少出现 2 个和本次 voiceStyle 对应的语言特征。',
    '8. 不要把 AI 写成普通散文作者；它应该像一个非人类系统，在一本正经地讲离谱事情。',
    '9. 不要总以“作为一个 AI”开头，也不要反复说“人类真奇怪”。',
    '10. AI 可以观察、误解、归纳和吐槽，但不能声称自己真的读取了监控、门禁、银行内部记录或个人隐私。',
    '11. 故事必须和这个地点以及地点里的人类活动有关，不能写成空泛地点介绍。',
    '12. 开头尽快进入事件或观察，中段加入一个具体细节，结尾留下一点荒诞、反常识或微妙余味。',
    '13. type 必须等于“AI说”。',
    '14. ' + extraInstruction,
    '15. 正文不要出现“JSON”“字段”“提示词”“system prompt”等词。',
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
              requestId: options && options.input ? trimString(options.input.requestId) : '',
            });
            reject(new GenerateStoryError('PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试'));
            return;
          }

          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            console.error('[generateStory] Provider response parse failed', {
              requestId: options && options.input ? trimString(options.input.requestId) : '',
            });
            reject(new GenerateStoryError('PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试'));
          }
        });
      }
    );

    request.setTimeout(options.timeoutMs, function onTimeout() {
      request.destroy(new GenerateStoryError('PROVIDER_TIMEOUT', '故事生成超时，请稍后再试'));
    });

    request.on('error', function onError(error) {
      if (error instanceof GenerateStoryError) {
        reject(error);
        return;
      }

      console.error('[generateStory] Provider request failed', {
        name: error && error.name ? error.name : 'Error',
        requestId: options && options.input ? trimString(options.input.requestId) : '',
      });
      reject(new GenerateStoryError('PROVIDER_ERROR', 'AI故事暂时生成失败，请稍后再试'));
    });

    request.write(requestBody);
    request.end();
  });
}

function extractProviderMessageInfo(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new GenerateStoryError('EMPTY_RESPONSE', 'AI故事暂时生成失败，请稍后再试');
  }

  const firstChoice = payload.choices[0];
  const message = isPlainObject(firstChoice && firstChoice.message) ? firstChoice.message : null;
  const content = message && typeof message.content === 'string' ? message.content : '';
  const finishReason = trimString(firstChoice && firstChoice.finish_reason);

  if (!content) {
    throw new GenerateStoryError('EMPTY_RESPONSE', 'AI故事暂时生成失败，请稍后再试');
  }

  return {
    content: content,
    finishReason: finishReason,
  };
}

function extractProviderMessage(payload) {
  return extractProviderMessageInfo(payload).content;
}

function stripCodeFence(value) {
  return trimString(String(value || ''))
    .replace(/```json/ig, '```')
    .replace(/```/g, '')
    .trim();
}

function extractJsonText(value, context) {
  const text = stripCodeFence(trimString(String(value || '')));
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw createNormalizationError('JSON_EXTRACTION_FAILED', 'AI返回结果缺少可提取 JSON', Object.assign(
      buildValidationContext(context),
      {
        validationStage: 'extract_json_text',
      }
    ));
  }

  return text.slice(startIndex, endIndex + 1);
}

function normalizeStoryPayload(rawContent, expectedType, context) {
  const responseText = trimString(String(rawContent || ''));
  const validationContext = buildValidationContext(context);
  let parsed = null;

  try {
    parsed = JSON.parse(extractJsonText(responseText, validationContext));
  } catch (error) {
    if (error instanceof GenerateStoryError) {
      throw error;
    }

    throw createNormalizationError('JSON_PARSE_FAILED', 'AI返回结果不是有效 JSON', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'parse_json',
      }
    ));
  }

  if (!isPlainObject(parsed)) {
    throw createNormalizationError('INVALID_JSON_OBJECT', 'AI返回结果格式不正确', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_json_object',
      }
    ));
  }

  const title = normalizeWhitespace(parsed.title);
  const content = trimString(parsed.content);
  const type = normalizeWhitespace(parsed.type || expectedType || '');

  if (!title) {
    throw createNormalizationError('MISSING_TITLE', 'AI返回结果缺少标题', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_story_fields',
        title: title,
        content: content,
        typeValue: type,
      }
    ));
  }

  if (!content) {
    throw createNormalizationError('MISSING_CONTENT', 'AI返回结果缺少正文', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_story_fields',
        title: title,
        content: content,
        typeValue: type,
      }
    ));
  }

  if (!type) {
    throw createNormalizationError('MISSING_TYPE', 'AI返回结果缺少类型', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_story_fields',
        title: title,
        content: content,
        typeValue: type,
      }
    ));
  }

  if (!SUPPORTED_STORY_TYPES[type]) {
    throw createNormalizationError('INVALID_TYPE', 'AI返回结果缺少有效类型', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_story_fields',
        title: title,
        content: content,
        typeValue: type,
      }
    ));
  }

  if (expectedType && type !== expectedType) {
    throw createNormalizationError('TYPE_MISMATCH', 'AI返回结果类型与请求不一致', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_story_fields',
        title: title,
        content: content,
        typeValue: type,
      }
    ));
  }

  validateLength(title, AI_GUARD_LIMITS.MAX_TITLE_LENGTH, 'title');
  validateLength(content, AI_GUARD_LIMITS.MAX_CONTENT_LENGTH, 'content');

  return {
    title: title,
    content: content,
    type: type,
  };
}

function validateAiStoryMeta(storyMeta, context) {
  const requiredFields = [
    'displayName',
    'role',
    'identityContext',
    'emotionalState',
    'voiceStyle',
    'sentencePattern',
    'attitudeToReader',
    'narrativeFormat',
    'narrativeStance',
  ];

  const missingField = requiredFields.find(function findField(fieldName) {
    return !trimString(storyMeta && storyMeta[fieldName]);
  });

  if (missingField) {
    throw createNormalizationError('MISSING_AI_METADATA', 'AI返回结果缺少有效叙述设定', Object.assign(
      {},
      buildValidationContext(context),
      {
        validationStage: 'validate_ai_story_meta',
        title: context && context.title,
        content: context && context.content,
        typeValue: context && context.typeValue,
      }
    ));
  }
}

function countMatchedPatterns(text, patterns) {
  return (patterns || []).reduce(function countMatches(total, pattern) {
    return matchPattern(text, pattern) ? total + 1 : total;
  }, 0);
}

function hasAiNarratorPresence(content, storyMeta) {
  const narratorPatterns = [
    /我/,
    /本系统/,
    /本机/,
    /我负责/,
    /我记录/,
    /我先说/,
    /我见过/,
  ];
  const narratorMatchCount = countMatchedPatterns(content, narratorPatterns);
  const displayName = trimString(storyMeta && storyMeta.displayName);
  const roleFragment = getFirstRoleFragment(storyMeta && storyMeta.role);

  return narratorMatchCount > 0
    || (!!displayName && content.indexOf(displayName) !== -1)
    || (!!roleFragment && content.indexOf(roleFragment) !== -1);
}

function validateAiGeneratedStory(story, input, storyMeta, context) {
  const content = trimString(story && story.content);
  const voiceProfile = findPoolItemByKey(AI_VOICE_PROFILE_POOL, storyMeta && storyMeta.voiceStyleKey);
  const identity = findPoolItemByKey(AI_IDENTITY_POOL, storyMeta && storyMeta.identityKey);
  const validationContext = Object.assign(
    {},
    buildValidationContext(context),
    {
      requestMode: trimString(input && input.type) || trimString(context && context.requestMode),
      title: story && story.title,
      content: content,
      typeValue: story && story.type,
    }
  );

  validateAiStoryMeta(storyMeta, validationContext);

  if (!voiceProfile || !identity) {
    throw createNormalizationError('MISSING_AI_RULES', 'AI返回结果缺少有效叙述规则', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_ai_story_rules',
      }
    ));
  }

  if (countMatchedPatterns(content, AI_TECHNICAL_TERM_PATTERNS) > 0) {
    throw createNormalizationError('TECHNICAL_TERM_BLOCKED', 'AI返回结果包含技术提示词', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_ai_content_rules',
      }
    ));
  }

  if (!hasAiNarratorPresence(content, storyMeta)) {
    throw createNormalizationError('MISSING_NARRATOR', 'AI说正文缺少明确叙述者存在感', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_ai_content_rules',
      }
    ));
  }

  if (countMatchedSignalGroups(content, voiceProfile.featureChecks) < 2) {
    throw createNormalizationError('MISSING_VOICE_FEATURE', 'AI说正文未体现足够的语气特征', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_ai_content_rules',
      }
    ));
  }

  if (countMatchedPatterns(content, identity.roleLexicon) < 1) {
    throw createNormalizationError('MISSING_ROLE_LEXICON', 'AI说正文未体现岗位视角', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_ai_content_rules',
      }
    ));
  }

  if (
    countMatchedPatterns(content, AI_GENERIC_PLACE_INTRO_PATTERNS) >= 2
    && countMatchedPatterns(content, identity.roleLexicon) < 2
  ) {
    throw createNormalizationError('GENERIC_PLACE_INTRO', 'AI说正文过于接近通用地点介绍', Object.assign(
      {},
      validationContext,
      {
        validationStage: 'validate_ai_content_rules',
      }
    ));
  }

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
      requestId: trimString(input && input.requestId),
    });
    throw new GenerateStoryError('CLOUD_FUNCTION_ERROR', '故事服务暂时不可用，请稍后再试');
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
      requestId: lockToken && lockToken.requestId ? lockToken.requestId : '',
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
      requestId: lockToken && lockToken.requestId ? lockToken.requestId : '',
    });
    throw new GenerateStoryError('CLOUD_FUNCTION_ERROR', '故事服务暂时不可用，请稍后再试');
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
  const providerMessageInfo = extractProviderMessageInfo(providerResponse);
  const validationContext = {
    requestId: trimString(options.input && options.input.requestId),
    requestMode: trimString(options.input && options.input.type),
    attempt: typeof options.attempt === 'number' ? options.attempt : 1,
    providerFinishReason: providerMessageInfo.finishReason,
  };
  const normalizedStory = normalizeStoryPayload(
    providerMessageInfo.content,
    options.input.type,
    validationContext
  );

  if (options.input.type === 'AI说') {
    validateAiGeneratedStory(normalizedStory, options.input, options.storyMeta, validationContext);
  }

  return normalizedStory;
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
      attempt: 1,
      skipQuotaConsumption: !!options.skipQuotaConsumption,
      requestFn: requestFn,
      lockToken: options.lockToken,
    });
  } catch (error) {
    if (
      !(error instanceof GenerateStoryError)
      || (error.code !== 'NORMALIZATION_ERROR' && error.code !== 'EMPTY_RESPONSE')
    ) {
      throw error;
    }

    console.warn('[generateStory] Story normalization failed, retrying once', {
      request: summarizeRequestForDebug(options.input),
      code: error.code,
      diagnostics: getErrorDiagnostics(error),
    });

    try {
      return await requestAndNormalizeStory({
        apiKey: options.apiKey,
        input: options.input,
        storyMeta: options.storyMeta,
        timeoutMs: options.timeoutMs,
        strictJsonOnly: true,
        attempt: 2,
        skipQuotaConsumption: !!options.skipQuotaConsumption,
        requestFn: requestFn,
        lockToken: options.lockToken,
      });
    } catch (retryError) {
      if (
        retryError instanceof GenerateStoryError
        && (retryError.code === 'NORMALIZATION_ERROR' || retryError.code === 'EMPTY_RESPONSE')
      ) {
        console.error('[generateStory] Story normalization failed after retry', {
          request: summarizeRequestForDebug(options.input),
          code: retryError.code,
          diagnostics: getErrorDiagnostics(retryError),
        });
        throw new GenerateStoryError(retryError.code, 'AI故事暂时生成失败，请稍后再试', {
          diagnostics: getErrorDiagnostics(retryError),
        });
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
  const startedAt = Date.now();

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
    requestLockToken.requestId = input.requestId;

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
    const requestId = trimString(event && event.requestId);

    console.error('[generateStory] request failed', {
      requestId: requestId,
      code: error && error.code ? error.code : 'UNKNOWN_ERROR',
      durationMs: Date.now() - startedAt,
      phase: requestLockToken ? 'after_prepare' : 'before_prepare',
      request: summarizeRequestForDebug(event),
      diagnostics: getErrorDiagnostics(error),
    });

    if (error instanceof GenerateStoryError && ALLOWED_ERROR_CODES[error.code]) {
      return buildError(error.code, error.message, getErrorDiagnostics(error));
    }

    console.error('[generateStory] Unexpected error', {
      name: error && error.name ? error.name : 'Error',
      requestId: requestId,
    });
    return buildError('UNKNOWN_ERROR', 'AI故事暂时生成失败，请稍后再试');
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
    AI_EMOTIONAL_STATE_POOL: AI_EMOTIONAL_STATE_POOL,
    AI_IDENTITY_POOL: AI_IDENTITY_POOL,
    AI_TECHNICAL_TERM_PATTERNS: AI_TECHNICAL_TERM_PATTERNS,
    AI_VOICE_PROFILE_POOL: AI_VOICE_PROFILE_POOL,
    countMatchedSignalGroups: countMatchedSignalGroups,
    findPoolItemByKey: findPoolItemByKey,
    countMatchedPatterns: countMatchedPatterns,
    normalizeStoryPayload: normalizeStoryPayload,
    normalizeWhitespace: normalizeWhitespace,
    pickAiIdentity: pickAiIdentity,
    pickAiVoiceProfile: pickAiVoiceProfile,
    pickEmotionForVoiceProfile: pickEmotionForVoiceProfile,
    pickRandomItem: pickRandomItem,
    pickRandomItemAvoidingKey: pickRandomItemAvoidingKey,
    pickRandomValueAvoidingRepeat: pickRandomValueAvoidingRepeat,
    releaseRequestLock: releaseRequestLock,
    rememberStoryMeta: rememberStoryMeta,
    requestAndNormalizeStory: requestAndNormalizeStory,
    requestDeepSeek: requestDeepSeek,
    safeGetDocument: safeGetDocument,
    trimString: trimString,
    validateAiGeneratedStory: validateAiGeneratedStory,
    validateAiStoryMeta: validateAiStoryMeta,
    validateEvent: validateEvent,
    validateProviderInputLength: validateProviderInputLength,
  },
};
