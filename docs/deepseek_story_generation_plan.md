# DeepSeek AI 故事生成方案

## 1. 文档目的

本文档用于冻结当前 DeepSeek 故事生成链路的接入边界。

当前范围：

- `AI说` 通过 CloudBase `generateStory` 调用真实 DeepSeek
- `民间传说` 在没有预设故事时通过 `generateStory` 回退生成
- 微信地图未命中的临时地点可直接进入 `AI说` 与 `民间传说` 生成链路
- AI 生成失败不能影响现有民间传说流程

当前非目标：

- 不接腾讯 LBS
- 不接 POI API
- 不接图片输入
- 不把生成结果写入 `stories`

---

## 2. 当前流程

当前实际实现流程：

`pages/location/location`
-> 用户点击 `AI说`
-> 读取当前用户 `magnifyingGlass`
-> 先向 `consumeMagnifyingGlass` 做服务端资格预检
-> 资格通过后显示请求遮罩
-> `wx.cloud.callFunction({ name: "generateStory" })`
-> 云函数调用 DeepSeek
-> 标准化 JSON 故事结果
-> `consumeMagnifyingGlass` 服务端确认扣减 1 次放大镜
-> 写入 `app.globalData.pendingGeneratedStory`
-> 打开 `pages/story/story?generatedStory=1`

`民间传说` 保持现有流程：

`location`
-> `consumeMagnifyingGlass` 服务端资格预检
-> 优先查询当前地点预设故事
-> 命中后由 `consumeMagnifyingGlass` 服务端确认扣减
-> 直接进入 `story`
-> 未命中时调用 `generateStory`
-> AI 成功后由 `consumeMagnifyingGlass` 服务端确认扣减
-> 生成结果以 `generatedStory=1` 进入 `pages/story/story`

`网友说` 当前流程：

`location`
-> 只查询网友投稿内容
-> 不调用 `generateStory`
-> 没有投稿时提示空状态

`微信地图未命中的临时地点` 当前流程：

`discovery`
-> `wx.chooseLocation`
-> 未命中已有 `locations`
-> 进入临时地点 `location`
-> 点击 `民间传说` 或 `AI说`
-> 调用 `generateStory`
-> 以 `generatedStory=1` 进入 `pages/story/story`

---

## 3. 云函数契约

云函数名称：

- `generateStory`

输入契约：

```json
{
  "locationId": "loc-nantou 或 null",
  "locationName": "南头古城",
  "locationDescription": "地点简介",
  "city": "深圳",
  "type": "AI说"
}
```

输入规则：

- `locationId` 可为空；命中正式地点时传真实 `locations._id`，临时地点时传 `null`
- `locationName` 必须是非空字符串
- `locationDescription` 可为空
- `city` 可为空
- `type` 当前只允许：
  - `"AI说"`
  - `"民间传说"`
- 云函数内对文本长度做上限控制
- 客户端不能传 API Key
- 客户端不能传自定义 system prompt

成功返回：

```json
{
  "ok": true,
  "story": {
    "storyId": "generated-unique-id",
    "locationId": "loc-nantou 或 null",
    "type": "AI说 或 民间传说",
    "title": "故事标题",
    "content": "故事正文",
    "source": "deepseek",
    "storyMeta": {
      "storyType": "AI说 或 民间传说",
      "variantKey": "仅民间传说存在",
      "narratorIdentity": "仅 AI说存在",
      "personality": "仅 AI说存在",
      "tone": "仅 AI说存在",
      "structure": "仅 AI说存在"
    }
  }
}
```

说明：

- `storyMeta` 是当前一次生成内部随机设定的透传结果
- 它不会替代现有 `storyId/locationId/type/title/content/source`
- 页面即使暂时不使用 `storyMeta`，也必须保持正常展示

失败返回：

```json
{
  "ok": false,
  "error": {
    "code": "AI_GLOBAL_LIMIT",
    "message": "当前 AI 服务较忙，请稍后再试。"
  }
}
```

当前错误码：

