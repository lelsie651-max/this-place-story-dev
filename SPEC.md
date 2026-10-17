# 此地有传说 SPEC

## 1. 文档目的

本文档用于冻结《此地有传说》当前 Demo 设计、已确认的未来约束与开发纪律。

后续每个 Sprint 在开始前必须先读取本文件，并明确区分：

- 当前已经实现
- 当前仅用于 Demo
- 已经确定但尚未实现
- 暂未决定或延期

本文档不是宣传文案，也不是愿景草稿。凡写入“当前已实现”的内容，必须能在当前代码中找到对应实现；凡写入“已确认未实现”或“延期”的内容，不得在开发汇报中表述成“已经完成”。

---

## 2. 产品定位

### 2.1 项目名称

此地有传说

### 2.2 产品定义

《此地有传说》是一个以地点为入口的 AI 故事探索小程序。

用户将来可以：

- 搜索或选择一个地点
- 选择故事类型
- 探索该地点的一篇故事
- 收藏故事
- 后续创建和分享自己的故事

### 2.3 当前定位说明

当前项目仍处于可演示的产品 Demo 阶段。

当前代码已经具备“地点 -> 类型 -> 单篇故事 -> 收藏”的基础浏览链路，但尚未接入正式地图搜索、AI 生成、正式用户体系与完整探索限制规则。

---

## 3. 首页入口

### 3.1 已冻结的首页主入口

首页最终保留两个主要入口：

1. 探索故事
2. 创建故事

### 3.2 已实现

当前首页已经实现：

- “寻找传说”入口
- “分享传说”入口
- 首页左上安全区内的头像入口进入个人中心

对应代码行为：

- `寻找传说` 当前进入地点选择页 `pages/discovery/discovery`
- `分享传说` 当前进入 `pages/publish/publish`
- 头像按钮进入 `pages/profile/profile`

### 3.3 已确认但尚未完全收口

文案层面允许后续把“寻找传说”统一收口为“探索故事”，但不应改变其作为主入口的职责。

### 3.4 暂未决定或延期

- 首页是否接入真实搜索框
- 首页是否接入地图入口
- 首页是否展示推荐地点或推荐故事

---

## 4. 当前 Demo 流程

### 4.1 当前 Demo 主流程

当前 Demo 流程冻结为：

首页  
-> 选择地点  
-> 地点详情  
-> 选择故事类型  
-> 检查放大镜  
-> 显示请求处理动画  
-> 查询一篇符合条件的故事  
-> 扣除一次放大镜  
-> 进入故事详情页

### 4.2 当前代码中已实现的页面链路

当前实际页面链路为：

`pages/index/index`
-> `pages/discovery/discovery`
-> `pages/location/location`
-> `pages/story/story`

### 4.3 当前 Demo 的边界

当前 Demo 中：

- 地点来自 CloudBase `locations`
- `民间传说` 当前先查预设内容，未命中时回退 DeepSeek 生成
- `AI说` 当前始终走 DeepSeek 生成
- `网友说` 当前只读取网友投稿内容，不调用 AI
- 当前不依赖腾讯位置服务 WebService/API Key
- 腾讯位置服务 WebService 和 `searchPlaces` 云函数当前不接入前端
- 暂不接地图搜索 API
- 暂不实现正式微信用户体系
- 暂不实现月度限制
- 暂不实现故事池历史去重

### 4.4 当前仅用于 Demo

当前放大镜属于 mock 资源，存在于 `userService.js` 的内存对象中，不是正式持久化额度系统。

---

## 5. 页面职责冻结

### 5.1 首页 `pages/index/index`

#### 当前已经实现

- 展示产品标题与副标题
- 提供“寻找传说”入口
- 提供“分享传说”入口
- 提供头像进入个人中心

#### 禁止事项

- 不得让首页直接展示故事详情
- 不得让首页绕过地点选择直接进入多篇故事列表

