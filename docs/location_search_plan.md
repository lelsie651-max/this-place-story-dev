# 地点搜索方案冻结

## 1. 文档目的

本文档用于冻结《此地有传说》地点入口的产品方案、数据契约和架构边界。

本文档只描述：

- 当前已实现的推荐地点与临时本地筛选
- 微信原生地点选择的正式接入边界
- 未来地点标准化、复用与落库边界

本文档不代表当前代码已经接入外部 POI 搜索服务。

---

## 2. 当前实现与当前结论

### 2.1 当前已实现

当前 `discovery` 页已经实现稳定入口与一个临时过渡能力：

1. 默认展示系统推荐地点
2. 对当前已加载的推荐地点做本地关键词筛选
3. 提供微信地图选点入口
4. 命中已有地点时复用真实 `locations._id`
5. 未命中时进入临时地点故事流程

当前代码的真实来源：

- 推荐地点来自 CloudBase `locations` 集合
- 查询条件为 `status = "published"`
- 页面加载时读取最近已发布地点
- 搜索框只对页面内存中的 `allLocations` 做本地筛选
- 当前推荐地点的手动导入模板以 `docs/cloudbase_manual_seed/locations.sprint12.manual.*` 为准
- 当前推荐地点里的民间传说预设模板以 `docs/cloudbase_manual_seed/stories.sprint12.manual.template.*` 为准

### 2.2 当前实现的准确定位

当前本地筛选只是临时阶段能力，不能称为：

- 全国地点搜索
- 地图搜索
- POI 搜索
- 外部地点搜索

当前本地筛选的作用仅是帮助用户在“已经加载到页面的推荐地点”里更快定位目标地点。

### 2.3 当前阶段结论

当前项目决定：

1. 保留系统推荐地点
2. 保留对已加载推荐地点的本地关键词筛选
3. 不依赖腾讯位置服务 WebService / API Key
4. `wx.chooseLocation` 作为正式地点入口之一接入
5. `wx.choosePoi` 经真机验证后不进入正式流程
6. `wx.getLocation` 当前不接入自动定位流程
7. 当前不实现全国 POI 文本搜索

### 2.4 当前验证范围

历史验证结论保留如下：

- `wx.chooseLocation` 真机可返回有效经纬度
- `wx.choosePoi` 真机名称、地址、类型可返回，但原始经纬度为 `0,0`
- `wx.getLocation` 当时失败原因为 `requiredPrivateInfos` 未声明

当前正式代码已恢复 `chooseLocation` 所需的前端配置，但仍不恢复 `choosePoi` 或 `wx.getLocation` 的相关配置。

---

## 3. 两种地点来源

## 3.1 A. 系统推荐地点

### 当前阶段来源

- CloudBase `locations` 集合
- 当前已发布的 `locations`
- 页面进入时默认展示
- 搜索框为空时恢复展示
- 这些地点可以是人工维护的推荐地点

### 在最终产品中的地位

这一层在最终产品中仍然保留，用于：

- 提供默认入口
- 承接运营推荐
- 提供稳定可探索的地点池

### 当前与未来共同约束

- 推荐地点必须是系统认可的可展示地点
- 推荐地点进入 `location` 页时仍然使用真实 `locations._id`
- 推荐地点不能和外部搜索结果混为同一种数据来源描述

---

## 3.2 B. 用户主动选点结果

### 当前正式来源

- 微信原生 `wx.chooseLocation`
- 用户在微信原生界面中主动选择地点

### 当前用途边界

- 用于验证真实设备是否能拉起原生地点选择能力
- 用于验证返回字段是否能支撑后续 UGC 地点输入
- 不等同于全国 POI 文本搜索
- 不等同于自定义外部地点搜索 API

### 当前冻结结论

