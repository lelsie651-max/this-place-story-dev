# UI Layout Audit

## 当前首页说明与历史边界

本文旧审计的全局结论属于历史记录，不代表当前首页。下文关于“没有统一设计变量 / 稳定 ID / 图片目录 / 资产清单”“尚未实现编辑器”、旧资源统计以及流式布局的建议均保留为历史背景，不可据此调整当前首页；其他页面的审计内容保留，未在本次重新验收。

- 首页唯一人工维护来源为 `design/home-index-elements.json`，结构、样式和元素清单由此生成。
- 首页布局数字、素材路径、显隐及生成步骤统一查阅[首页布局控制指南](home-layout-controls-guide.md)，不在本审计中维护第二套首页数值，也不要手改生成的首页 WXML/WXSS。
- 当前品牌首页固定单屏，越界裁切，不通过滚动解决；可用窗口不含原生导航栏和底部导航。
- 背景仍内嵌按钮、标题、推荐框、封面和装饰，独立节点的开关不能删除背景像素。
- 放大镜字符和标签底色只是临时方案，不是最终图片素材；替换方式以新指南为准。
- 按钮初始命中范围来自旧样式推导，尚未真机测量。不同机型的裁切、点击范围、轮播与原生 tabBar / 安全区适配仍待 DevTools 和真机验证，不能将静态配置视为实测结果。

## 1. 范围与结论

本次审计覆盖以下页面：

- `miniprogram/pages/index/`
- `miniprogram/pages/profile/`
- `miniprogram/pages/atlas/`
- `miniprogram/pages/discovery/`
- `miniprogram/pages/location/`
- `miniprogram/pages/story/`
- `miniprogram/pages/publish/`
- `miniprogram/pages/myStories/`
- `miniprogram/pages/myStoryPreview/`
- `miniprogram/pages/myStoryEdit/`

本轮同时完成了个人中心重复入口删除：

- 已删除个人中心菜单中的“我的图鉴”
- 保留底部 `tabBar` 的“足迹”
- 保留 `pages/atlas/atlas`
- 保留其他进入 atlas 的合法路径

原审计总体判断（历史，不代表当前首页）：

1. 当前小程序已经形成了比较稳定的暖色卡片式视觉语言，但主要靠分散在各页面 `wxss` 里的硬编码数值维持，还没有真正的统一设计变量。
2. 首页、个人中心、投稿相关页面已经具备“组件化样式块”的雏形，适合进入“先统一 token，再做编辑器”的路线。
3. `location`、`story`、`publish`、`myStory*` 这些页面虽然能做视觉编辑，但不能直接把布局改造成绝对定位拖拽，否则很容易破坏动态文案、加载态、错误态和业务按钮链路。
4. 当前项目适合做独立的 `design-editor/`，但第一版更适合输出 JSON 设计配置，而不是直接改业务代码或直接拖拽生成整页绝对坐标。

## 2. 运行时测量说明

本次审计结合了：

- WXML 结构
- WXSS 设计值
- 页面生命周期和动态状态逻辑
- 原生 `tabBar` / 安全区的代码约束

但当前 CLI 环境无法直接进入微信开发者工具或真机运行小程序，因此**没有把 `wx.createSelectorQuery()` 的调试代码永久加入页面**。  
所以本次文档中的尺寸值以源码中的 `rpx / % / auto / min-height / fixed inset` 为主，运行时 `px` 实测值和原生 `tabBar` 真实高度需要在 DevTools 或真机中补采。

建议后续新增一套**只在开发环境启用**的临时测量脚本，专门输出：

- `left`
- `top`
- `width`
- `height`

当前首页按[首页布局控制指南](home-layout-controls-guide.md)中的 `designId` 测量背景、按钮命中范围和推荐区域，不再沿用旧首页选择器。

其他页面测量节点优先级：

- 个人中心资产卡 `.asset-panel`
- 个人中心菜单项 `.menu-item`
- 足迹卡片 `.atlas-card`
- 投稿输入框 `.text-input`
- 投稿正文框 `.text-area`

## 3. 页面与主要组件

### 3.1 页面列表

