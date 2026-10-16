# DeepSeek AI 故事生成方案

## 1. 文档目的

本文档用于冻结 Sprint 9-A 当前已经实现的 `AI说` 最小闭环。

当前范围：

- `AI说` 通过 CloudBase `generateStory` 调用真实 DeepSeek
- `民间传说` 继续读取 CloudBase 已发布故事
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
-> CloudBase `stories`
-> `storyId`
-> `pages/story/story`

---

## 3. 云函数契约

云函数名称：

- `generateStory`

输入契约：

```json
{
  "locationId": "loc-nantou",
  "locationName": "南头古城",
  "locationDescription": "地点简介",
  "city": "深圳",
  "type": "AI说"
}
```

输入规则：

- `locationId` 必须是非空字符串
- `locationName` 必须是非空字符串
- `locationDescription` 可为空
- `city` 可为空
- `type` 必须等于 `"AI说"`
- 云函数内对文本长度做上限控制
- 客户端不能传 API Key
- 客户端不能传自定义 system prompt

成功返回：

```json
{
  "ok": true,
  "story": {
    "storyId": "generated-unique-id",
    "locationId": "loc-nantou",
    "type": "AI说",
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
    "code": "PROVIDER_ERROR",
    "message": "AI故事生成失败，请稍后重试"
  }
}
```

当前错误码：

- `INVALID_INPUT`
- `CONFIG_ERROR`
- `PROVIDER_ERROR`
- `PROVIDER_TIMEOUT`
- `NORMALIZATION_ERROR`

---

## 4. DeepSeek 提供商配置

当前提供商配置：

- Base URL：`https://api.deepseek.com`
- API Path：`/chat/completions`
- Model：`deepseek-flash`
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
- 不捏造具体历史人物、年代或官方事件
- 最终展示内容中不出现提示词、字段名或 JSON 代码块
- 正文必须能直接展示在故事详情页
- 控制在适中的展示长度
- 不生成违法、色情、仇恨或危险内容

## 6. 故事详情页接收策略

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

## 7. 放大镜规则

当前规则：

- 只有故事请求成功后才扣 1 枚放大镜
- 余额为 `0` 时不调用云函数
- AI 生成失败时不扣
- 没有可用结果时不扣

当前共享规则：

- 每次成功探索一篇故事都扣 1 枚放大镜
- 失败不扣额度

当前额度来源：

- `miniprogram/services/userService.js` 中的 mock 用户

## 8. 失败处理

小程序端失败处理：

- 关闭请求遮罩
- 释放 `requestLock`
- 展示友好错误提示
- 不影响 `民间传说` 现有流程

示例：

- 缺少 Key -> `AI服务暂未配置`
- 超时 -> `AI故事生成超时，请稍后重试`
- 提供商或标准化失败 -> 友好重试提示

## 9. 明确不在本轮范围内

当前版本不包含：

- Tencent LBS WebService
- `searchPlaces`
- `wx.getLocation`
- 图片输入
- 生成结果落库
- AI 缓存池
- 月度限制
- 正式用户额度持久化