### 5.2 地点选择页 `pages/discovery/discovery`

#### 当前已经实现

- 从 CloudBase 加载已发布地点
- 默认展示系统推荐地点
- 支持对当前已加载的地点进行本地关键词筛选
- 提供“在地图中选择地点”入口
- 通过 `wx.chooseLocation` 打开微信地图选点
- 先标准化微信选点结果，再尝试匹配已有 `locations`
- 命中已有地点时复用真实 `locations._id`
- 未命中时进入临时选定地点状态
- 展示地点列表
- 点击地点后带 `locationId` 进入 `pages/location/location`

#### 已冻结职责

`discovery` 只负责地点选择，不负责故事查询，不负责标签选择，不直接展示故事详情。

当前 `discovery` 里的地点来源需明确区分为：

- 当前已实现：系统推荐地点
- 当前临时能力：对已加载推荐地点做本地筛选
- 当前已接入：微信原生地点选择 `wx.chooseLocation`
- 当前排除方案：`wx.choosePoi` 已完成真机验证，但因原始经纬度为 `0,0`，不进入正式流程
- 当前不接入：`wx.getLocation` 不进入自动定位流程

当前地点选择边界冻结为：

- 推荐地点与本地筛选继续保留
- 微信地图选点正式接入，但不替代推荐地点列表
- 不实现全国 POI 文本搜索
- 不依赖腾讯位置服务 WebService/API Key
- 微信原生选点结果不等同于自定义 POI 搜索 API

#### 禁止事项

- 不得在 `discovery` 中直接查询并跳单篇故事
- 不得在地点选择之前插入故事类型选择逻辑
- 不得把本地地点筛选描述成地图搜索或全国 POI 搜索

### 5.3 地点详情与类型选择页 `pages/location/location`

#### 当前已经实现

- 展示地点名称、城市、简介、线索信息
- 展示当前 mock 放大镜数量
- 支持真实系统地点详情
- 支持微信地图未命中后的临时选定地点
- 提供故事类型选择：
  - `folk`
  - `ai_comment`
  - `traveler`
- 对可用类型发起请求
- 使用全屏遮罩和动画表达请求处理中
- 使用代码层请求锁防止连续触发
- `folk` 当前先查询当前地点的预设故事，未命中时调用云函数 `generateStory`
- `ai_comment` 当前始终调用云函数 `generateStory`
- `traveler` 当前只查询网友投稿内容，不调用 AI
- 正式地点在“网友说”无内容时，当前显示空状态，并提供“我来分享 / 返回”两个按钮
- 临时地点当前不展示正式“网友说”故事，但会给出投稿受限提示

#### 已冻结职责

`location` 页是“选定地点后的故事类型选择页”，不再承担“渲染该地点下全部故事列表”的职责。

#### 当前 Demo 限定

- 临时地点下的 `traveler` 不读取正式 stories，也不允许投稿落库
- 当前只会按地点 + 类型返回一篇故事

#### 禁止事项

- 不得在 `location` 页面继续使用 `wx:for` 全量展示该地点全部故事
- 不得把“地点页故事列表”当成正式产品流程

### 5.4 故事详情页 `pages/story/story`

#### 当前已经实现

- 通过 `storyId` 加载单篇故事详情
- 支持读取本次生成的临时 AI 故事
- 兼容 `type` 与 `locationId` 的旧入口
- 支持收藏和取消收藏
- 支持正常返回上一页，缺失上级页时回首页

#### 已冻结职责

`story` 页只负责展示当前选中的一篇故事，不负责在同页展示该地点其他故事列表。

#### 当前 AI 最小闭环约束

- 生成结果当前不写入 CloudBase `stories`
- 页面通过 `app.globalData.pendingGeneratedStory` 暂存本次 AI 结果
- `generatedStory=1` 入口只用于刚生成的单次阅读
- 当前 AI 生成故事暂不支持收藏
- 微信地图未命中的临时选点故事同样不落库，也不进入收藏链路