| 页面 | 主要职责 | 动态程度 | 编辑器风险 |
|---|---|---:|---|
| `index` | 首页主视觉、主入口、编辑推荐 | 中 | 不能破坏推荐免费阅读和 swiper |
| `profile` | 个人资产、功能入口、广告奖励 | 高 | 广告按钮与菜单配置有业务状态 |
| `atlas` | 足迹列表与空/错状态 | 中 | 卡片可改样式，列表逻辑别碰 |
| `discovery` | 地点选择与推荐地点列表 | 中 | 卡片可改样式，选点按钮和列表链路别碰 |
| `location` | 地点详情、故事模式、请求遮罩 | 很高 | 与放大镜、AI 请求、足迹写入强耦合 |
| `story` | 故事正文、AI 帖子样式、收藏 | 高 | 展示可配，业务按钮和来源判断别碰 |
| `publish` | 投稿地点、标题、正文、提交 | 高 | 输入区样式可改，表单行为不能动 |
| `myStories` | 我的投稿列表 | 中 | 卡片可配，审核状态语义不能改 |
| `myStoryPreview` | 投稿预览、拒绝原因、操作按钮 | 高 | 按钮显示条件强依赖业务状态 |
| `myStoryEdit` | 投稿编辑表单 | 高 | 表单控件可改，校验与提交逻辑不能动 |

### 3.2 主要组件尺寸表

首页组件尺寸与稳定 ID 已迁至[首页布局控制指南](home-layout-controls-guide.md)，由 `design/home-index-elements.json` 生成；以下全局行是历史公共基底记录，不作为当前首页布局约束，其他页记录保留。

