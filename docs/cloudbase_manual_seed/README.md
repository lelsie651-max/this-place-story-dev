# CloudBase 手动测试数据

本目录用于 Sprint 4-D 的手动录数验收，不包含任何业务代码变更。

## 文件

- `locations.manual.json`
- `stories.manual.json`

## 当前代码实际依赖的字段

### locations

- `_id`
- `name`
- `city`
- `province`
- `country`
- `latitude`
- `longitude`
- `level`
- `tags`
- `intro` / `description`
- `status`
- `createdAt`

### stories

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

## 关联关系

- `loc_nantou_city`
  - `story_nantou_folk_01`
  - `story_nantou_ai_01`
- `loc_xian_wall`
  - `story_xian_folk_01`
  - `story_xian_ai_01`

## 手动导入建议

1. 在 CloudBase 控制台打开 `locations` 集合。
2. 按 `locations.manual.json` 录入或导入 2 条记录。
3. 在 CloudBase 控制台打开 `stories` 集合。
4. 按 `stories.manual.json` 录入或导入 4 条记录。
5. 确认每条 `stories.locationId` 都指向真实存在的 `locations._id`。

## 页面验收链路

1. 首页
2. `explore`
3. `discovery`
4. `location`
5. `story`

可额外验证：

- 在 `location` 页能看到对应地点下的故事列表
- 在 `story` 页能完成收藏
- 从 `story` 返回 `location`，再返回 `discovery`