### 5.6 分享页 `pages/publish/publish`

#### 当前已经实现

- 当前正式分享页真实路径为 `pages/publish/publish`
- 页面已有标题输入框、正文输入框和提交按钮
- 从正式地点点击“我来分享”时，会自动带入：
  - 真实 `locationId`
  - `locationName`
  - `address`
  - `latitude`
  - `longitude`
- 标题或正文为空时，不调用投稿云函数
- 标题和正文超长时，前端直接提示
- 投稿期间使用提交锁防止重复点击
- 投稿成功后返回地点页，并提示“投稿已提交，审核通过后会展示。”

#### 当前已冻结边界

- 临时地点不能写入正式 `stories`
- 不自动创建新的正式 `locations`
- 不把地点名称、`poiid` 或任意字符串伪装成 `locationId`
- 不信任前端传入的 `authorId`、`source`、`type`、`status`

### 5.5 个人中心 `pages/profile/profile`

#### 当前已经实现

- 展示 mock 用户资产中的放大镜数量
- 展示收藏数量
- 提供图鉴、收藏等入口

#### 当前仅用于 Demo

- 用户资料、资产和图鉴仍以 mock 数据为主
- 个人中心尚未接入正式登录体系

---

## 6. 故事类型

### 6.1 当前已使用

- `folk`：民间传说
- `ai_comment`：AI说
- `traveler`：网友说

### 6.2 当前冻结的语义

当前代码继续保留兼容枚举值：

- `folk` -> 民间传说
- `ai_comment` -> AI说
- `traveler` -> 网友说

其中：

- `type` 表示展示模式
- `source` 表示真实内容来源

当前 source 兼容值与映射关系：

- `preset` / `folk_archive` -> 预设库
- `ai_observer` / `deepseek` -> AI 生成
- `user` -> 网友投稿

### 6.3 已确认但尚未实现

以后允许增加更多内容类型或 tags，例如：

- 趣事
- 新闻
- 民俗
- 无厘头
- 地方记忆

### 6.4 约束

新增类型必须同时更新：

- 文档说明
- 页面展示文案
- 数据查询逻辑
- 测试数据

不得随意复用旧值表达新含义。

---

## 7. 当前数据与查询规则

### 7.1 locations

当前代码实际读取的字段包括：

- `_id`
- `name`
- `city`
- `province`
- `country`
- `latitude`
- `longitude`
- `level`
- `tags`
- `intro`
- `description`
- `status`
- `createdAt`

当前页面层对地点来源的冻结约束：

- 默认列表是系统推荐地点，来源于 CloudBase `locations`
- 当前推荐地点的手动导入模板以 `docs/cloudbase_manual_seed/locations.sprint12.manual.*` 为准
- 当前搜索框只对已加载推荐地点做本地筛选
- 当前未接入外部 POI 搜索结果
- `wx.chooseLocation` 返回的 `name`、`address`、`latitude`、`longitude` 当前已用于：
  - 匹配已有 `locations`
  - 或进入本次临时地点故事流程
- `poiid` 只作为可选辅助字段，不作为系统主键
- `locations._id` 仍然是系统内部地点身份
- 用户选择新地点后，先匹配已有 `locations`，未命中时进入临时地点状态
- 当前不自动创建正式 `locations`
- Sprint 12 的开发验证点“开发验证点·民间传说回退”同样属于 `locations` 集合中的 `published` 地点，应可被 `discovery` 加载与搜索

#### `wx.chooseLocation` 标准输入契约

当前冻结的标准化输入对象为：

```json
{
  "source": "wechat_chooseLocation",
  "name": "地点名称",
  "address": "详细地址",
  "latitude": 22.790329,
  "longitude": 114.72781,
  "poiid": "nearby_xxx"
}
```

约束如下：