- `INVALID_INPUT`
- `CONFIG_ERROR`
- `UNAUTHORIZED`
- `AI_GLOBAL_LIMIT`
- `AI_CIRCUIT_OPEN`
- `AI_REQUEST_IN_PROGRESS`
- `AI_TIMEOUT`
- `AI_PROVIDER_ERROR`
- `NORMALIZATION_ERROR`

---

## 4. DeepSeek 提供商配置

当前提供商配置：

- Base URL：`https://api.deepseek.com`
- API Path：`/chat/completions`
- Model：`deepseek-flash`
- 外部请求超时：`60000ms`
- `max_tokens` 上限已在云函数内集中定义
- `stream: false`
- `response_format.type: "json_object"`

API Key 来源：

- `process.env.DEEPSEEK_API_KEY`

当前安全边界：

- API Key 只能存在于云函数环境变量
- API Key 不能写入 `miniprogram/`
- API Key 不能写入 `SPEC.md`
- API Key 不能写入 `docs/`
- API Key 不能通过源码进入 git 历史
- 云函数不能把 Key、Authorization 或上游原始错误体返回给小程序

当前平台与项目双重保护要求：

- 项目侧通过 `generateStory` 的服务端技术限额控制本项目 AI 请求量
- DeepSeek 账户侧仍需额外配置余额提醒、消费预警或 API 使用限制
- 如果 DeepSeek 控制台没有硬性消费上限，则项目侧全局每日上限是最后一道保护
- 任何余额不足、服务商错误、超时或解析失败都不能扣放大镜

CloudBase 云函数平台超时要求：

- `generateStory` 的云函数平台超时时间必须配置为至少 `30 秒`
- 建议在 CloudBase 控制台中将函数超时配置为 `60 秒`
- 云函数平台超时时间不能短于外部 DeepSeek 请求超时，否则平台会先中断执行

## 5. AI 输出契约与 Prompt 规则

模型被要求只返回 JSON：

```json
{
  "title": "string",
  "content": "string",
  "type": "AI说 或 民间传说"
}
```

### 5.1 当前产品风格规则

当前 Prompt 不允许要求“模仿某作者”或“模仿某作品”，而是固定执行产品自己的风格规则：

- 风趣、荒诞、节奏轻快
- 一本正经地讲离谱事情
- 可以观察和轻微吐槽人类行为
- 不写成普通散文
- 不堆砌华丽辞藻
- 不依赖网络热梗
- 不固定为怪谈或鬼故事
- 开头尽快进入事件或观察，中段补具体细节，结尾留一点轻微余味

### 5.2 民间传说模式规则

当前 `民间传说` 在没有预设故事时才会调用 `generateStory`，并在以下内容类型池中随机选择一种：

- 隐秘怪事
- 地方野史
- 荒诞乌龙
- 历史人物轶事
- 地方新闻体
- 物件视角
- 调查档案体
- 真假难辨的传闻

冻结要求：

- 内容类型不能每次固定
- 不能只替换几个形容词
- 每种类型必须改变叙事角度、结构和结尾方式
- 故事必须与地点本身有关
- 没有可靠资料时，不能伪造真实新闻、真实名人行为或确定史实
- 可以使用“据传”“一份未被证实的记录写道”“如果这件事是真的”等表达

### 5.3 AI说模式规则

当前 `AI说` 会在服务端随机组合以下维度：

- AI 身份
- AI 所属场景
- 性格
- 情绪状态
- 说话语气
- 关注对象
- 叙事结构
- 结尾方向

当前身份池包括但不限于：

- 园区门禁系统
- 考勤分析模型
- 停车缴费终端
- 会议室预约系统
- HR 离职预警模型
- 景区导览 AI
- 夜间监控分析程序
- 外卖路线系统
- 博物馆讲解模型
- 失物招领数据库
- 银行风控程序
- 被废弃的旧系统
- 正在实习的低级 AI

当前性格池包括：

- 温柔观察型
- 暴躁吐槽型
- 不耐烦客服型
- 过度认真型
- 天真好奇型
- 阴阳但克制型
- 社恐谨慎型
- 机械冷淡型
- 自我感觉良好型
- 有点委屈型

