# 首页布局控制指南

唯一人工维护来源：`design/home-index-elements.json`（v2）。WXML、WXSS、本指南与运行时适配模块均为生成产物，不应独立维护。

## 固定画布与安全区

- 当前设计画布为 750×1500，unit=design，referenceWidth 仅兼容旧字段且必须等于 designWidth。设计单位输出为 px，再由根区域统一缩放，不是 rpx 或 vh。
- 当前背景目标宽高比为 1:2，对应 750×1500 设计画布；不能仅凭文件名、扩展名或配置认定真实比例。正常生成入口读取本地 PNG 头，检查八字节签名、至少 24 字节长度及偏移 16/20 的非零宽高，再比较 designWidth × 图片高度 / 图片宽度与 designHeight；这不是完整 PNG 解码校验。
- 当前非背景元素的最下边界为推荐区域 650 + 450 = 1100，画布高度 1500 覆盖此边界。以上为设计比例与配置边界推导，不是真机测量，也不代表背景 PNG 头已经校验通过。
- 编辑器与小程序共用 getAvailableRect/fitHome/resolveHomeElements。safeArea 是屏幕坐标，使用 screenTop 转成窗口局部坐标后与窗口相交；缺少有效 screenTop 或 safeArea 时回退整个窗口并记录 diagnostics，不猜测屏幕原点。
- windowHeight 已扣除原生导航栏和 tabBar，不再减 tabBar、高度常量或底部安全区；statusBarHeight 仅供诊断。不能在页面、编辑器和共享函数中重复扣减。
- 统一 contain：scale = min(可用宽 / 设计宽, 可用高 / 设计高)，offsetX/Y = 可用区域起点 + 剩余空间 / 2。整张背景、按钮、推荐及文字共用根变换，背景 aspectFit 保持完整比例，留白使用 pageBackground，不逐个元素重新适配。

## 坐标与显隐

- x/y/width/height 使用固定设计单位，scale 以左上角为原点；不再支持 heightUnit。
- 子项 followParent 固定为 true，只有根节点为 false。WXML/HTML 按 parentId 真实嵌套，x/y 始终为局部坐标，随父级平移和缩放，不累计为根坐标。宽高不重排兄弟节点。
- group.visible 只是编辑标记，不隐藏后代；hit.visible 不禁用原生 button。根节点一直保留。
- 固定单屏，通过 contain 完整容纳设计范围内的内容，不以裁切必要内容代替适配。窗口 overflow 仅用于防止用户将元素移出设计范围后产生滚动；编辑器提示越界。装饰层 pointer-events:none；按钮和轮播功能层 pointer-events:auto。
- 固定层级由配置 fixedLayers 与 elements 数组顺序共同决定：fixedLayers 指定节点层级，同级节点按数组顺序渲染，后项在前项之上。应保持按钮区域高于推荐区域，避免推荐阻挡按钮点击。
- text 非空时覆盖展示；text 为空字符串时继续使用 textBinding 动态数据，预览与小程序保持一致，不修改故事数据。

## 按钮命中与资源隔离

- index-primary-button 的 followsElementId 固定为同父级 index-primary-background；点击几何为只读派生值，不独立维护。hitPadding 四边非负，单位为底图缩放前的设计单位，零表示贴合底图矩形，不按透明像素轮廓命中。
- 设底图缩放为 s：命中 x = 底图 x - left × s，y = 底图 y - top × s，width = 底图 width + left + right，height = 底图 height + top + bottom，scale = s；父级与根缩放继续统一作用。元素清单列出派生后的几何。
- 正式按钮只读取 runtimeImagePath，默认空值不回退旧棕色图；imagePath/defaultImages 的按钮项保持为空。editorDebugImagePath 与 editorDebugVisible 仅供编辑预览，不输出到正式 WXML。
- 恢复按钮默认资源分别读取 defaultRuntimeImages/defaultEditorImages；替换、清除或隐藏辅助图不改变命中跟随关系。底图 visible=false、透明或正式图片为空都不禁用原生按钮，文字和图标仍是独立节点。

