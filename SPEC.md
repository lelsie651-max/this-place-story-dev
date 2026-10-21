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
- 品牌文案附近显示项目标语“让地点拥有不同的声音”

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

当前放大镜初始值仍沿用 Demo 默认值 `5`，但成功使用次数和扣减已通过服务端云函数统一处理。

---

## 5. 页面职责冻结

### 5.1 首页 `pages/index/index`

#### 当前已经实现

- 展示产品标题与品牌副文案
- 英文品牌文案位于中文标题下方，并作为弱化辅助信息显示
- 提供“寻找传说”入口
- 提供“分享传说”入口
- 提供头像进入个人中心
- 首页底部显示公司名称“深圳市筠竹科技有限公司”

#### 禁止事项

- 不得让首页直接展示故事详情
- 不得让首页绕过地点选择直接进入多篇故事列表

### 5.2 地点选择页 `pages/discovery/discovery`

#### 当前已经实现

- 从 CloudBase 加载已发布地点
- 默认展示系统推荐地点
- 顶部标题当前使用与首页一致的中英文层级，英文位于中文标题下方
- 提供“选择你的位置”入口
- 通过 `wx.chooseLocation` 打开微信地图选点
- 先标准化微信选点结果，再尝试匹配已有 `locations`
- 命中已有地点时复用真实 `locations._id`
- 未命中时进入临时选定地点状态
- 展示地点列表
- 最近 7 天内创建的地点会显示 `NEW`
- 推荐地点卡片点击会异步记录一次真实 `viewCount`
- `HOT` 标签只在 `viewCount > 1000` 时显示
- 点击地点后带 `locationId` 进入 `pages/location/location`

#### 已冻结职责

`discovery` 只负责地点选择，不负责故事查询，不负责标签选择，不直接展示故事详情。

当前 `discovery` 里的地点来源需明确区分为：

- 当前已实现：系统推荐地点
- 当前已接入：微信原生地点选择 `wx.chooseLocation`
- 当前排除方案：`wx.choosePoi` 已完成真机验证，但因原始经纬度为 `0,0`，不进入正式流程
- 当前不接入：`wx.getLocation` 不进入自动定位流程

当前地点选择边界冻结为：

- 推荐地点列表继续保留
- 微信地图选点正式接入，但不替代推荐地点列表
- 不实现全国 POI 文本搜索
- 不依赖腾讯位置服务 WebService/API Key
- 微信原生选点结果不等同于自定义 POI 搜索 API

#### 禁止事项

- 不得在 `discovery` 中直接查询并跳单篇故事
- 不得在地点选择之前插入故事类型选择逻辑
- 不得向用户展示“预设库”等内部来源概念

### 5.3 地点详情与类型选择页 `pages/location/location`

#### 当前已经实现

- 顶部显示固定中文标题“地点详情”，并在其下显示 `LOCATION VIEW`
- 顶部右侧显示当前放大镜数量
- 展示地点名称与当前地点地址信息
- 支持真实系统地点详情
- 支持微信地图未命中后的临时选定地点
- 提供故事类型选择：
  - `folk`
  - `ai_comment`
  - `traveler`
- 对可用类型发起请求
- 使用全屏遮罩和动画表达请求处理中
- AI 请求进行中时，遮罩主文案使用前端本地随机词条，并每 5 秒轮换一次
- AI 请求进行中时，遮罩固定显示“后续内容将由人工智能生成，仅供娱乐与参考”
- 使用代码层请求锁防止连续触发
- 点击 `folk` / `ai_comment` 前，前端会先向服务端预检本次放大镜使用资格
- `folk` 当前先查询当前地点的预设故事，未命中时调用云函数 `generateStory`
- `ai_comment` 当前始终调用云函数 `generateStory`
- `traveler` 当前只查询网友投稿内容，不调用 AI
- 点击 `traveler` 当前进入独立网友故事页面

#### 已冻结职责

`location` 页是“选定地点后的故事类型选择页”，不再承担“渲染该地点下全部故事列表”的职责。

#### 当前 Demo 限定

- 临时地点下的 `traveler` 不读取正式已发布网友投稿，也不会误查其他地点
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
- `AI说` 与 `民间传说` 的 AI 回退结果当前统一使用论坛帖子式展示
- AI 帖子头部会显示本地头像、`displayName`、`role` 及仅用于页面展示的身份说明
- `民间传说` 的 AI 回退结果会额外显示“民间传说 · AI生成”
- `storyMeta` 缺失时，会安全降级为默认身份：
  - 名称：`AI观察者`
  - 身份：`地点故事生成器`
  - 默认头像
