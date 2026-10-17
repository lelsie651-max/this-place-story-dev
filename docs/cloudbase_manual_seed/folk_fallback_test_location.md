# 民间传说 AI 回退验证点

## 目的

本文件用于 Sprint 10-B 的手机真机验证：

- 该地点可以出现在 `discovery` 页面
- 该地点不提供任何 `type=folk` 且 `status=published` 的预设故事
- 点击“民间传说”后，应当进入 `generateStory` 的 AI 回退链路

## 对应地点

- 名称：`开发验证点·民间传说回退`
- locationId：`loc_dev_folk_fallback_01`

## 导入方式

推荐只导入以下文件中的地点记录，不导入任何对应 stories：

- `locations.folk_fallback_test.csv`
- 或 `locations.folk_fallback_test.json`

## 重要约束

请不要为该地点创建以下故事：

- `locationId = loc_dev_folk_fallback_01`
- `type = folk`
- `status = published`

否则将无法验证“民间传说无预设时自动回退 AI”。

## 为什么 status 使用 published

当前代码里：

- `discovery` 只加载 `status = published` 的地点
- 手机真机如果要从正式 `discovery -> location` 链路进入该地点，地点必须临时可见

因此本验证点当前使用 `published`，并通过：

- 开发验证专用名称
- 明确的 `_id`
- `level = dev_test_site`
- 文档说明

来识别其为开发验证数据，而不是正式推荐地点。

## 手机测试步骤

1. 将 `loc_dev_folk_fallback_01` 导入 CloudBase `locations` 集合。
2. 确认 `stories` 集合中不存在：
   - `locationId = loc_dev_folk_fallback_01`
   - `type = folk`
   - `status = published`
3. 打开手机真机版本，进入：
   - 首页
   - 地点发现 `discovery`
4. 找到 `开发验证点·民间传说回退`
5. 进入地点详情页，点击 `民间传说`
6. 预期行为：
   - 先查询预设故事
   - 查询为空后调用 `generateStory`
   - 成功进入故事详情页
   - 故事展示模式仍为 `民间传说`
   - 真实来源显示为 `AI生成`
   - 成功后才扣 1 个放大镜

## 测试完成后如何删除或隐藏

可选方式：

1. 直接删除 `locations` 集合中的 `loc_dev_folk_fallback_01`
2. 或将其 `status` 改为非 `published` 值，例如 `archived`

在当前代码下，只要不再是 `published`，该地点就不会继续出现在 `discovery` 页面。