当前语气池包括：

- 温柔解释
- 烦躁抱怨
- 冷淡通知
- 过度正式
- 小心翼翼
- 轻微阴阳
- 兴奋好奇
- 一本正经
- 像客服但逐渐失控
- 像写工作报告但结论很荒谬

当前叙事结构池包括：

- 系统日志
- 工作交接
- 事故报告
- 客服对话
- 观察记录
- 个人抱怨
- 调查报告
- 给人类的使用说明
- 一封没有发出的通知
- 一本正经的现场回忆

冻结要求：

- 身份必须和地点、地点类型或人类活动有合理联系
- 性格和语气必须匹配
- 不允许总以“作为一个 AI”开头
- 不允许反复使用“人类真奇怪”这类套话
- 不允许所有 AI 都像同一个作者写出来

### 5.4 真实性边界

故事约束：

- 必须围绕当前地点生成
- 使用地点名称、城市和简介作为上下文
- `AI说` 属于 AI 观察和想象，不冒充真实历史事实
- `民间传说` 回退生成时要有传说讲述感，但仍然属于 AI 生成，不冒充真实民俗档案
- 不捏造具体历史人物、年代或官方事件
- 不捏造真实人物违法、丑闻或现实中的具体负面行为
- 不声称 AI 真的读取了监控、门禁、银行内部记录或个人隐私
- 最终展示内容中不出现提示词、字段名或 JSON 代码块
- 正文必须能直接展示在故事详情页
- 控制在适中的展示长度
- 标题最大 `80` 字
- 正文最大 `2000` 字
- 不生成违法、色情、仇恨或危险内容

### 5.5 storyMeta 与当前去重边界

当前随机组合必须在云函数服务端完成，不接受前端传入。

当前已实现：

- 每次生成会先在服务端构造 `storyMeta`
- 同一次标准化重试会复用同一组 `storyMeta`
- 单个云函数实例内会尽量避免连续两次使用相同的民间传说类型
- 单个云函数实例内会尽量避免连续两次使用相同的 AI 身份、性格、语气和结构

当前未实现：

- 跨请求、跨实例的全局去重
- 基于数据库历史的长期避重
- 以用户级历史记录驱动的稳定“最近不重复”

## 6. 服务端限流与并发保护

当前 `generateStory` 只在服务端执行 AI 调用保护，前端不会单独承担这些限制。

这里的 AI 请求计数只用于技术保护和费用监控，不等同于放大镜使用次数。

当前集中常量：

- 全局每日最多 `200` 次 AI 上游请求
- 单次上游请求超时 `60 秒`
- 单次地点输入长度上限
- 标题最大 `80` 字
- 正文最大 `2000` 字
- 短时间重复请求锁窗口 `70 秒`

当前使用的集合：

- `ai_usage_daily`

当前最小可靠实现：

- 以 `date + userId` 记录 AI 请求统计与短时锁
- 以 `date` 记录全局每日计数
- 文档至少包含以下字段：
  - `date`
  - `userId`
  - `userCount`（当前作为该用户 AI 请求统计）
  - `globalCount`
  - `updatedAt`
- 用户侧文档还会记录短时间重复请求保护所需的锁字段
- 使用 CloudBase 事务更新计数，避免并发请求绕过限制

当前计数规则：

- 只有真正准备发起 DeepSeek 上游请求时，才消耗一次 AI 调用次数
- JSON 标准化失败后的重试，会再次发起上游请求，因此会再次计入 AI 调用次数
- 放大镜使用次数在 `consumeMagnifyingGlass` 中单独处理

当前熔断开关：

- 环境变量：`AI_CIRCUIT_OPEN`
- 取值为 `1/true/open/on` 时，云函数直接返回 `AI_CIRCUIT_OPEN`
- 熔断开启时不调用 DeepSeek

当前短时间重复请求保护：

- 前端继续保留 `requestLock`
- 云函数端按 `userId + 请求内容` 加短时间锁
- 同一用户短时间内重复点击，不会并发发起多次 DeepSeek 请求