- 预设故事与网友投稿保持原有展示逻辑，不伪造 AI 身份

#### 已冻结职责

`story` 页只负责展示当前选中的一篇故事，不负责在同页展示该地点其他故事列表。

#### 当前 AI 最小闭环约束

- 生成结果当前不写入 CloudBase `stories`
- 页面通过 `app.globalData.pendingGeneratedStory` 暂存本次 AI 结果
- `generatedStory=1` 入口只用于刚生成的单次阅读
- `pendingGeneratedStory` 当前必须完整保留：
  - `title`
  - `content`
  - `type`
  - `source`
  - `generated`
  - `storyMeta`
  - `locationName`
  - `locationId`
  - `isTemporary`
  - `selectedPlace`
- 当前 AI 生成故事暂不支持收藏
- 微信地图未命中的临时选点故事同样不落库，也不进入收藏链路

### 5.5 网友故事页 `pages/userStories/userStories`

#### 当前已经实现

- `traveler` 当前会从地点详情页跳转到独立网友故事页面
- 页面会显示当前地点名称和地址信息
- 只查询：
  - `type = traveler`
  - `source = user`
  - `status = published`
- 不查询 `folk`
- 不查询 `deepseek`
- 不调用 `generateStory`
- 不扣放大镜
- 没有网友投稿时，显示空状态与“我来分享 / 返回”按钮
- “返回”优先使用 `wx.navigateBack()` 返回地点详情页
- 正式地点与临时地点当前都允许从网友故事页进入投稿页
- 临时地点无已发布投稿时，仍显示“暂时没有网友提供故事哦！”
- 公共网友故事页仍然只展示 `status = published`

#### 当前已冻结边界

- 临时地点可以打开网友故事页，也允许投稿进入审核队列
- 临时投稿写入 `stories` 时使用：
  - `locationId = null`
  - `isTemporary = true`
  - `placeSnapshot`
- 独立网友故事页不替代地点详情页的三种故事模式选择

### 5.6 分享页 `pages/publish/publish`

#### 当前已经实现

- 当前正式分享页真实路径为 `pages/publish/publish`
- 页面已有标题输入框、正文输入框和提交按钮
- 支持两种入口：
  - 从网友故事页自动带入当前地点上下文
  - 从首页直接进入后调用 `wx.chooseLocation` 选择地点
- 自动带入或选点后会保留：
  - `locationId`
  - `isTemporary`
  - `placeSnapshot`
  - `locationName`
  - `address`
  - `latitude`
  - `longitude`
- 标题或正文为空时，不调用投稿云函数
- 标题和正文超长时，前端直接提示
- 投稿期间使用提交锁防止重复点击
- 投稿成功后：
  - 从网友故事页进入时返回网友故事页
  - 从首页进入时返回上一页
  - 并提示“投稿已提交，审核通过后会展示。”
- 开发阶段会在控制台保留投稿失败的 `code` 和必要错误信息
- 如果云函数未部署或仍是旧版本，会提示重新部署 `submitStory`

#### 当前已冻结边界

- 不自动创建新的正式 `locations`
- 不把地点名称、`poiid` 或任意字符串伪装成 `locationId`
- 不信任前端传入的 `authorId`、`source`、`type`、`status`
- 正式地点投稿必须使用真实 `locations._id`
- 临时地点投稿必须使用：
  - `locationId = null`
  - `isTemporary = true`
  - `placeSnapshot`

### 5.7 个人中心 `pages/profile/profile`

#### 当前已经实现

- 展示当前用户资产中的放大镜数量
- 在配置真实激励视频广告位且客户端支持时，显示广告奖励入口
- 展示收藏数量
- 提供图鉴、收藏、我的投稿等入口
- “我的投稿”入口当前进入独立页面查看自己的投稿记录与审核状态
- “我的投稿”列表当前固定展示：
  - 标题
  - 地点名称
  - 投稿时间 / 最近修改时间
  - 审核状态