- `source` 固定为 `wechat_chooseLocation`
- `name` 必须是 `trim` 后的非空字符串
- `address` 可以为空，但必须保留原始值与标准化值的区别
- `latitude` / `longitude` 必须是有效数字
- `latitude` 范围必须在 `-90` 到 `90`
- `longitude` 范围必须在 `-180` 到 `180`
- `latitude = 0` 且 `longitude = 0` 视为无效坐标
- `poiid` 只能作为可选辅助字段
- `poiid` 不得直接作为 `locations._id`
- `poiid` 不得伪装成 `providerPlaceId`
- 不假设 `poiid` 永久稳定

#### `wx.chooseLocation` 匹配结果契约

当前冻结的匹配判断结果对象为：

```json
{
  "status": "matched",
  "locationId": "已有 locations._id",
  "selectedPlace": {
    "source": "wechat_chooseLocation",
    "name": "地点名称",
    "address": "详细地址",
    "latitude": 22.790329,
    "longitude": 114.72781,
    "poiid": "nearby_xxx"
  },
  "matchReason": "名称、地址和坐标与现有地点可靠一致"
}
```

`status` 的含义冻结为：

- `invalid_input`：地点名称为空、坐标非法、或选择结果缺少必要字段
- `matched`：已能可靠判断对应已有 `locations`，返回真实 `locationId`
- `candidate`：找到一个或多个可能匹配项，但不能直接进入已有地点
- `unmatched`：当前没有可靠对应的 `locations`，也不能伪造 `locationId`，按临时地点处理

#### 候选列表契约

当出现多个可能地点时，冻结的候选结果对象为：

```json
{
  "status": "candidate",
  "selectedPlace": {
    "source": "wechat_chooseLocation",
    "name": "地点名称",
    "address": "详细地址",
    "latitude": 22.790329,
    "longitude": 114.72781,
    "poiid": "nearby_xxx"
  },
  "candidates": [
    {
      "locationId": "loc_nantou_city",
      "name": "南头古城",
      "address": "",
      "latitude": 22.5333,
      "longitude": 113.9294,
      "matchReason": "名称高度接近，但需要进一步确认是否为同一地点",
      "confidence": "medium"
    }
  ]
}
```

约束如下：

- 候选项必须使用真实 `locations._id`
- 不得生成临时伪造 `_id`
- 不得因为搜索词相同就直接合并
- 每个候选项必须能解释进入候选列表的原因

### 7.2 stories

当前代码实际读取的字段包括：

- `_id`
- `locationId`
- `type`
- `title`
- `summary`
- `content`
- `source`
- `language`
- `authorId`
- `status`
- `createdAt`

### 7.3 favorites

当前代码实际读取和写入的字段包括：

- `_id`
- `userId`
- `storyId`
- `locationId`
- `createdAt`

### 7.4 当前发布状态约束

当前地点和故事查询都以 `status = "published"` 为可见条件。

### 7.5 当前地点查询规则

`locations` 当前用于 Demo 的主要查询规则：

- 读取已发布地点
- 按 `createdAt desc`
- `limit 20`

### 7.6 当前单篇故事查询规则

地点和类型选择后，当前查询条件为：

- `locationId == 当前地点 ID`
- `type == 用户选择的类型`
- `status == "published"`

若同一地点同一类型存在多篇故事：

- 当前 Demo 在 `stories` 层随机选择一篇

当前预设故事导入模板以 `docs/cloudbase_manual_seed/stories.sprint12.manual.template.*` 为准，导入前必须把模板中的 `locationId` 占位符替换成真实 `locations._id`。
如果 stories 文件里仍保留 `<填写真实 locations._id>`，禁止直接导入；当前推荐先使用 `docs/cloudbase_manual_seed/validate_story_import.js` 做本地导入前校验。

### 7.7 当前三种入口路径