## 文字字段

- text/textBinding 控制展示覆盖与动态绑定；fontSize 为设计单位，fontWeight 为 100..900 的整数字重，color 为颜色，lineHeight 为无单位倍数，textAlign 为 left/center/right，maxLines 控制截断行数。
- letterSpacing 为设计单位并允许负值；textShadow 支持单组横向偏移、纵向偏移、非负模糊和颜色，例如 0 2px 4px rgba(0,0,0,0.3)，空值或 none 表示无阴影。它们与文字一起随根区域缩放。
- opacity 为 0..1，只作用于非 group/root/hit 的自身视觉，不叠加淡化组后代，也不关闭点击。
- fontFamily/fontAssetId 当前必须为空，仅预留字段，不上传或加载字体。共用字体栈为 PingFang SC、Hiragino Sans GB、Microsoft YaHei、sans-serif；不同平台字形仍需实测。

## 图片操作

- 隐藏：visible=false；恢复显示：visible=true，路径不变。
- 清除：imageCleared=true，禁止动态图、默认图、字符和底色回退。单改 visible 不会撤销清除。
- 恢复普通元素默认图：imageCleared=false，imagePath 设为 defaultImages[designId]（或留空使用默认图）；保留 visible 原值，不自动显示原本隐藏的元素。按钮使用前述独立默认映射。
- 替换普通图片填 imagePath，按钮正式/辅助图分别填 runtimeImagePath/editorDebugImagePath，并设 imageCleared=false。仅支持 miniprogram/assets/ 项目路径、/assets/ 小程序路径和 HTTPS 地址；固定背景比例核对要求使用本地 PNG。
- 上传图片先暂存供编辑器预览；点击保存后才复制到项目素材目录。上传不等于保存，也不会立即覆盖当前页面素材。
- 封面优先使用 item.coverImage，无动态图时使用本地回退。网络加载失败不自动切换回退图。
- 放大镜字符和标签底色是临时回退，填图片路径即可替换。
- 透明 PNG 应优先选择 aspectFit（完整显示），保留透明像素及整张图片比例，不裁切、不拉伸；透明区域露出下层，不等同于清除背景。aspectFill（填满裁切）可能裁掉透明边缘和画面，scaleToFill（拉伸铺满）可能变形。
- imageMode: aspectFill/aspectFit/scaleToFill。imageCropX/Y=0..100 是放大取景的临时控件限制，不是标准焦点裁切，也不是原图像素裁切。50 为居中；aspectFill 偏离中心时额外放大，最多两倍防止露白，会改变可见范围。其他模式忽略取景值。
- 背景已内嵌的按钮、标题、框和装饰无法通过独立节点开关删除。

## 业务边界

- button 保留 goToExplore；推荐保留 goToRecommendation 和 item.storyId。不修改数据、路由、云函数。
- swiper 绑定 onRecommendationChange/currentRecommendationIndex；仅由 change 事件处理同步当前索引，不修改推荐数据读取函数，也不承诺数据更新时重置索引。此模块仅负责展示与绑定。
- 三个小点按有效推荐数量显示；预览 record 由调用方传入，不是业务数据源。
- 预览以固定设计画布渲染，宿主通过共享适配函数提供缩放和偏移；窗口预设或导入 wx.getWindowInfo() JSON 只影响预览，不写入设计配置。图片 src 统一为 /__design_editor/home-asset?path=编码路径；/assets/ 转为 miniprogram/assets/ 项目路径，HTTPS 地址也经过该入口。

## 配置备注

- 唯一人工维护来源；首页结构、样式、元素清单由此生成。
- 品牌首页固定单屏，不通过滚动解决越界。
- 正式背景沿用现有首页背景图片，内嵌按钮、标题、推荐框、封面和装饰，独立节点开关不能删除背景像素。
- 固定设计画布为 750×1500，背景按 aspectFit 保持比例；高度 1500 覆盖现有元素 bottom=1100，这是设计比例与元素边界推导，非真机测量。
- referenceWidth 仅用于兼容，始终等于 designWidth；画布整体等比适配可用区域，不采用窗口百分比高度。
- 按钮点击范围由按钮底图和四边 hitPadding 派生；正式按钮底图为空，不回退旧棕色图片，旧图仅用于编辑辅助。
- 放大镜字符和标签底色是临时方案，填写各自图片路径即可换图，无需修改布局或业务。