- 点击“我的投稿”卡片进入专用预览页，展示原投稿详情而不是公开故事详情页
- 预览页只读取当前用户自己的投稿，`pending / published / rejected / hidden` 都允许本人查看，`deleted` 不允许再读取
- 预览页在 `pending / rejected` 时显示“编辑”按钮，`published / hidden` 不允许编辑
- 预览页仅在 `rejected` 时显示“删除投稿”按钮，删除采用软删除
- 编辑页不允许重新选择地点，只允许修改标题和正文
- 编辑成功后更新原 `stories` 文档并重新回到 `pending`
- 在 `develop / trial` 环境显示“开发测试工具”入口，具体操作需在页面内输入开发测试口令
- 当前支持展示：
  - `pending` -> 审核中
  - `published` -> 已通过
  - `rejected` -> 未通过
  - `hidden` -> 已隐藏

#### 当前广告奖励约束

- 激励视频广告只允许用户主动点击后播放
- 未配置真实 `adUnitId`、广告接口不可用或云函数不可用时，不显示广告奖励入口
- 完整看完视频后才允许申请奖励
- 中途退出、加载失败、播放失败都不增加放大镜

#### 当前仅用于 Demo

- 用户资料和部分资产展示仍以 mock / 测试态数据为主
- 图鉴第一页当前读取 `explorations` 集合，按 `user + locationId + storyType` 合并展示地点名称、故事类型和最近探索时间
- 只有正式地点成功探索后才记录图鉴足迹；临时地点暂不记录
- 收藏页打开故事不计入新的足迹
- 个人中心尚未接入正式登录体系

#### 开发测试工具边界

- “开发测试工具”只用于 `develop / trial` 真机或体验版测试
- `release` 环境必须隐藏该入口
- 管理员身份只由独立云函数 `devTestControls` 按环境变量中的开发测试口令校验
- 当前用户 `OPENID` 只用于定位当前测试用户自己的数据，不用于管理员鉴权
- 开发测试口令不得写入小程序前端、默认配置或 Git
- 当前测试工具只允许修改测试数据，不得改变正式业务规则：
  - 放大镜余额
  - 当日成功探索次数
  - 同地点同标签次数
  - 请求锁字段
- 该工具不属于正式产品功能，不得在正式对外版本中宣传或开放

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

当前 `location` 页的展示名称允许与内部展示模式分离，但不得改变枚举值或业务流转：

- `folk` -> 民间传说
- `ai_comment` -> 懦词怪说
- `traveler` -> 街谈巷说

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
- `viewCount`

当前页面层对地点来源的冻结约束：

- 默认列表是系统推荐地点，来源于 CloudBase `locations`
- 当前推荐地点的手动导入模板以 `docs/cloudbase_manual_seed/locations.sprint12.manual.*` 为准
- 当前未接入外部 POI 搜索结果
- `wx.chooseLocation` 返回的 `name`、`address`、`latitude`、`longitude` 当前已用于：
  - 匹配已有 `locations`
  - 或进入本次临时地点故事流程
- `poiid` 只作为可选辅助字段，不作为系统主键
- `locations._id` 仍然是系统内部地点身份
- 用户选择新地点后，先匹配已有 `locations`，未命中时进入临时地点状态
- 当前不自动创建正式 `locations`
- Sprint 12 的开发验证点“开发验证点·民间传说回退”同样属于 `locations` 集合中的 `published` 地点，应可被 `discovery` 加载与搜索
- 微信原生临时地点不参与推荐地点 `viewCount` / `HOT` 统计

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
- `updatedAt`
- `deletedAt`

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
  - 临时地点不展示正式网友投稿，也不会误查其他地点
  - `pending` 投稿不会出现在公共网友故事页

微信 `wx.chooseLocation` 未命中的地点当前只生成临时故事：

- 不写入正式 `stories`
- 不进入正式收藏链路
- 不改变 CloudBase 中已导入的预设地点与预设故事

### 7.8 当前网友投稿写入与读取规则

- `submitStory` 云函数固定写入：
  - `type = traveler`
  - `source = user`
  - `status = pending`
  - `authorId = wx.cloud.getWXContext().OPENID`
  - `moderationStatus = manual_only`
  - `manualReviewRequired = true`
  - `moderationProvider = null`
  - `moderationResult = null`
  - `moderationReason = null`
- 正式地点投稿必须使用真实 `locations._id`
- 临时地点投稿必须使用：
  - `locationId = null`
  - `isTemporary = true`
  - `placeSnapshot`