| 页面 | 组件名称 | 稳定 ID | WXML 节点 | WXSS 来源 | 宽度 | 高度 | 外边距 | 内边距 | 定位方式 | 对齐方式 | 字体 | 文字/背景 | 圆角/边框/阴影 | 层级 | 图片适配 | 可编辑属性 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---:|---|---|
| 全局 | 页面根容器 | 无，只有通用 `.page` | `.page` | `app.wxss:.page` | `auto` | `min-height:100vh` | 无 | `40rpx 32rpx 56rpx` | normal | block | `32rpx` 默认文本 | 米白到暖棕径向渐变 | 无圆角；无边框 | 0 | 无 | `spacing`,`background`,`font` |
| 个人中心 | 顶部资料卡 | 无稳定 ID，建议 `profile-header-card` | `.profile-header.panel` | `profile.wxss:.profile-header` + `app.wxss:.panel` | `auto` | auto | `margin-bottom:36rpx` | `padding-top:44rpx; padding-bottom:36rpx` + panel `32rpx` | normal | `text-align:center` | 名称 `40rpx/600` | 浅暖色渐变底 | `28rpx` 圆角，panel 阴影 | 0 | 头像为纯色圆形块 | `background`,`spacing`,`avatar`,`font` |
| 个人中心 | 资产卡 | 无稳定 ID，建议 `profile-assets-card` | `.asset-panel.panel` | `profile.wxss:.asset-panel` | `auto` | auto | `margin-bottom:32rpx` | panel `32rpx` | normal | flex + space-between | 数字 `58rpx/1.1/600` | 浅暖金色渐变底 | `28rpx` 圆角，panel 阴影 | 0 | 无 | `background`,`spacing`,`font`,`radius` |
| 个人中心 | 菜单项 | 无稳定 ID，建议每项增加 `data-component-id` | `.menu-item.panel` | `profile.wxss:.menu-item` + `.menu-*` | `auto` | auto | 每项依赖 panel `margin-bottom:28rpx` | `padding-top/bottom:28rpx` + panel `32rpx` | flex | 左右分栏 | 标题 `32rpx`，副文 `22rpx` | 暖白卡片底 | `28rpx` 圆角，panel 阴影 | 0 | emoji 图标，非图片 | `spacing`,`icon`,`font`,`background` |
| 足迹 | 足迹汇总卡 | 无稳定 ID，建议 `atlas-summary-card` | `.summary-card.panel` | `atlas.wxss:.summary-card` | `auto` | auto | panel `margin-bottom:28rpx` | panel `32rpx` | normal | `text-align:center` | 数字 `72rpx/600` | 浅暖色渐变底 | `28rpx` 圆角，panel 阴影 | 0 | 无 | `background`,`font`,`spacing` |
| 足迹 | 足迹卡片 | 无稳定 ID，建议 `atlas-item-card` | `.atlas-card.panel` | `atlas.wxss:.atlas-card` | `auto` | auto | panel `margin-bottom:28rpx` | panel `32rpx` | `position:relative` | block | 地点 `36rpx/600`，标签 `24rpx` | 暖白 panel 背景 | `28rpx` 圆角，panel 边框/阴影 | 0 | 无 | `spacing`,`tag`,`font`,`background` |
| 地点选择 | 微信选点按钮 | 无稳定 ID，建议 `discovery-choose-location-button` | `.choose-location-button` | `discovery.wxss:.choose-location-button` | `auto`，button 默认占满容器 | auto，靠 `line-height:84rpx` | `location-entry margin-bottom:28rpx` | 依赖 button 默认 | normal | center | `28rpx/84rpx` | 浅暖色渐变底 | `999rpx` 圆角，`1rpx` 边框，轻阴影 | 0 | 无 | `background`,`radius`,`font`,`shadow` |
| 地点选择 | 推荐地点卡片 | 无稳定 ID，建议 `discovery-location-card` | `.mode-card.panel` | `discovery.wxss:.mode-card` | `auto` | auto | panel `margin-bottom:28rpx` | panel `32rpx` | `position:relative` + 伪元素装饰 | block | 标题 `36rpx/600` | panel 底 + 右上角径向光斑 | `28rpx` 圆角，panel 阴影 | 0 | 无 | `background`,`spacing`,`badge`,`font` |
| 地点详情 | 放大镜徽标 | 无稳定 ID，建议 `location-magnifying-badge` | `.location-magnifying-badge` | `location.wxss:.location-magnifying-badge` | auto | `min-height:72rpx` | header `margin-bottom:28rpx` | `0 20rpx` | normal，grid 内右对齐 | inline-flex | `28rpx/600` | 暖白底 | `999rpx` 圆角，`1rpx` 边框，轻阴影 | 0 | 图标由纯 CSS 画出 | `spacing`,`background`,`radius`,`font` |
| 地点详情 | 故事类型项 | 无稳定 ID，建议 `location-story-mode-item` | `.story-item.mode-item` | `location.wxss:.story-item` | `auto` | auto | 项间依赖 `border-bottom` | `28rpx 0` | normal | block | 标题 `32rpx/600`，正文 `28rpx` | 无独立底色，继承卡片 | 无独立圆角 | 0 | 无 | `font`,`spacing`,`status-badge-color` |
| 地点详情 | 搜索遮罩 | 无稳定 ID，建议 `location-request-mask` | `.search-mask` / `.search-panel` | `location.wxss:.search-mask,.search-panel` | `fixed inset:0`；panel `width:100%` | 全屏 / auto | 无 | mask `48rpx`；panel `56rpx 44rpx` | `fixed` | center | 标题 `36rpx/600` | 半透明深底 + 暖色浮层 | panel `32rpx` 圆角，强阴影 | 50 | 无 | 只建议开放 `panel background`,`radius`,`shadow`,`font`，不要开放绝对坐标 |
| 故事页 | AI 帖子卡 | 无稳定 ID，建议 `story-forum-card` | `.story-forum-card.panel` | `story.wxss:.story-forum-card` | `auto` | auto | panel `margin-bottom:28rpx` | `34rpx 30rpx` | normal | block | 标题 `46rpx/600` | 浅暖色渐变底 | `28rpx` 圆角，panel 阴影 | 0 | 头像为纯色渐变圆 | `background`,`spacing`,`avatar`,`font` |
| 故事页 | 返回/收藏按钮 | 无稳定 ID，建议 `story-primary-action` / `story-secondary-action` | `.actions .action-button` | `app.wxss:.actions,.action-button` | `100%` | `min-height:96rpx` | `margin-top:12rpx` + `gap:22rpx` | 无 | flow | vertical stack | `32rpx/96rpx/600` | 主按钮渐变；次按钮浅底 | `999rpx` 圆角 | 0 | 无 | `background`,`radius`,`font`,`shadow` |
| 投稿 | 标题输入框 | 无稳定 ID，建议 `publish-title-input` | `.text-input` | `publish.wxss:.text-input` | `100%` | `min-height:92rpx` | 无 | `0 24rpx` | normal | block | 跟随 page 默认 `32rpx` | 浅暖底色 | `22rpx` 圆角，无边框 | 0 | 无 | `radius`,`background`,`font`,`padding` |
| 投稿 | 正文输入框 | 无稳定 ID，建议 `publish-content-input` | `.text-area` | `publish.wxss:.text-area` | `100%` | `min-height:280rpx` | 无 | `24rpx` | normal | block | 默认 `32rpx`，`line-height:1.8` | 浅暖底色 | `22rpx` 圆角，无边框 | 0 | 无 | `radius`,`background`,`font`,`padding`,`minHeight` |
| 我的投稿 | 投稿卡片 | 无稳定 ID，建议 `my-stories-card` | `.panel.story-card` | `myStories.wxss:.story-card` | `auto` | auto | panel `margin-bottom:28rpx` | panel `32rpx` | `position:relative` | block | 标题 `34rpx/600` | 浅暖色渐变底 | `28rpx` 圆角，panel 阴影 | 0 | 无 | `background`,`status-color`,`font`,`spacing` |
| 投稿预览 | 拒绝原因提示 | 无稳定 ID，建议 `my-story-reason-banner` | `.story-reason-banner` | `myStoryPreview.wxss:.story-reason-banner` | `auto` | auto | `margin-bottom:24rpx` | `18rpx 20rpx` | normal | block | `26rpx/1.7` | 浅红背景 / 红字 | `20rpx` 圆角 | 0 | 无 | `background`,`font`,`spacing`,`radius` |
| 投稿编辑 | 编辑正文框 | 无稳定 ID，建议 `my-story-edit-content` | `.text-area` | `myStoryEdit.wxss:.text-area` | `100%` | `min-height:320rpx` | 无 | `24rpx` | normal | block | 默认 `32rpx`，`line-height:1.8` | 浅暖底色 | `22rpx` 圆角 | 0 | 无 | `radius`,`background`,`font`,`padding`,`minHeight` |

