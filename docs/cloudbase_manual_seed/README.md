# CloudBase 手动测试数据

本目录用于 Sprint 4-D 的手动录数验收，不包含任何业务代码变更。

## 文件

- `locations.manual.csv`
- `stories.manual.csv`
- `locations.manual.json`
- `stories.manual.json`
- `locations.manual.jsonl`
- `stories.manual.jsonl`
- `locations.folk_fallback_test.csv`
- `locations.folk_fallback_test.json`
- `folk_fallback_test_location.md`
- `locations.sprint11.manual.csv`
- `locations.sprint11.manual.json`
- `locations.sprint11.manual.jsonl`
- `stories.sprint11.manual.csv`
- `stories.sprint11.manual.json`
- `stories.sprint11.manual.jsonl`
- `sprint11_import_steps.md`
- `locations.sprint12.manual.csv`
- `locations.sprint12.manual.jsonl`
- `stories.sprint12.manual.template.csv`
- `stories.sprint12.manual.template.jsonl`
- `sprint12_import_steps.md`

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

说明：

- 预设地点来源是 CloudBase `locations`
- `discovery` 读取的是 `status = published` 的地点
- `民间传说` 优先读取 `folk` 预设故事
- 无预设时才回退 DeepSeek
- 微信 `wx.chooseLocation` 未命中系统地点时生成的是临时故事，不写入正式 `stories`

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

## Sprint 10-B 开发验证点

如果需要验证“民间传说无预设内容时自动回退 AI”，请使用：

- `locations.folk_fallback_test.csv`
- 或 `locations.folk_fallback_test.json`

对应地点：

- 名称：`开发验证点·民间传说回退`
- locationId：`loc_dev_folk_fallback_01`

详细导入、真机验证和清理步骤见：

- `folk_fallback_test_location.md`

## Sprint 11 推荐地点数据

如果需要扩充当前可验收的预存地点，请先阅读：

- `sprint11_import_steps.md`

再按步骤使用：

- `locations.sprint11.manual.csv`
- `stories.sprint11.manual.csv`

或对应的：

- `.json`
- `.jsonl`

当前 Sprint 11 推荐地点模板包括：

- 深圳大鹏所城
- 深圳赤湾天后宫
- 惠州西湖
- 惠州十里银滩
- 广州陈家祠
- 杭州西湖断桥

注意：

- 新增推荐地点模板不再预写固定 `_id`
- 需要先导入地点，再记录真实 `locations._id`
- `stories.sprint11.manual.*` 中的 `locationId` 占位符必须先替换成真实 `_id`，再导入
- 若要保留 `tags` 数组，优先使用 `json/jsonl`

每个推荐地点至少提供一条：

- `type = folk`
- `status = published`
- `source = folk_archive`

## Sprint 11 民间传说 AI 回退测试点

继续使用：

- `loc_dev_folk_fallback_01` -> 开发验证点·民间传说回退

该地点只作为开发验证用：

- 可被 `discovery` 加载
- 不提供任何 `type = folk` 且 `status = published` 的预设故事
- 用于验证“民间传说无预设时自动回退 AI”

## 幂等与重复写入说明

当前仓库提供的是手动导入数据文件，不直接连接你的远端 CloudBase 实库。

因此在真正导入前，请先在 CloudBase 控制台检查：

1. 目标地点 `_id` 是否已存在
2. 是否已经存在同名地点
3. `stories.locationId` 是否已经指向同一个地点

当前文件的重复写入规则如下：

- `folk_archive` 只表示预设内容
- `ai_observer` / `deepseek` 都表示 AI 生成内容
- 不要把 `ai_observer` 重新导入成预设内容
- 推荐地点如果已经存在，请复用原有 `_id`，不要再创建新地点
- 新地点应让 CloudBase 自动生成 `_id`
- 导入故事前，先把模板里的 `locationId` 占位符替换成真实地点 `_id`
- 如果只是更新内容，请在控制台编辑已有文档，或先核对后再重导

对于 Sprint 11 新增的推荐地点，当前建议：

- 先按名称检查远端 `locations`
- 已存在就记录真实 `_id`
- 不存在才导入 `locations.sprint11.manual.*`
- 再把真实 `_id` 回填到 `stories.sprint11.manual.*`
- 最后导入 stories

当前这些手动文件适合：

- 新建开发环境
- 或需要按名称/真实 `_id` 手动核对后再导入的情况

如果需要真正的远端 upsert 导入，而不是手动导入，本仓库当前还没有接入直接操作你 CloudBase 实库的自动脚本。

## Sprint 12 最终导入包

Sprint 12 提供的是最终推荐地点导入包，优先使用以下文件：

- `locations.sprint12.manual.csv`
- `locations.sprint12.manual.jsonl`
- `stories.sprint12.manual.template.csv`
- `stories.sprint12.manual.template.jsonl`
- `sprint12_import_steps.md`

本轮正式推荐地点共 6 个：

- 深圳大鹏所城
- 深圳赤湾天后宫
- 惠州西湖
- 惠州十里银滩
- 广州陈家祠
- 杭州西湖断桥

另外保留 1 个开发验证地点：

- 开发验证点·民间传说回退

Sprint 12 包的约束如下：

- 不在地点模板中伪造真实 CloudBase `_id`
- 故事模板里的 `locationId` 必须先人工回填真实 `locations._id`
- 六个正式推荐地点都需要至少 1 条 `folk` 预设故事
- 测试点只导地点，不导任何 `type = folk` 且 `status = published` 的故事
- `source = folk_archive` 才表示预设内容
- 禁止使用 `ai_observer` 或 `deepseek` 作为预设导入来源

如果 CloudBase 控制台无法安全 upsert，请按 `sprint12_import_steps.md` 中的人工检查顺序执行：

1. 先按地点名称检查是否已存在
2. 已存在就复用原 `_id`
3. 不存在才导入地点
4. 记录真实 `_id`
5. 再回填 stories 模板并导入