- 个人中心“我的投稿”通过 `getMyStories` 云函数读取当前用户自己的投稿
- “我的投稿”详情通过专用云函数 `getMyStoryById` 读取，必须按 `storyId + authorId(OPENID) + source=user` 约束
- “我的投稿”展示 `pending / published / rejected / hidden`
- 当投稿 `status = rejected` 时：
  - 优先展示 `rejectionReason`
  - 未提供时显示“暂未提供具体原因”
- “我的投稿”时间显示规则：
  - 有 `updatedAt` 时显示“最近修改时间”
  - 没有 `updatedAt` 时显示“投稿时间”
  - 不允许用编辑时间覆盖 `createdAt`
- 公共网友故事页只展示 `published`
- 普通 `storyId` 详情链路只允许打开 `status = published` 的故事
- 编辑投稿时：
  - 只允许 `pending / rejected`
  - 必须保留原 `_id / createdAt / locationId / isTemporary / placeSnapshot / authorId / source / type / language`
  - 更新 `title / summary / content / status / updatedAt`
  - `status` 必须重置为 `pending`
  - 必须恢复人工审核默认字段：
    - `moderationStatus = manual_only`
    - `manualReviewRequired = true`
    - `moderationProvider = null`
    - `moderationResult = null`
    - `moderationReason = null`
  - 必须清除 `rejectionReason / reviewedAt / reviewerId / moderationNote` 等审核字段
- 删除投稿时：
  - 只允许 `rejected`
  - 必须校验 `storyId + authorId(OPENID) + source=user + type=traveler`
  - 不物理删除文档
  - 软删除时更新：
    - `status = deleted`
    - `deletedAt`
    - `updatedAt`
  - `deleted` 投稿不再出现在“我的投稿”列表，也不能通过“我的投稿”详情接口再次读取
- 现有首页“分享传说”新建投稿流程保持不变，仍然创建新文档并写入 `pending`

### 7.9 网友投稿人工审核

当前已实现两种人工审核方式：

1. CloudBase 控制台手动审核
2. 独立网页审核后台（第一版）

CloudBase 控制台手动审核仍可继续使用：

1. 打开 CloudBase 数据库中的 `stories` 集合
2. 按以下条件筛选待审投稿：
   - `source = user`
   - `status = pending`
3. 审核通过时，手动修改：
   - `status = published`
4. 审核拒绝时，手动修改：
   - `status = rejected`
   - `rejectionReason = '具体原因'`
5. 需要下架已发布内容时，手动修改：
   - `status = hidden`
6. 管理员当前允许补充以下字段：
   - `reviewedAt`
   - `reviewerId`
   - `updatedAt`

当前工程约束：

- 不覆盖用户原始标题和正文
- 不新增审核日志集合
- 不增加小程序管理员页面
- `pending / rejected / hidden / deleted` 不进入公共网友故事页

### 7.10 独立网页审核后台（第一版）

当前仓库已新增 `admin-web/` 独立网页工程，使用 `Vite + 原生 JavaScript` 实现第一版人工审核后台。

当前后台相关云函数包括：

- `adminLogin`
- `adminListStories`
- `adminGetStoryById`
- `adminReviewStory`

当前后台约束如下：

- 管理员密码只从云函数环境变量 `ADMIN_LOGIN_SECRET` 读取
- 网页前端不得直接读写 `stories` 集合
- 网页前端只通过云函数访问后台能力
- 管理员会话令牌由云函数签名生成，前端只保存在 `sessionStorage`
- `pending -> published`
- `pending -> rejected`
- `published -> hidden`
- `rejected / hidden` 当前只读查看
- `deleted` 默认不出现在后台普通列表
- 第一版不实现恢复发布
- 第一版不新增 `admin_users`
- 第一版不新增审核日志集合
- 当前机器审核仍未启用，只兼容显示：
  - `moderationStatus = manual_only`
  - `manualReviewRequired = true/false`

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
2. 前端先读取当前用户放大镜余额
3. 前端生成本次探索 `requestId`
4. 对 `folk` / `AI说` 先向 `consumeMagnifyingGlass` 做服务端资格预检
5. 对 `folk` 先查预设故事，未命中时调用 `generateStory`；对 `AI说` 始终调用 `generateStory`
6. 只有成功拿到一篇可展示故事且页面跳转成功后，才由 `consumeMagnifyingGlass` 服务端事务确认扣除一次放大镜
7. 进入故事详情

