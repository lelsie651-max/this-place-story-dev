# CloudBase 手动测试数据

本目录用于 Sprint 4-D 的手动录数验收，不包含任何业务代码变更。

## 文件

- `locations.manual.csv`
- `stories.manual.csv`
- `locations.manual.json`
- `stories.manual.json`
- `locations.manual.jsonl`
- `stories.manual.jsonl`

说明：

- `.csv` 适合当前 CloudBase 导入入口，建议优先使用
- `.json` 是标准 JSON 数组，适合在 IDE 里查看和校验
- `.jsonl` 是 `JSON Lines`，适合 CloudBase 控制台按行导入

注意：

- 当前导入界面对 CSV 更友好
- CSV 只支持 string 和 number，所以 `locations.manual.csv` 里没有放数组类型的 `tags`
- 当前页面仍可正常工作，因为地点列表和地点详情还有 `level`、`intro`、`description` 这些 fallback 字段

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
2. 优先使用 `locations.manual.csv` 导入 2 条记录。
3. 在 CloudBase 控制台打开 `stories` 集合。
4. 优先使用 `stories.manual.csv` 导入 4 条记录。
5. 确认每条 `stories.locationId` 都指向真实存在的 `locations._id`。

## duplicate key 报错说明

如果导入时报：

- `duplicate key error`
- `dup key: { _id: "loc_xian_wall" }`

这通常表示前一次导入已经成功写入了部分记录，这次再次导入时 `_id` 冲突了。

处理方式：

1. 先到 `locations` 集合删除已存在的：
   - `loc_nantou_city`
   - `loc_xian_wall`
2. 再到 `stories` 集合删除已存在的：
   - `story_nantou_folk_01`
   - `story_nantou_ai_01`
   - `story_xian_folk_01`
   - `story_xian_ai_01`
3. 删除后重新导入 `.jsonl` 文件

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