- 民间传说：
  - 先查 `locationId + type = folk + status = published`
  - 仅 `source = preset / folk_archive` 的预设来源命中时直接展示
  - 未命中时调用 `generateStory`
  - AI 回退生成结果的展示模式仍为 `民间传说`
  - AI 回退生成结果的真实来源必须是 `deepseek`
  - 开发验证点“开发验证点·民间传说回退”在正式导入时不得存在任何 `type = folk` 且 `status = published` 的预设故事

- AI说：
  - 始终调用 `generateStory`
  - 展示模式为 `AI说`
  - 真实来源为 `deepseek`

- 网友说：
  - 只读取网友投稿内容
  - 不调用 `generateStory`
  - 当前优先识别 `source = user`，并兼容现有 `traveler` 类型值
  - 正式地点无网友投稿时显示空状态与投稿入口
  - 临时地点不展示正式网友投稿，也不能写入正式 `stories`

微信 `wx.chooseLocation` 未命中的地点当前只生成临时故事：

- 不写入正式 `stories`
- 不进入正式收藏链路
- 不改变 CloudBase 中已导入的预设地点与预设故事

---

## 8. 正式产品的故事池设计

### 8.1 已确认的未来设计

- 一个真实地点对应一个 `locations` 记录
- 一个地点可以拥有多条 `stories`
- 同一个 POI 的当前故事池最多保留 10 条可展示故事
- 用户每次选择地点和类型后，只返回一篇故事
- 随机选择发生在 `stories` 层，不发生在 `locations` 层

### 8.2 当前尚未实现

- 10 条故事池上限控制
- 运行时故事池维护
- 池内故事替换与刷新策略

---

## 9. 用户探索限制

### 9.1 已确认的未来设计

正式产品计划采用：

- 同一个用户
- 同一个地点
- 同一个自然月
- 最多成功探索 5 次

每次优先排除该用户本月已经看过的 `storyId`。

用户最多看到故事池中的 5 条，不要求看完 10 条。

达到 5 次后，本月不能继续探索该地点。

### 9.2 当前尚未实现

- 用户本月探索次数统计
- 按月去重逻辑
- 本月已看故事排除
- 达到上限后的拦截
- 月度刷新

### 9.3 数据模型预留要求

未来实现月度限制时，相关记录必须预留月份或周期字段，不得事后用模糊字符串补丁式拼接。

---

## 10. 放大镜商业规则

### 10.1 已确认规则

无论故事来自：

- AI 新生成
- 云端缓存
- 预存人工内容

用户每次成功探索一篇故事都扣除一次放大镜。

用户不应看到故事是否来自缓存。

### 10.2 当前 Demo 已实现

当前 Demo 已实现以下流程：

1. 选择地点和类型
2. 检查 mock 放大镜余额
3. 对 `folk` 先查预设故事，未命中时调用生成云函数；对 `AI说` 始终调用生成云函数；对 `traveler` 只查网友投稿
4. 成功后扣除一次
5. 进入故事详情

### 10.3 当前 Demo 已实现的失败规则

以下情况不扣除放大镜：

- 请求失败
- 没有故事
- 放大镜不足
- AI 生成失败

### 10.4 当前已实现的交互保护

- 请求处理中使用全屏遮罩
- 请求处理中使用动画
- 保留代码层请求锁，防止重复点击

### 10.5 当前仅用于 Demo

当前放大镜扣减只写在 mock `userService` 内存对象中，不做 CloudBase 持久化。

---

## 11. ID 和关联规则

### 11.1 locations

- 一个真实地点只对应一条记录
- `locations._id` 必须唯一

### 11.2 stories

- 每条故事对应一条记录
- `stories._id` 必须唯一
- `stories.locationId` 必须等于真实 `locations._id`

### 11.3 预存地点和人工维护故事

- 可以手动指定 `_id`

### 11.4 运行时新增地点和 AI 故事