## 4. 颜色、字体、间距、圆角汇总

本节频次及“无统一变量”的结论为原审计快照，未按新首页重新统计，不代表当前首页配置。

### 4.1 高频颜色

基于目标页面 `wxss` 静态提取，高频值如下：

- 主棕色：`#8b5e34`，出现 23 次
- 深文本：`#4c3424`，出现 17 次
- 深棕强调：`#6b4527`，出现 11 次
- 浅棕标签底：`rgba(140, 94, 52, 0.12)`，出现 10 次
- 次级文字：`#8a725c`，出现 9 次
- 正文辅助色：`#6f5740`，出现 6 次

结论：**颜色体系已经事实上收敛**，但还没有被提炼成 token 文件。

### 4.2 高频字号

- `24rpx`：19 次
- `28rpx`：12 次
- `26rpx`：9 次
- `36rpx`：7 次
- `32rpx`：6 次
- `20rpx`：6 次
- `22rpx`：6 次

结论：已经存在一套隐含层级：

- 20/22/24 `rpx`：标签、副文、说明
- 26/28/30/32 `rpx`：正文、按钮、列表主文
- 34/36/40+ `rpx`：卡片标题、页面标题、小节强调
- 56/72 `rpx`：页面主标题、数字型视觉重心

### 4.3 高频圆角

- `999rpx`：17 次，主要用于按钮、胶囊标签、状态徽章
- `50%`：5 次，主要用于头像或镜片
- `28rpx`：3 次，主要用于 panel / 卡片
- `22rpx`：3 次，主要用于输入框

### 4.4 高频行高

- `1.7`：10 次
- `1.6`：8 次
- `1.5`：7 次
- `1.8`：6 次

结论：文本可读性已经比较统一，但仍旧是手写散落值。

### 4.5 当前是否存在统一设计变量

没有正式的统一设计变量文件，也没有 CSS 变量或 JSON token。  
当前只有 `app.wxss` 提供了这些“事实上的基底样式”：

- `.page`
- `.panel`
- `.page-title`
- `.page-subtitle`
- `.section-label`
- `.actions`
- `.action-button`
- `.tag`

这说明项目已经有**公共样式基底**，但还没进入“设计系统”阶段。

## 5. 图片和字体资源清单

### 5.1 图片资源

原审计搜索结果（历史，不代表当前首页资源现状）：

- 当前审计页面中只发现 **1 处 `<image>`**：首页编辑推荐卡片封面 `.recommendation-cover-image`
- 该图片来源是运行时数据 `item.coverImage`
- 当前没有统一本地图片目录：
  - `miniprogram/images` 不存在
  - `miniprogram/assets` 不存在

结论：