## 保存、生成与校验

- 编辑器保存时备份将被覆盖的现有文件，复制本次暂存上传素材，并写入唯一配置 `design/home-index-elements.json` 及四份产物：`miniprogram/pages/index/index.wxml`、`miniprogram/pages/index/index.wxss`、`docs/home-layout-controls-guide.md`、`miniprogram/pages/index/home-adaptation.generated.js`。
- 保存前的编辑和上传仅用于草稿预览；以保存成功结果确认落盘，失败时查看错误和备份，不将预览当作已保存。

`node scripts/home-generator.js --check` 先检查本地背景 PNG 头及设计比例，再只读比较四份产物，缺失或不一致时退出码 1。不带 --check 会写入四份产物；该命令不等同于编辑器保存，不负责写回配置、处理暂存上传或创建编辑器保存备份。

运行时模块由 core 读取共享 home-adaptation.js 源码，去掉 export function 的 export，并按 core 格式追加 CommonJS 导出 getAvailableRect、fitHome、resolveHomeElements 和 design 尺寸；不得另写一套适配算法。

若 Node 被宿主策略阻止，不绕过策略；只能按已读取的配置、共享渲染及 core 规则用 apply_patch 精确投影四份产物，并在审计中标注未自动校验。静态投影不等于生成命令或 --check 已通过；恢复正常执行环境后必须补跑。

当前没有 DevTools 或真机验证结论。需补验背景 PNG 头、不同窗口与缺失 screenTop 的回退、tabBar/安全区、留白、透明完整图片、按钮命中、文字截断、推荐轮播和页面跳转；不能将预览或静态配置称作真机验收。

## 元素清单