- 可以使用 CloudBase 自动生成 `_id`
- 创建 `stories` 时必须使用新增地点返回的真实 `_id` 作为 `locationId`

#### 当前 Sprint 9-A 例外说明

- 当前 AI 生成故事不落库，因此不会在本轮创建 CloudBase `stories` 记录
- 当前云函数返回的 `storyId` 仅用于本次前端会话内标识生成结果
- 业务代码当前不会拿这个临时 `storyId` 去查询 CloudBase `stories`

### 11.5 已冻结的工程约束

业务代码不得依赖固定前缀或固定长度的 `_id`。

### 11.6 `wx.chooseLocation` 与内部地点身份规则

- `wx.chooseLocation` 返回的是用户选择结果，不是持久化后的 `locations`
- `selectedPlace` 与正式 `locations` 必须明确区分
- `locations._id` 仍然是系统内部地点身份
- `poiid` 只作为辅助匹配字段，不作为系统主键
- 当前已实现：
  - 标准化微信选点结果
  - 尝试匹配已有 `locations`
  - 命中时复用真实 `locations._id`
  - 未命中时进入临时选定地点状态
- 当前不执行 CloudBase 写入
- 新地点自动创建属于后续独立 Sprint

---

## 12. 当前已实现内容

以下内容已经能在当前代码中找到对应实现：

- 首页进入地点选择页
- 地点列表展示
- 对已加载地点的本地关键词筛选
- `wx.chooseLocation` 打开微信地图选点
- 微信选点命中已有地点时复用真实 `locationId`
- 微信选点未命中时进入临时地点故事流程
- 地点详情展示
- 故事类型选择
- 按地点和类型查询单篇故事
- 多条命中时随机返回一篇
- 请求遮罩和请求锁
- mock 放大镜扣除
- 个人中心与探索页面的额度同步
- 故事详情页通过真实 `storyId` 加载
- 收藏和取消收藏
- 收藏数量展示
- `AI说` 最小闭环：地点详情页调用 `generateStory`，成功后进入故事详情页
- 微信地图未命中地点也可进入 `folk` / `AI说` 的 AI 生成链路
- 故事详情页支持读取内存中的单次生成结果

---

## 13. 当前仅用于 Demo

以下内容当前存在，但仅用于演示，不代表正式产品最终实现方式：

- `userService.js` 中的 mock 用户
- `magnifyingGlass` 的本地内存扣减
- 手动导入的测试地点与故事数据
- `traveler` 类型的占位状态
- 通过 CloudBase 预置内容完成故事探索演示
- 通过 `app.globalData.pendingGeneratedStory` 传递单次 AI 生成结果

---

## 14. 当前未实现内容

以下内容明确尚未实现：

- 地图和 POI 搜索 API
- 全国 POI 文本搜索
- `wx.chooseLocation` 接入正式 UGC / 新故事入口
- 微信原生选点结果落库与正式 `locations` 复用
- POI 去重与新地点落库的正式实现
- 附近地点搜索
- 外部地图服务商接入
- 地理位置授权
- 运行时新增地点
- AI 生成结果落库
- AI 生成结果缓存池
- AI 生成故事收藏支持
- 正式 AI Prompt 策略治理
- 正式故事池
- 用户历史去重
- 月度 5 次限制
- 月度故事刷新
- 正式微信用户身份
- 正式 CloudBase 用户额度持久化
- UGC 创建故事
- 网友说内容
- 更多故事 tags

---

## 15. 暂未决定或延期

以下内容当前明确延期，后续需要单独决策，不得默认为已批准：

- 首页真实搜索入口的交互形态
- 地图选点与 POI 搜索的产品入口
- 附近地点搜索
- 地理位置授权
- 地图服务 API
- 腾讯位置服务 WebService / API Key 方案当前不再采用
- 运行时新增地点
- POI 去重和新地点落库
- “创建故事”正式提交流程
- AI 生成策略和 Prompt 设计
- 正式额度计费、购买与消耗方案
- 推荐内容、编辑精选或运营位
- traveler 内容审核、展示和上线节奏