1. 目前页面视觉几乎全部靠纯色、渐变、emoji、文字和阴影完成。
2. 当前首页素材替换统一参见[首页布局控制指南](home-layout-controls-guide.md)，维护 `design/home-index-elements.json`，不手改生成的 WXML/WXSS 或推荐业务数据。
3. 背景图当前并未使用 `background-image`，背景替换主要会落在各页 `background` 渐变配置。

### 5.2 字体资源

当前只发现系统字体栈：

```css
font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

未发现：

- `@font-face`
- 本地字体文件
- 远程字体 `url(...)`

结论：

1. 当前**没有自定义字体**。
2. 如果未来要接入字体，建议优先评估：
   - 小程序对远程字体加载稳定性
   - 字体包体积
   - 是否需要按页面或主题加载
3. 对于品牌大标题，若想稳定控制视觉，可能仍然要准备：
   - 本地字体文件
   - 或转为静态图片 / SVG（但会损失文案编辑能力）

## 6. 当前 hard-coded 样式问题

当前主要问题不是“样式差”，而是**设计值分散**：

1. 各页重复写死同一批颜色：
   - `#8b5e34`
   - `#4c3424`
   - `#6b4527`
   - `#8a725c`
2. 卡片圆角、输入框圆角、按钮圆角虽有规律，但仍是手写常量。
3. 不同页面的标题系统看起来接近，但：
   - 有的用 `56rpx`
   - 有的用 `72rpx`
   - 有的用 `36rpx`
   缺少统一层级命名。
4. 原生 `tabBar` 高度本身不可配置，原审计中页面对底部安全区的适配没有统一抽象；当前首页已改为单屏，布局与安全区约束见[首页布局控制指南](home-layout-controls-guide.md)，不再沿用旧首页底部内边距数值。
5. 一些关键容器是强业务节点，例如：
   - `location` 的 `.search-mask`
   - `profile` 的广告奖励按钮
   - `myStoryPreview` 的状态按钮
   它们不能被“纯视觉拖拽”误伤。

## 7. 可视化编辑器可行性

本节是原审计阶段的可行性建议，不是当前首页编辑器状态。首页使用新配置及生成链路，操作与限制见[首页布局控制指南](home-layout-controls-guide.md)；其他页建议保留。

### 7.1 是否适合做 `design-editor/`

适合，但前提是：

1. 编辑器只改设计配置，不直接改业务 JS。
2. 先补稳定组件 ID。
3. 先统一 token。
4. 第一版只开放有限属性，不做整页自由绝对定位。

### 7.2 适合被编辑器控制的组件

适合：

- 首页主标题、副标题、主按钮
- 首页编辑推荐卡片的背景、圆角、阴影、封面占位样式
- 个人中心头图、资产卡、菜单卡样式
- 足迹卡片样式
- 地点选择卡片样式
- 投稿页输入框、按钮、字段卡片
- 我的投稿卡片、预览卡片、编辑表单卡片

谨慎开放：

- `location` 请求遮罩
- `story` 收藏按钮和返回按钮
- `myStoryPreview` 删除按钮、编辑按钮
- `profile` 广告奖励入口

不适合直接拖绝对坐标：

- 原生 `tabBar`
- `swiper` 内部推荐卡片布局
- 长文本正文区
- 动态列表项
- 加载 / 错误 / 空状态高度不固定的卡片

### 7.3 哪些页面依赖 flex、滚动、tabBar 或动态数据

| 页面 | 依赖点 |
|---|---|
| `index` | `swiper`、动态推荐数据、底部安全区 |
| `profile` | `onShow` 数据刷新、广告奖励、动态计数 |
| `atlas` | 动态列表、空态/错态 |
| `discovery` | 动态地点列表、微信选点 |
| `location` | 放大镜状态、请求遮罩、动态故事模式 |
| `story` | AI / 非 AI 双布局、收藏状态 |
| `publish` | 输入状态、地点上下文 |
| `myStories` | 审核状态列表 |
| `myStoryPreview` | 状态条件按钮、拒绝原因 |
| `myStoryEdit` | 表单回填、提交状态 |

### 7.4 哪些调整后可能破坏业务

- 改 `bindtap` 所在节点层级
- 改 `swiper-item` 尺寸和滚动容器
- 把 `location` 遮罩改成不可覆盖全屏
- 让按钮高度、内边距变化过大，影响点击区域
- 让输入框高度过小，影响表单可用性
- 修改带 `wx:if` 的业务状态块结构