- 当前本地筛选仍然只是临时能力
- `wx.chooseLocation` 当前已接入正式业务流程
- `wx.choosePoi` 已验证名称、地址、类型可返回，但当前原始经纬度为 `0,0`，不进入正式流程
- `wx.getLocation` 当前失败原因为 `requiredPrivateInfos` 未声明，本产品暂不接入自动定位流程
- 微信原生选点不替代推荐地点列表
- 清空关键词时仍然回到系统推荐地点列表
- 当前已实现 `wx.chooseLocation` 与已有 `locations` 的前端匹配契约，不执行 CloudBase 写入

---

## 4. 最终页面状态

地点页入口的最终状态机冻结如下：

### 4.1 初始状态

- 显示系统推荐地点
- 不显示外部搜索结果

### 4.2 用户输入关键词

- 当前仍只做推荐地点本地筛选
- 不进入全国 POI 文本搜索
- 不发起腾讯位置服务 WebService 请求

### 4.3 用户主动选点

- 当前可通过微信原生 `wx.chooseLocation` 打开地点选择界面
- 返回用户明确选中的地点信息
- 如果调用失败，应展示真实错误，不伪装成“没有结果”

### 4.4 选点成功

- 返回微信原生能力提供的地点字段
- 当前重点关注 `name`、`address`、`latitude`、`longitude`
- `poiid` 可作为可选辅助字段
- 先进入“匹配判断”而不是直接落库
- 命中已有地点时复用真实 `locationId`
- 未命中时进入临时地点状态

### 4.5 选点取消或失败

- 显示真实 `errMsg`
- 明确区分用户取消、权限未开通、隐私声明缺失和其他失败

### 4.6 推荐地点链路保持不变

- 不把微信原生选点结果混入推荐地点列表
- 不影响当前 `discovery -> location -> story` 链路

### 4.7 清空关键词

- 返回系统推荐地点
- 不把筛选结果或原生选点结果混入推荐列表

---

## 5. 地点身份和去重规则

### 5.1 微信原生选点身份边界

微信原生 `wx.chooseLocation` 返回的是用户选中的地点信息，不等同于自定义外部 POI 搜索结果。

冻结规则：

1. 当前不把微信返回结果伪装成 `providerPlaceId`
2. 当前不自动创建新的 `locations` 记录
3. `poiid` 只作为可选辅助字段，不作为系统主键
4. 系统内部地点身份仍然使用 `locations._id`
5. 当前已在正式页面中使用这些字段做匹配判断
6. 如需落库，仍然必须先匹配已有 `locations`，再决定是否创建新地点

### 5.2 当前代码保持不变的规则

- 业务代码不得依赖固定 `_id` 前缀或固定长度
- `stories.locationId` 必须继续指向真实 `locations._id`

### 5.3 后续 UGC 候选字段

后续如果用户通过微信原生选点创建 UGC 地点，当前优先保留这些字段：

- `name`
- `address`
- `latitude`
- `longitude`
- `poiid`（仅辅助）

在正式去重规则确定前，不得直接把名称字符串当作稳定地点身份。

### 5.4 `wx.chooseLocation` 标准输入对象

冻结的标准化输入对象为：

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
- `name` 必须是非空字符串
- `address` 可以为空，但必须保留原始值
- `latitude` / `longitude` 必须是有效数字
- `latitude` 范围为 `-90` 到 `90`
- `longitude` 范围为 `-180` 到 `180`
- `latitude = 0` 且 `longitude = 0` 视为无效坐标
- `poiid` 只能作为可选辅助字段
- `poiid` 不得直接作为 `locations._id`
- `poiid` 不得伪装成 `providerPlaceId`
- 不假设 `poiid` 永久稳定
- 必须保留微信原始选择对象与标准化对象的区别

### 5.5 匹配结果对象

冻结的匹配判断结果对象为：

