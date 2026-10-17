# Sprint 11 手动导入步骤

本说明对应 Sprint 11 的两类数据：

1. 六个新增推荐地点
2. 一个“民间传说无预设时自动回退 AI”的开发验证点

## 一、为什么改成两步导入

这轮要求里有两个约束需要同时满足：

- 不伪造固定 `_id`
- `stories.locationId` 必须指向真实 `locations._id`

因此新增推荐地点不能直接在仓库里预写固定 `_id`。当前做法是：

1. 先导入 `locations.sprint11.manual.*`
2. 让 CloudBase 为新地点自动生成真实 `_id`
3. 再把真实 `_id` 回填到 `stories.sprint11.manual.*`
4. 最后再导入故事

## 二、推荐地点导入

先在 CloudBase 控制台检查以下地点是否已经存在：

- 深圳大鹏所城
- 深圳赤湾天后宫
- 惠州西湖
- 惠州十里银滩
- 广州陈家祠
- 杭州西湖断桥

### 规则

- 已存在：复用现有 `_id`，不要重复创建
- 不存在：使用 `locations.sprint11.manual.json` 或 `locations.sprint11.manual.jsonl` 导入

说明：

- `json/jsonl` 保留了 `tags` 数组，字段更完整
- `csv` 里的 `tags` 仅作文本占位，若要严格保持数组结构，请优先使用 `json/jsonl`

## 三、记录真实 locationId

请为这 6 个地点分别记录真实 `_id`，建议整理成如下表：

| 地点 | 真实 locationId |
| --- | --- |
| 大鹏所城 |  |
| 赤湾天后宫 |  |
| 惠州西湖 |  |
| 十里银滩 |  |
| 陈家祠 |  |
| 西湖断桥 |  |

## 四、回填 stories 模板

`stories.sprint11.manual.*` 当前使用的是占位字符串：

- `REPLACE_WITH_DAPENG_LOCATION_ID`
- `REPLACE_WITH_CHIWAN_LOCATION_ID`
- `REPLACE_WITH_HUIZHOU_WEST_LAKE_LOCATION_ID`
- `REPLACE_WITH_SHILI_YINTAN_LOCATION_ID`
- `REPLACE_WITH_CHEN_CLAN_LOCATION_ID`
- `REPLACE_WITH_BROKEN_BRIDGE_LOCATION_ID`

导入 `stories` 前，必须先把这些占位值替换为上一步记录的真实 `_id`。

### 故事导入约束

每条故事都保持：

- `type = folk`
- `status = published`
- `source = folk_archive`

不要把：

- `ai_observer`
- `deepseek`

改成预设来源。

## 五、AI 回退测试地点

开发验证点继续使用既有文件：

- `locations.folk_fallback_test.csv`
- `locations.folk_fallback_test.json`

当前文档约定的测试地点为：

- 名称：`开发验证点·民间传说回退`
- locationId：`loc_dev_folk_fallback_01`

这个点保留固定 ID，是为了让开发验证链路可重复进入、可明确删除。

### 该测试点的硬约束

不要创建以下故事：

- `locationId = loc_dev_folk_fallback_01`
- `type = folk`
- `status = published`

否则就无法验证：

- 进入地点
- 点击“民间传说”
- folk 预设查询为空
- 回退调用 `generateStory`
- 返回 `type = folk`
- `source = deepseek`
- 成功后才扣 1 个放大镜

## 六、幂等与避免重复写入

当前仓库无法直接读取你的远端 CloudBase 实库，所以“避免重复创建”只能通过导入前检查实现。

推荐执行顺序：

1. 先按名称检查 `locations` 是否已存在
2. 已存在就复用旧 `_id`
3. 不存在才导入新地点
4. 故事导入前按 `locationId + type + title` 再核对一遍
5. 同一地点已有等价 folk 预设时，不要重复导入

如果你的环境已经导入过早期手写 `_id` 版本的 Sprint 11 数据：

- 不要直接重复导入新版地点文件
- 先核对现有地点是否就是同一地点
- 复用现有 `_id`
- 只在必要时更新故事内容