## 7. 放大镜使用规则

当前用户限制依据：

- 放大镜成功使用次数

当前已实现规则：

- 每个用户每天全部地点、全部可消耗标签合计最多 `10` 次
- 每个用户每天同一地点、同一标签最多 `3` 次
- `民间传说` 命中预设故事时：
  - 不调用 AI
  - 仍然消耗 `1` 个放大镜
- `AI说` 成功时消耗 `1` 个放大镜
- `网友说` 不调用放大镜，不纳入本规则

当前服务端处理：

- 云函数：`consumeMagnifyingGlass`
- 读取身份：`wx.cloud.getWXContext().OPENID`
- 不接受客户端传入 `userId`
- 统一执行：
  - 当前用户放大镜余额检查
  - 当日总次数 `< 10`
  - 当前地点 + 当前标签次数 `< 3`
  - 成功后事务扣减 `magnifyingGlass - 1`
  - 成功后更新当日总次数与地点标签次数

当前记录集合：

- `users`
- `magnifying_glass_usage_daily`

当前错误码：

- `MAGNIFYING_GLASS_EMPTY`
- `MAGNIFYING_GLASS_DAILY_LIMIT`
- `MAGNIFYING_GLASS_LOCATION_TYPE_LIMIT`
- `MAGNIFYING_GLASS_CONCURRENT_REQUEST`

当前失败规则：

- 预检失败不扣放大镜
- 预设查询失败不扣放大镜
- AI 超时不扣放大镜
- AI 返回非法 JSON 不扣放大镜
- AI 服务错误不扣放大镜
- 快速重复点击不会重复扣减

## 8. 故事详情页接收策略

当前生成结果 **不落库** 到 CloudBase `stories`。

当前传递方式：

- 云函数返回一个生成故事对象
- 小程序写入 `app.globalData.pendingGeneratedStory`
- `story` 页通过 `generatedStory=1` 读取这次结果

原因：

- 现有故事详情页可以直接展示一次性生成结果
- 不需要伪造一个无法查询的 CloudBase `storyId`
- 保持本轮最小闭环，不引入 `stories` 落库

当前结果：

- AI 生成故事只在本次内存会话中存在
- `story` 页消费后会清空这份临时数据
- 当前 AI 生成故事不支持收藏
- 民间传说的 AI 回退结果同样不落库，且必须保留 `source = deepseek`
- 微信地图未命中的临时地点故事同样不落库，且必须明确显示为“本次选点生成的临时故事”

### 6.1 source 兼容映射

当前前后端统一按以下规则理解真实来源：

- `folk_archive` -> `preset`
- `ai_observer` -> `deepseek`
- `deepseek` -> `deepseek`
- `user` -> `user`

其中：

- `preset` 显示为“预设库”
- `deepseek` 显示为“AI生成”
- `user` 显示为“网友投稿”

## 9. 失败处理

小程序端失败处理：

- 关闭请求遮罩
- 释放 `requestLock`
- 展示友好错误提示
- 不影响 `民间传说` 现有流程

示例：

- 缺少 Key -> `AI服务暂未配置`
- 全局限流 -> `当前 AI 服务较忙，请稍后再试`
- 熔断 -> `AI 故事服务暂时维护中`
- 超时 -> `故事生成超时，请稍后再试`
- 提供商失败或标准化失败 -> `AI 故事暂时生成失败，请稍后再试`
- 放大镜为空 -> `放大镜不足，暂时无法继续探索。`
- 当日总次数已满 -> `今天的探索次数已用完，请明天再来。`
- 同地点同标签达到 3 次 -> `这个地点的该类故事今天已经探索 3 次了。`

技术约束：

- 不能把 DeepSeek 原始错误体返回前端
- 不能把 API Key 打进日志
- 不能把 JSON 解析错误细节直接展示给用户

## 10. 明确不在本轮范围内

当前版本不包含：

- Tencent LBS WebService
- `searchPlaces`
- `wx.getLocation`
- 图片输入
- 生成结果落库
- AI 缓存池
- 月度限制