```json
{
  "status": "matched",
  "locationId": "loc_nantou_city",
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
- `matched`：已经能可靠判断对应已有 `locations`，返回真实 `locationId`
- `candidate`：找到一个或多个可能匹配项，但不能直接进入已有地点
- `unmatched`：当前没有可靠对应的 `locations`，不能伪造 `locationId`

### 5.6 候选列表契约

当匹配结果不是唯一命中时，候选对象为：

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
- 不得因为名称相同就直接合并
- 必须解释为什么进入候选列表

---

## 6. locations 字段方案

本节只冻结未来方案，不改当前数据库。

## 6.1 当前已经存在并正在使用的字段

当前代码已使用字段：

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

## 6.2 未来建议补充字段

| 字段 | 当前是否存在 | 未来用途 | 是否参与去重 | 是否允许为空 |
| --- | --- | --- | --- | --- |
| `provider` | 否 | 标记外部来源供应商 | 是 | 推荐非空 |
| `providerPlaceId` | 否 | 外部地点稳定身份 | 是 | 推荐非空 |
| `name` | 是 | 展示、搜索、去重辅助 | 是 | 否 |
| `address` | 否 | 搜索结果区分与展示 | 是 | 可空 |
| `city` | 是 | 展示、搜索、去重辅助 | 是 | 可空 |
| `province` | 是 | 展示、搜索、去重辅助 | 是 | 可空 |
| `country` | 是 | 展示、搜索、去重辅助 | 否 | 可空 |
| `latitude` | 是 | 地图定位、附近搜索 | 否 | 可空 |
| `longitude` | 是 | 地图定位、附近搜索 | 否 | 可空 |
| `category` | 否 | 展示和分类 | 否 | 可空 |
| `source` | 否 | 标记推荐 / POI / 人工导入 | 否 | 推荐非空 |
| `status` | 是 | 可见性与发布状态 | 否 | 否 |
| `createdAt` | 是 | 创建时间 | 否 | 否 |
| `updatedAt` | 否 | 更新同步时间 | 否 | 推荐非空 |

## 6.3 字段用途说明

### 用于去重的核心字段

- `provider`
- `providerPlaceId`

### 用于辅助去重的字段

- `name`
- `address`
- `city`
- `province`
- `latitude`
- `longitude`

### 主要用于展示的字段

- `name`
- `address`
- `city`
- `province`
- `country`
- `category`
- `intro`
- `description`

### 主要用于系统治理的字段

- `source`
- `status`
- `createdAt`
- `updatedAt`

---

## 7. 未来搜索架构边界

### 7.1 当前安全边界

冻结规则如下：

- 当前不依赖腾讯位置服务 WebService / API Key
- 不调用 CloudBase 云函数地点搜索
- 小程序前端不拼接腾讯地点搜索 URL
- 当前正式页面已接入微信原生地点接口 `wx.chooseLocation`
- `wx.choosePoi` 不进入正式流程
- `wx.getLocation` 当前不接入正式流程
- 当前不写入 CloudBase 新地点或临时故事
- `wx.chooseLocation` 未命中系统地点时生成的是临时故事，不写入正式 `stories`
- `wx.chooseLocation` 未命中的临时地点当前也不能进入正式网友投稿写库流程
- 当前网友投稿只接受已存在于 `locations` 集合中的正式地点 `locationId`
- 开发验证点“开发验证点·民间传说回退”只导入 `locations`，不导入任何 `folk` 预设故事

### 7.2 当前职责划分

前端小程序负责：

- 展示推荐地点
- 对推荐地点做本地筛选
- 打开微信地图选点
- 对微信选点结果做标准化与已有地点匹配
- 对未命中的微信选点结果进入临时地点故事流程

当前不需要：

- 云函数代理地点搜索
- 腾讯位置服务 API Key
- 外部 POI 文本搜索服务
- 微信原生地点接口测试页

### 7.3 当前不执行的动作

当前仍不执行：

- CloudBase 写入
- `locations` 自动创建
- 选点结果正式落库

---

## 8. 本地筛选、原生选点与附近能力

这三类能力必须明确拆分，不能写成同一个功能。

## 8.1 推荐地点本地筛选

定义：

- 用户输入关键词后，只在当前已加载推荐地点中做本地筛选

特点：

- 不请求外部 POI 服务
- 不需要 API Key
- 不创建新地点
- 不改变现有 `locations._id`

当前状态：

- 已实现
- 继续保留

## 8.2 微信原生地点选择

定义：

- 用户通过微信原生界面主动选择一个地点

特点：

- 后续候选入口为 `wx.chooseLocation`
- `wx.choosePoi` 不进入正式流程
- `wx.getLocation` 当前不接入正式产品
- 返回的是用户选择的地点信息
- 不等同于全国 POI 文本搜索

当前状态：

- `wx.chooseLocation` 已通过真机验证，可返回有效经纬度
- `wx.choosePoi` 已通过真机验证，但原始经纬度为 `0,0`
- `wx.getLocation` 当前失败原因为 `requiredPrivateInfos` 未声明
- 当前正式页面已接入，测试页仍未恢复

### 8.2.1 匹配顺序冻结

当前已经按以下顺序实现保守匹配：

1. 先校验 `selectedPlace` 是否满足标准输入契约
2. 再做名称标准化：
   - 去除首尾空格
   - 合并连续空白
   - 统一常见括号和标点
3. 再做地址标准化：
   - 去除首尾空格
   - 保留原始地址
4. `poiid` 只作为辅助匹配条件，不得单独决定命中
5. 只有经纬度同时有效时，坐标才参与辅助判断
6. 不能只根据名称直接认定为同一地点
7. 名称、地址、坐标冲突时，优先降级为 `candidate` 或 `unmatched`
8. 同名不同地点必须避免误匹配
9. 已有 `location` 缺少经纬度时，只能依赖名称与地址的保守判断
10. 只有名称和地址、没有坐标时，最多进入 `candidate`，不得直接 `matched`

### 8.2.2 冲突处理规则

- 名称接近但地址明显冲突：不得 `matched`
- 名称一致但坐标明显冲突：不得 `matched`
- 地址接近但名称明显冲突：不得 `matched`
- 缺少任何必要字段时：进入 `invalid_input` 或 `candidate`
- 需要距离阈值时，阈值属于“待产品确认参数”，本轮不擅自冻结

## 8.3 附近地点能力

定义：

- 基于用户当前位置或地图附近范围选择地点

特点：

- 需要额外权限与真机验证
- 可能涉及定位授权、地图能力和类目审核

当前状态：

- 当前暂不实现
- 不应与本地筛选或原生选点合并描述

---

## 9. 与当前代码的关系

### 9.1 当前推荐地点链路

当前代码中的推荐地点链路是：

首页
-> `discovery`
-> CloudBase `locations`
-> `location`

### 9.2 当前本地筛选的定位

当前 `discovery` 页里的搜索框：

- 只筛选当前已经加载的 `allLocations`
- 不会创建新地点
- 不会改变 `locations._id`
- 点击结果后仍进入原有 `location` 页面

它在最终产品中的定位是：

- 临时过渡能力
- 方便用户在推荐地点里快速定位
- 不是全国 POI 文本搜索能力

### 9.3 当前微信原生选点的定位

当前微信原生选点已经接入正式地点入口，但仍然只做：

- 标准化
- 已有地点匹配
- 未命中时进入临时地点故事流程

它当前仍不承担：

- 推荐地点搜索
- 外部 POI 文本搜索
- `locations` 自动落库
- UGC 正式落库

---

## 10. 暂不实现清单

以下能力本轮仅冻结方案，不进入实现：

- 全国 POI 文本搜索
- 腾讯位置服务真实 API 接入
- 云函数或后端代理接口
- 未预存地点的自动落库
- 地点标准化流水线
- POI 去重与地点合并
- 附近地点搜索
- 地理位置授权
- 微信原生选点结果接入正式 UGC / 故事入口