### 10.3 当前 Demo 已实现的放大镜服务端规则

当前放大镜使用次数以“成功探索次数”为准，不以 AI 请求次数为准。

当前已实现：

- 每个用户每天全部地点、全部可消耗标签合计最多 `10` 次
- 每个用户每天同一地点、同一标签最多 `3` 次
- `folk` 命中预设故事时：
  - 不调用 AI
  - 仍然消耗 `1` 次放大镜
  - 仍计入当天总次数和该地点该标签次数
- `ai_comment` 成功展示时消耗 `1` 次放大镜
- `traveler` 不调用放大镜，不纳入本规则

当前服务端使用：

- `users` 集合中的 `magnifyingGlass`
- `magnifying_glass_usage_daily` 集合中的每日使用记录
- `consumeMagnifyingGlass` 云函数统一执行预检、确认扣减与短时间并发保护

当前 `consumeMagnifyingGlass` 的请求契约为：

```json
{
  "action": "prepare|consume|release|profile",
  "locationKey": "稳定地点键",
  "storyType": "民间传说|AI说",
  "requestId": "本次探索唯一请求 ID"
}
```

当前冻结要求：

- `prepare`、`consume`、`release` 必须复用同一个 `requestId`
- 不允许在 `prepare` 与 `consume` 之间切换 `locationKey`
- 正式地点：
  - `locationKey = 真实 locations._id`
- 临时微信地点：
  - 优先使用非空 `poiid`
  - 没有 `poiid` 时，使用规范化后的 `name + address + latitude + longitude` 生成稳定键
  - 不得传 `undefined`
  - 不得传空字符串
  - 不得把 `null` 变成字符串 `"null"`
  - 不得把临时地点伪装成正式 `locationId`

当前放大镜错误码至少包括：

- `MAGNIFYING_GLASS_EMPTY`
- `MAGNIFYING_GLASS_DAILY_LIMIT`
- `MAGNIFYING_GLASS_LOCATION_TYPE_LIMIT`
- `MAGNIFYING_GLASS_CONCURRENT_REQUEST`
- `MAGNIFYING_GLASS_INVALID_LOCATION_KEY`
- `MAGNIFYING_GLASS_USAGE_COLLECTION_ERROR`
- `MAGNIFYING_GLASS_DATABASE_ERROR`

### 10.4 当前 Demo 已实现的 AI 服务端保护

当前 `generateStory` 已集中定义以下服务端限制：

- 全局每日最多 `200` 次 AI 上游请求
- 单次上游请求超时 `60 秒`
- 单次地点输入长度上限
- 标题最大 `80` 字
- 正文最大 `2000` 字
- 短时间重复请求锁
- 全局熔断开关 `AI_CIRCUIT_OPEN`
- 前端生成的 `requestId` 会贯穿 `prepare / generateStory / consume / release`

当前计数与短锁使用 CloudBase `ai_usage_daily` 集合记录，不依赖云函数实例内存。

当前 AI 请求计数只用于技术保护与费用监控，不等同于放大镜使用次数。

### 10.5 当前 Demo 已实现的失败规则

以下情况不扣除放大镜：

- 请求失败
- 没有故事
- 页面跳转失败
- 放大镜不足
- AI 生成失败
- AI 达到全局请求保护上限
- AI 熔断开启
- AI 超时
- AI 返回非法 JSON

以下情况不会调用 DeepSeek：

- 前端放大镜余额为 `0`
- 服务端预检未通过当天总次数限制
- 服务端预检未通过同地点同标签限制
- 服务端达到全局每日上限
- 服务端熔断开启
- 服务端识别为短时间重复请求

### 10.6 当前已实现的交互保护

- 请求处理中使用全屏遮罩
- 请求处理中使用动画
- `folk` 命中预设故事时不显示 AI 生成遮罩与 AI 合规说明
- `folk` 未命中预设、进入 AI 回退时才显示 AI 生成遮罩与随机词条
- `ai_comment` 进入 AI 请求时显示 AI 生成遮罩、随机词条和固定审核说明
- 保留代码层请求锁，防止重复点击
- `consumeMagnifyingGlass` 云函数端保留短时间请求锁，避免重复扣减
- `generateStory` 云函数端也保留 AI 请求级短时间重复保护

### 10.7 项目侧费用保护边界