| designId | 名称 | parentId | type | visible | x, y | width x height | imagePath | defaultImages | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| index-page | 首页 | - | root | true | 0, 0 | 750 x 1500 design |  |  | 首页固定 750×1500 设计画布，整体等比适配可用区域；不是可用窗口百分比高度。 |
| index-background-image | 首页背景图片 | index-page | image | true | 0, 0 | 750 x 1500 design | miniprogram/assets/backgrounds/home-background-placeholder.png | miniprogram/assets/backgrounds/home-background-placeholder.png | 正式首页背景按 aspectFit 适配固定设计画布；内嵌按钮、标题、推荐框、封面和装饰不能通过子元素开关删除。 |
| index-primary-region | 寻找传说区域 | index-page | group | true | 32, 444 | 686 x 250 design |  |  | 整体移动四个子项；自身没有外观，显隐不关闭子项。 |
| index-primary-button | 按钮点击区域 | index-primary-region | hit | true | 83, -120 | 500 x 150 design |  |  | 保留原生按钮与现有跳转；显隐仅控制编辑辅助标记，不禁用点击。几何由按钮底图和 hitPadding 派生，不可直接编辑或修改跟随关系。 |
| index-primary-background | 按钮底图 | index-primary-region | image | true | 83, -120 | 500 x 150 design |  |  | 正式按钮底图仅使用 runtimeImagePath，留空时不回退旧棕色图；editorDebugImagePath 仅供编辑辅助。视觉几何决定点击范围，不影响文字或图标。 |
| index-primary-icon | 放大镜图标 | index-primary-region | icon | false | 150, 82 | 64 x 64 design |  |  | 临时使用现有放大镜字符，不是最终图片；填写图片路径即可替换。背景另有内嵌放大镜。 |
| index-primary-label | 寻找传说文字 | index-primary-region | text | false | 220, 93 | 240 x 48 design |  |  | 独立文字，默认延续隐藏，背景中仍有同名文字。 |
| index-recommendation-section | 编辑推荐区域 | index-page | group | true | 32, 650 | 686 x 450 design |  |  | 整体移动外框、标题、内容和小点；自身没有外观。 |
| index-recommendation-outer-frame | 最底部外框图片 | index-recommendation-section | image | false | 0, 0 | 686 x 448 design | miniprogram/assets/cards/home-recommendation-panel-placeholder.png | miniprogram/assets/cards/home-recommendation-panel-placeholder.png | 仅保留一个外框节点；背景内嵌外框仍然存在。 |
| index-recommendation-heading | 编辑推荐标题文字 | index-recommendation-section | text | false | 28, 0 | 620 x 42 design |  |  | 独立大标题，背景中的同名文字仍然存在。 |
| index-recommendation-subtitle | 标题下面的小文字 | index-recommendation-section | text | false | 28, 42 | 620 x 34 design |  |  | 只控制独立说明文字，不影响故事内容。 |
| index-recommendation-content | 推荐内容区域 | index-recommendation-section | group | true | 28, 90 | 624 x 320 design |  |  | 每条推荐共用同一套设计；滑动与点击包装不增加视觉编辑项。 |
| index-recommendation-inner-frame | 推荐内框图片 | index-recommendation-content | image | true | 0, 0 | 624 x 320 design | miniprogram/assets/cards/home-recommendation-card-placeholder.png | miniprogram/assets/cards/home-recommendation-card-placeholder.png | 推荐内容的独立纸纹底图。 |
| index-recommendation-cover | 推荐封面图片 | index-recommendation-content | image | true | 0, 0 | 300 x 200 design | miniprogram/assets/banners/home-recommendation-cover-placeholder.png | miniprogram/assets/banners/home-recommendation-cover-placeholder.png | 动态封面优先，无动态图使用本地回退图；编辑器只显示一个封面对象。 |
| index-recommendation-tag-group | 推荐标签区域 | index-recommendation-content | group | true | 280, 12 | 132 x 42 design |  |  | 整体移动标签底图和文字，两者仍可分别调整。 |
| index-recommendation-tag-background | 标签底图 | index-recommendation-tag-group | decoration | true | 0, 0 | 132 x 42 design |  |  | 临时复用现有标签底色，不是最终图片；填写图片路径即可替换。 |
| index-recommendation-tag-text | 标签文字 | index-recommendation-tag-group | text | true | 0, 5 | 132 x 32 design |  |  | 显示当前推荐标签，不与底图合并。 |
| index-recommendation-title | 推荐故事标题 | index-recommendation-content | text | true | 280, 64 | 320 x 76 design |  |  | 当前推荐的标题，在独立文字范围内截断。 |
| index-recommendation-location | 推荐故事地点 | index-recommendation-content | text | true | 280, 146 | 320 x 30 design |  |  | 保留当前推荐地点，拥有独立显隐与文字样式。 |
| index-recommendation-summary | 推荐故事内容 | index-recommendation-content | text | true | 280, 184 | 320 x 78 design |  |  | 只控制摘要展示，不修改推荐数据或原始故事。 |
| index-recommendation-action-label | 免费阅读文字 | index-recommendation-content | text | true | 280, 278 | 320 x 32 design |  |  | 只显示当前阅读提示，不新增跳转事件。 |
| index-recommendation-dots | 轮播小点区域 | index-recommendation-section | group | true | 306, 430 | 74 x 14 design |  |  | 三个点独立配置，按有效推荐数量显示。 |
| index-recommendation-dot-1 | 第一个轮播小点 | index-recommendation-dots | dot | true | 0, 0 | 14 x 14 design |  |  | 至少一条有效推荐时显示；当前为第一条时选中。 |
| index-recommendation-dot-2 | 第二个轮播小点 | index-recommendation-dots | dot | true | 30, 0 | 14 x 14 design |  |  | 至少两条有效推荐时显示；当前为第二条时选中。 |
| index-recommendation-dot-3 | 第三个轮播小点 | index-recommendation-dots | dot | true | 60, 0 | 14 x 14 design |  |  | 至少三条有效推荐时显示；当前为第三条时选中。 |