---

## 16. 测试数据说明

`docs/cloudbase_manual_seed/` 目录下当前用于 Demo 验收的测试数据包括：

- `locations.manual.json`
- `stories.manual.json`
- 对应的 `csv/jsonl` 导入文件

当前测试数据中：

- 一个地点可对应多条故事
- 不同类型故事通过 `stories.locationId -> locations._id` 关联
- 导入样例允许手动指定 `_id`

这些文件属于测试数据与说明文档，不得拿来替代正式 schema 文档，也不得通过删除测试数据来掩盖流程问题。

当前 `discovery` 页支持的搜索仅限于对已加载 `locations` 数据做本地关键词筛选：

- 不会创建新地点
- 不会改变 `locations._id`
- 搜索结果点击后仍进入原有 `location` 页面
- 不会替代地图 API、全国 POI 搜索或运行时新增地点

最终产品中的地点入口仍需区分两层来源：

- 系统推荐地点：来自已发布的 `locations`
- 用户主动选点结果：当前正式入口为微信原生 `wx.chooseLocation`

当前本地筛选仍然只是推荐地点的临时辅助能力，不得把它描述成已完成的全国地点搜索。

微信原生地点选择候选方案的当前约束为：

- CloudBase 推荐地点与本地筛选继续保留
- `wx.chooseLocation` 当前已接入正式地点选择流程
- `wx.choosePoi` 已完成真机验证，但当前原始经纬度为 `0,0`，不用于正式流程
- `wx.getLocation` 当前不接入自动定位流程
- 当前不实现全国 POI 文本搜索
- 当前不依赖腾讯位置服务 WebService Key
- 微信原生返回的是用户主动选择的地点信息，不等同于自定义 POI 搜索 API
- 后续 UGC 地点可先保存 `name`、`address`、`latitude`、`longitude`
- `poiid` 只作为可选辅助字段，不作为系统主键
- 当前不把微信返回结果伪装成 `providerPlaceId`
- 当前不自动创建正式 `locations` 记录
- 当前正式页面通过“临时地点”状态承接未命中的微信选点结果

临时测试页说明：

- 当前仓库已移除 `locationPickerTest` 测试页与相关前端入口
- 当前正式页面不保留原生地点接口测试能力
- 当前 `app.json` 只保留 `chooseLocation` 所需的 `requiredPrivateInfos` 与 `scope.userLocation` 配置
- 微信后台仍需补充 `chooseLocation` 相关隐私声明后才能用于正式提审

`wx.chooseLocation` 的当前匹配边界冻结为：

- 先校验标准输入对象，再进入匹配判断
- 只在 `matched` 时返回真实 `locationId`
- `candidate` 只能进入候选确认，不得直接跳现有地点
- `unmatched` 不得伪造 `locationId`，改为进入临时地点
- 当前只执行前端内存态承接，不执行 CloudBase 写入
- 距离阈值如需参与判断，必须作为待产品确认参数单独冻结

---

## 17. 开发纪律

以后每个 Sprint 必须：

- 先读取 `SPEC.md`
- 说明当前基线 commit
- 只完成一个独立目标
- 明确允许修改和禁止修改的文件
- 不得自行改变已冻结的页面流程
- 不得把“计划功能”当成“已实现功能”
- 不确定时先汇报，不要自行设计

### 17.1 页面流程纪律

未经明确批准，不得擅自把已冻结流程改成其他层级，例如：

- 不得把地点选择移回首页
- 不得把类型选择提前到地点之前
- 不得让地点页重新变成多篇故事列表页

### 17.2 事实描述纪律

以后任何汇报都必须明确区分：

- 当前代码已实现
- 当前 Demo 占位
- 已确认未来设计
- 暂未决定或延期

禁止把未来计划写成当前能力。