- 代码限额只能控制本项目发出的 AI 请求
- DeepSeek 账户侧仍需额外配置余额提醒、消费预警或 API 使用限制
- 如果 DeepSeek 控制台没有硬性消费上限，则项目侧全局每日上限是最后一道保护
- 任意余额不足、服务商错误、超时或 JSON 标准化失败都不能扣放大镜

### 10.8 当前仅用于 Demo

- 当前放大镜默认初始值仍是 Demo 设定的 `5`
- 当前尚未接入正式购买、发放和消耗记录后台

### 10.9 当前已实现的广告奖励规则

当前广告奖励规则冻结为：

- 激励视频广告只由用户主动触发
- 完整观看后奖励 `1` 枚放大镜
- 每个用户每天最多通过广告获得 `3` 枚放大镜
- 广告奖励只增加 `users.magnifyingGlass` 余额
- 广告奖励不增加 `magnifying_glass_usage_daily` 的成功使用次数
- 广告奖励不重置每日 `10` 次成功探索上限
- 广告奖励不重置同地点同标签 `3` 次限制

当前服务端使用：

- `claimAdReward` 云函数负责广告奖励领取
- `ad_reward_claims` 集合记录每次领奖
- `ad_reward_daily` 集合记录每日广告奖励次数

当前最小可信方案说明：

- 当前实现为“客户端完整播放回调 + 服务端幂等发奖”
- 服务端不会信任客户端传入 `userId/openid/rewardCount/magnifyingGlass`
- 服务端会按 `rewardRequestId` 做幂等控制
- 但当前版本不能伪装成微信广告平台服务端验真

### 10.10 广告配置边界

- `adUnitId` 不是 API Key
- `adUnitId` 可以存在前端配置中
- 未配置真实 `adUnitId` 时广告入口必须隐藏
- DeepSeek API Key 仍然只能保留在云函数环境变量中

### 10.11 开发测试工具边界

- 当前新增独立云函数 `devTestControls`，专门处理开发测试状态修改
- 不得把管理员测试逻辑混入 `consumeMagnifyingGlass`
- 服务端必须同时满足以下条件才允许执行：
  - `ENABLE_DEV_TEST_TOOLS = true`
  - 请求携带 `devTestToken`
  - `devTestToken` 与环境变量 `DEV_TEST_ADMIN_TOKEN` 完全一致
- 云函数只接受白名单动作，不接受前端传入 `openid`
- 正式环境关闭 `ENABLE_DEV_TEST_TOOLS` 时，统一返回：
  - `DEV_TOOLS_DISABLED`
- 口令错误或缺失时，统一返回：
  - `DEV_TOOLS_FORBIDDEN`
- 该工具修改的是测试数据，不会放宽以下正式规则：
  - 每日最多 `10` 次
  - 同地点同标签最多 `3` 次
  - AI 失败不扣放大镜
  - `prepare / consume / release` 事务逻辑

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
- `wx.chooseLocation` 打开微信地图选点
- 微信选点命中已有地点时复用真实 `locationId`
- 微信选点未命中时进入临时地点故事流程
- `discovery` 页显示“选择你的位置”按钮与推荐地点列表
- 最近 7 天内创建的地点在 `discovery` 页显示 `NEW`
- `discovery` 推荐地点卡片点击会异步记录一次 `viewCount`
- `discovery` 推荐地点在 `viewCount > 1000` 时显示 `HOT`
- 地点详情展示
- 故事类型选择
- 按地点和类型查询单篇故事
- 多条命中时随机返回一篇
- 请求遮罩和请求锁
- 服务端放大镜预检与扣减
- 个人中心与探索页面的额度同步
- 个人中心在配置真实激励视频广告位后，可主动观看激励视频领取放大镜
- 个人中心会在 `develop / trial` 显示“开发测试工具”入口，开发测试页内使用本机保存的口令做鉴权
- 故事详情页通过真实 `storyId` 加载
- 收藏和取消收藏
- 收藏数量展示
- `AI说` 最小闭环：地点详情页调用 `generateStory`，成功后进入故事详情页
- `generateStory` 服务端会为 `民间传说` 和 `AI说` 生成随机 `storyMeta`
- `民间传说` 回退生成时会在内容类型池中切换不同叙事写法
- `AI说` 生成时会构造包含 `displayName / role / identityContext / emotionalState / narrativeStance / voiceStyle / sentencePattern / attitudeToReader / narrativeFormat` 的可执行 `storyMeta`
- `AI说` 的 `voiceStyle` 已被落成规则，不再只是抽象形容词；正文必须体现可观察语言特征与岗位词汇
- 同一次 AI 重试会复用同一组 `storyMeta`，不会在重试时突然更换叙述人格
- 微信地图未命中地点也可进入 `folk` / `AI说` 的 AI 生成链路
- 故事详情页支持读取内存中的单次生成结果
- AI 生成故事当前在 `story` 页使用论坛帖子式卡片展示
- 首页当前显示项目标语“让地点拥有不同的声音”