### 7.5 是否需要先加稳定 ID

需要。当前绝大多数组件只有类名，没有真正稳定的组件 ID。  
建议至少给以下节点增加 `data-component-id` 或稳定 class：

- 首页已有配置中的稳定 `designId`，以[首页布局控制指南](home-layout-controls-guide.md)为准，不再新增旧 `home-*` ID
- `profile-header-card`
- `profile-assets-card`
- `profile-favorites-entry`
- `atlas-item-card`
- `discovery-location-card`
- `location-story-mode-item`
- `story-forum-card`
- `publish-title-input`
- `publish-submit-button`
- `my-stories-card`
- `my-story-reason-banner`

### 7.6 是否适合导出 WXSS

第一版不建议直接导出完整 WXSS，原因：

1. 现在页面结构还没有“样式层”和“业务层”彻底分离。
2. 直接生成 WXSS 很容易覆盖业务页面手写细节。
3. WXSS 不适合表达组件层级依赖、开关和资产映射。

**更适合导出 JSON，再由小程序在运行时读取或在构建时生成 WXSS。**

## 8. 推荐的数据结构

推荐采用：

### 8.1 `design-tokens.json`

存基础变量：

- 颜色
- 字号
- 行高
- 圆角
- 阴影
- 面板内边距
- 主按钮高度

### 8.2 `page-layout.json`

存页面级布局配置：

- 某个组件是否显示
- margin / padding
- 某些容器的最大宽度或最小高度
- 某些卡片是否启用背景图

### 8.3 `asset-manifest.json`

存图片和背景资源：

- 背景图
- Banner 图
- 按钮纹理图
- 主题资源版本

### 8.4 `component-registry.json`

存组件注册表：

- 当前选择器
- 组件用途
- 哪些属性可编辑
- 是否与业务强耦合

以上为原审计的数据分层建议，不是当前首页的多源配置方案。旧首页按钮 JSON 示例已移除；首页唯一来源为 `design/home-index-elements.json`，字段语义与元素清单见[首页布局控制指南](home-layout-controls-guide.md)。

## 9. 后续实施顺序

本节及后续风险、第一版建议保留为历史规划，不代表首页仍未实现编辑器。当前首页实施状态与待验证项以文首说明及[首页布局控制指南](home-layout-controls-guide.md)为准。

### 阶段一：设计变量统一

优先统一：

- 颜色
- 字体栈
- 字号层级
- 间距
- 圆角
- 阴影
- 按钮高度
- 卡片 padding

### 阶段二：组件注册

给主要组件补稳定 ID，不改业务逻辑：

- 首页
- 个人中心
- 足迹
- 投稿
- 我的投稿

### 阶段三：独立编辑器

新建 `design-editor/`：

- 左侧页面树
- 中间预览
- 右侧属性面板
- 先做颜色、圆角、间距、文字和背景编辑

### 阶段四：导出和应用

第一版更推荐：

1. 导出 JSON
2. 小程序读取 JSON
3. 或增加一个构建脚本把 JSON 转为 WXSS

而不是直接在编辑器里修改源文件。

## 10. 当前风险和限制

1. 当前没有运行时测量数据，原生 `tabBar` 高度和不同机型真实 `px` 需要后补。
2. 没有稳定组件 ID，编辑器现在还不适合直接“点选任意节点并存档”。
3. 页面样式已有明显共性，但还未抽成公共 token，直接做编辑器会把重复值问题搬进编辑器。
4. `location`、`story`、`publish`、`myStory*` 都有强业务状态，编辑器必须只开放白名单属性。
5. 当前无统一图片目录、无字体文件、无主题资产清单，未来替换图片或字体前需要先补资产管理层。

## 11. 第一版编辑器建议

推荐方案：

1. 先不实现拖拽自由布局。
2. 先做“选中组件 -> 编辑 token/spacing/background/font”的属性面板。
3. 保留流式布局和 flex 布局，不改绝对定位。
4. 支持：
   - 撤销
   - 重做
   - 恢复默认
   - 主题版本保存
   - iPhone / Android 窄宽度预览
5. 第一版仅覆盖：
   - 首页
   - 个人中心
   - 足迹
   - 投稿

不建议现在就实现编辑器，原因：

- 组件稳定 ID 还没补齐
- 设计变量还没统一
- 运行时尺寸测量还没建立
- 直接上编辑器会让业务页样式继续分叉
