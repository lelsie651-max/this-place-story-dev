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
-> 读取 mock `magnifyingGlass`
-> 额度充足时显示请求遮罩
-> `wx.cloud.callFunction({ name: "generateStory" })`
-> 云函数调用 DeepSeek
-> 标准化 JSON 故事结果
-> 写入 `app.globalData.pendingGeneratedStory`
-> 打开 `pages/story/story?generatedStory=1`

`民间传说` 保持现有流程：

`location`
-> 优先查询当前地点预设故事
-> 命中后直接进入 `story`
-> 未命中时调用 `generateStory`
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
    "source": "deepseek"
  }
}
```

失败返回：

```json
{
  "ok": false,
  "error": {
    "code": "AI_USER_LIMIT",
    "message": "今日 AI 故事生成次数已用完，请明天再来。"
  }
}
```

当前错误码：

- `INVALID_INPUT`
- `CONFIG_ERROR`
- `UNAUTHORIZED`
- `AI_USER_LIMIT`
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

- 项目侧通过 `generateStory` 的服务端限额控制本项目请求量
- DeepSeek 账户侧仍需额外配置余额提醒、消费预警或 API 使用限制
- 如果 DeepSeek 控制台没有硬性消费上限，则项目侧全局每日上限是最后一道保护
- 任何余额不足、服务商错误、超时或解析失败都不能扣放大镜

CloudBase 云函数平台超时要求：

- `generateStory` 的云函数平台超时时间必须配置为至少 `30 秒`
- 建议在 CloudBase 控制台中将函数超时配置为 `60 秒`
- 云函数平台超时时间不能短于外部 DeepSeek 请求超时，否则平台会先中断执行

## 5. AI 输出契约

模型被要求只返回 JSON：

```json
{
  "title": "string",
  "content": "string"
}
```

故事约束：

- 必须围绕当前地点生成
- 使用地点名称、城市和简介作为上下文
- `AI说` 属于 AI 观察和想象，不冒充真实历史事实
- `民间传说` 回退生成时要有传说讲述感，但仍然属于 AI 生成，不冒充真实民俗档案
- 不捏造具体历史人物、年代或官方事件
- 最终展示内容中不出现提示词、字段名或 JSON 代码块
- 正文必须能直接展示在故事详情页
- 控制在适中的展示长度
- 标题最大 `80` 字
- 正文最大 `2000` 字
- 不生成违法、色情、仇恨或危险内容

## 6. 服务端限流与并发保护

当前 `generateStory` 只在服务端执行 AI 调用保护，前端不会单独承担这些限制。

当前集中常量：

- 单用户每日最多 `10` 次 AI 上游请求
- 全局每日最多 `200` 次 AI 上游请求
- 单次上游请求超时 `60 秒`
- 单次地点输入长度上限
- 标题最大 `80` 字
- 正文最大 `2000` 字
- 短时间重复请求锁窗口 `70 秒`

当前使用的集合：

- `ai_usage_daily`

当前最小可靠实现：

- 以 `date + userId` 记录用户侧每日计数
- 以 `date` 记录全局每日计数
- 文档至少包含以下字段：
  - `date`
  - `userId`
  - `userCount`
  - `globalCount`
  - `updatedAt`
- 用户侧文档还会记录短时间重复请求保护所需的锁字段
- 使用 CloudBase 事务更新计数，避免并发请求绕过限制

当前计数规则：

- 只有真正准备发起 DeepSeek 上游请求时，才消耗一次 AI 调用次数
- JSON 标准化失败后的重试，会再次发起上游请求，因此会再次计入 AI 调用次数
- 放大镜仍然只在整次故事生成成功后扣除一次

当前熔断开关：

- 环境变量：`AI_CIRCUIT_OPEN`
- 取值为 `1/true/open/on` 时，云函数直接返回 `AI_CIRCUIT_OPEN`
- 熔断开启时不调用 DeepSeek

当前短时间重复请求保护：

- 前端继续保留 `requestLock`
- 云函数端按 `userId + 请求内容` 加短时间锁
- 同一用户短时间内重复点击，不会并发发起多次 DeepSeek 请求

## 7. 故事详情页接收策略

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

## 8. 放大镜规则

当前规则：

- 只有故事请求成功后才扣 1 枚放大镜
- 余额为 `0` 时不调用云函数
- AI 生成失败时不扣
- 没有可用结果时不扣
- 达到单用户每日上限时不扣
- 达到全局每日上限时不扣
- 熔断开启时不扣
- 超时或非法 JSON 时不扣

当前共享规则：

- 每次成功探索一篇故事都扣 1 枚放大镜
- 失败不扣额度

当前额度来源：

- `miniprogram/services/userService.js` 中的 mock 用户

## 9. 失败处理

小程序端失败处理：

- 关闭请求遮罩
- 释放 `requestLock`
- 展示友好错误提示
- 不影响 `民间传说` 现有流程

示例：

- 缺少 Key -> `AI服务暂未配置`
- 单用户限流 -> `今日 AI 故事次数已用完，请明天再来`
- 全局限流 -> `当前 AI 服务较忙，请稍后再试`
- 熔断 -> `AI 故事服务暂时维护中`
- 超时 -> `故事生成超时，请稍后再试`
- 提供商失败或标准化失败 -> `AI 故事暂时生成失败，请稍后再试`

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
- 正式用户额度持久化