---

## 13. 当前仅用于 Demo

以下内容当前存在，但仅用于演示，不代表正式产品最终实现方式：

- `userService.js` 中的 mock 用户
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
- 跨请求历史级去重与长期 Prompt A/B 治理
- 正式故事池
- 用户历史去重
- 月度 5 次限制
- 月度故事刷新
- 正式微信用户身份
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
- AI Prompt 配置后台、实验分流与版本治理
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

最终产品中的地点入口仍需区分两层来源：

- 系统推荐地点：来自已发布的 `locations`
- 用户主动选点结果：当前正式入口为微信原生 `wx.chooseLocation`

当前 `discovery` 页不再提供本地地点关键词搜索，页面默认展示推荐地点列表。
当前 `HOT` 标签使用 CloudBase 中真实 `viewCount`，且只在 `viewCount > 1000` 时显示。
当前推荐地点卡片点击统计失败不会阻塞进入地点详情页，也不会影响 AI、民间传说、放大镜、投稿、收藏或广告流程。
当前版本不做用户去重和反作弊，后续如需防刷需单独增加统计治理策略。

微信原生地点选择候选方案的当前约束为：

- CloudBase 推荐地点列表继续保留
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

## 17. AI 生成策略

### 17.1 当前产品风格规则

当前 `generateStory` 已实现一套服务端固定的产品风格规则：

- 风趣、荒诞、节奏轻快
- 可以一本正经地讲离谱事情
- 可以观察和轻微吐槽人类行为或地点秩序
- 不写成普通散文
- 不堆砌华丽辞藻
- 不依赖网络热梗
- 不固定写成怪谈或鬼故事
- 开头尽快进入事件或观察，中段加入具体细节，结尾保留一点荒诞或余味

这些规则属于产品自己的风格定义，不允许在 Prompt 中写“模仿某作者”或“模仿某作品”。

### 17.2 民间传说内容类型池

当前 `民间传说` 在没有预设故事、需要 AI 回退时，会在以下内容类型池中随机选择一种：

- 隐秘怪事
- 地方野史
- 荒诞乌龙
- 历史人物轶事
- 地方新闻体
- 物件视角
- 调查档案体
- 真假难辨的传闻

冻结要求：

- 预设故事仍然优先于 AI 回退
- 内容类型切换不能只替换几个形容词
- 不同类型必须改变叙事角度、结构和结尾方式
- 故事必须和当前地点本身有关，不能换任意地点都成立
- 没有可靠资料时，不能把未证实内容写成确定新闻、确定史实或真实人物行为

### 17.3 AI说可执行 storyMeta 与语气规则

当前 `AI说` 已在服务端随机组合并透传一组可执行 `storyMeta`，至少包含：

- `displayName`
- `role`
- `identityContext`
- `emotionalState`
- `narrativeStance`
- `voiceStyle`
- `sentencePattern`
- `attitudeToReader`
- `narrativeFormat`

当前身份池包括但不限于：

- 门禁与访客流量管理系统
- HR 关系与离职预警模型
- 清洁巡检机器人
- 景区广播与秩序提示系统
- 外卖路线与时效调度系统
- 夜班巡逻与监控复核程序
- 讲解与展陈关系分析模型
- 金融异常与风险复核程序
- 被停用但仍在旁听的旧系统

当前 `voiceStyle` 池包括：

- 亲切活泼型
- 古板严肃型
- 烦躁吐槽型
- 冷幽默型
- 温柔分享型
- 冷静调查型

当前主情绪池包括：

- 兴奋分享
- 烦躁抱怨
- 冷静调查
- 温柔回忆
- 得意爆料
- 严肃警告
- 看热闹不嫌事大

当前 Prompt 约束如下：

- 每次只允许一个主情绪
- 主情绪必须至少通过句式、词汇、段落结构、读者称呼、标点停顿、叙述顺序中的两种体现
- 岗位必须影响它能观察到什么、会忽略什么、如何解释事件，以及会自然使用什么词汇
- `voiceStyle` 必须被翻译为可执行规则，而不是只在 meta 中挂一个形容词
- 不能所有 AI 都写成同一种口气
- 不允许总以“作为一个 AI”开头
- 不允许反复使用“人类真奇怪”这类套话
- 不允许模仿具体作家、作品或现成角色名称

当前代表性语气规则示例：

- 亲切活泼型：
  - 自然口语、适量感叹和插话
  - 像刚发现趣事就来和读者分享
- 古板严肃型：
  - 句式完整、先事实后判断
  - 使用正式说明词，不使用轻佻口吻
- 烦躁吐槽型：
  - 开头先带一点不耐烦，再讲事件
  - 允许反问、打断和情绪转折
- 冷幽默型：
  - 冷静叙述
  - 用一本正经的结论去承接荒诞事实
- 温柔分享型：
  - 像私下讲发现
  - 有停顿感，但不写成鸡汤

当前输出校验要求：

- `storyMeta.displayName / role / emotionalState / voiceStyle` 非空
- `title / content` 非空
- `type` 必须与请求一致
- 正文不得出现 `JSON / 字段 / 提示词 / system prompt` 等技术词
- `AI说` 正文不得退化成通用地点介绍
- `AI说` 正文必须至少命中 2 个与 `voiceStyle` 对应的可观察语言特征
- `AI说` 正文必须至少命中 1 个岗位词汇，证明身份真的影响了表达

### 17.4 真实性边界

当前 AI 生成必须遵守以下边界：

- 已有地点字段和预设资料可以作为事实锚点
- 没有可靠来源时，只能写成传闻、推测、档案故事或故事化演绎
- 不得捏造真实人物违法、丑闻或现实中的具体负面行为
- 不得把未证实内容写成确定新闻
- 不得声称 AI 真的读取了监控、门禁、银行内部记录或个人隐私

### 17.5 storyMeta 与当前去重边界

当前云函数会在服务端生成内部 `storyMeta`，并在成功返回时透传给前端结果对象，但不改变现有核心字段：

- `storyId`
- `locationId`
- `type`
- `title`
- `content`
- `source`

当前展示层约束：

- `storyMeta` 是 AI 帖子身份展示的唯一来源
- `AI说` 成功生成时，故事详情页显示帖子式头部：
  - 本地头像
  - `displayName`
  - `role`
  - 必要时基于 `storyMeta` 和地点名称生成更清晰的页面身份说明
- `民间传说` 的 AI 回退结果同样使用帖子式展示，并额外显示“民间传说 · AI生成”
- `storyMeta` 缺失时允许安全降级到默认身份，不得显示 `undefined`
- 预设故事与网友投稿不伪造 AI 身份
- AI 生成内容必须在页面可见位置显示固定合规说明：`本内容由人工智能生成，仅供娱乐与参考。`

当前已实现：

- 同一次生成重试会复用同一组 `storyMeta`
- 单个云函数实例内会尽量避免连续两次选到同样的民间传说类型
- 单个云函数实例内会尽量避免连续两次使用相同的 AI 身份、主语气、主情绪和叙事格式

当前未实现：

- 跨请求、跨实例、跨用户的全局去重
- 基于历史生成记录的稳定避重
- 以数据库持久化方式记录最近已用身份或内容类型

---

## 18. 开发纪律

以后每个 Sprint 必须：

- 先读取 `SPEC.md`
- 说明当前基线 commit
- 只完成一个独立目标
- 明确允许修改和禁止修改的文件
- 不得自行改变已冻结的页面流程
- 不得把“计划功能”当成“已实现功能”
- 不确定时先汇报，不要自行设计

### 18.1 页面流程纪律

未经明确批准，不得擅自把已冻结流程改成其他层级，例如：

- 不得把地点选择移回首页
- 不得把类型选择提前到地点之前
- 不得让地点页重新变成多篇故事列表页

### 18.2 事实描述纪律

以后任何汇报都必须明确区分：

- 当前代码已实现
- 当前 Demo 占位
- 已确认未来设计
- 暂未决定或延期

禁止把未来计划写成当前能力。
