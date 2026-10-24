# 首页布局控制指南

唯一人工维护来源：`design/home-index-elements.json`。不要手改生成的 WXML/WXSS。

## 坐标与显隐

- x/y/width/height 使用 rpx，根和背景的 heightUnit=vh 指可用窗口高度。scale 以左上角为原点。
- 子项 followParent 固定为 true，只有根节点为 false。WXML/HTML 按 parentId 真实嵌套，x/y 始终为局部坐标，随父级平移和缩放，不累计为根坐标。宽高不重排兄弟节点。
- group.visible 只是编辑标记，不隐藏后代；hit.visible 不禁用原生 button。根节点一直保留。
- 固定单屏，越界裁切，不通过滚动解决。装饰层 pointer-events:none；按钮和轮播功能层 pointer-events:auto。
- 固定层级由配置 fixedLayers 与 elements 数组顺序共同决定：fixedLayers 指定节点层级，同级节点按数组顺序渲染，后项在前项之上。应保持按钮区域高于推荐区域，避免推荐阻挡按钮点击。
- text 非空时覆盖展示；text 为空字符串时继续使用 textBinding 动态数据，预览与小程序保持一致，不修改故事数据。

## 图片操作

- 隐藏：visible=false；恢复显示：visible=true，路径不变。
- 清除：imageCleared=true，禁止动态图、默认图、字符和底色回退。单改 visible 不会撤销清除。
- 恢复默认图：imageCleared=false，imagePath 设为 defaultImages[designId]（或留空使用默认图）；保留 visible 原值，不自动显示原本隐藏的元素。显示/隐藏是独立操作。
- 替换：填 imagePath，设 imageCleared=false。仅支持 miniprogram/assets/ 项目路径、/assets/ 小程序路径和 HTTPS 地址，不支持其他本地目录或协议。
- 上传图片先暂存供编辑器预览；点击保存后才复制到项目素材目录。上传不等于保存，也不会立即覆盖当前页面素材。
- 封面优先使用 item.coverImage，无动态图时使用本地回退。网络加载失败不自动切换回退图。
- 放大镜字符和标签底色是临时回退，填图片路径即可替换。
- imageMode: aspectFill/aspectFit/scaleToFill。imageCropX/Y=0..100 是放大取景的临时控件限制，不是标准焦点裁切，也不是原图像素裁切。50 为居中；aspectFill 偏离中心时额外放大，最多两倍防止露白，会改变可见范围。其他模式忽略取景值。
- 背景已内嵌的按钮、标题、框和装饰无法通过独立节点开关删除。

## 业务边界

- button 保留 goToExplore；推荐保留 goToRecommendation 和 item.storyId。不修改数据、路由、云函数。
- swiper 绑定 onRecommendationChange/currentRecommendationIndex；仅由 change 事件处理同步当前索引，不修改推荐数据读取函数，也不承诺数据更新时重置索引。此模块仅负责展示与绑定。
- 三个小点按有效推荐数量显示；预览 record 由调用方传入，不是业务数据源。
- 预览使用 750 设计像素，宿主提供缩放和 --home-preview-height。图片 src 统一为 /__design_editor/home-asset?path=编码路径；/assets/ 转为 miniprogram/assets/ 项目路径，HTTPS 地址也经过该入口。

## 配置备注

- 唯一人工维护来源；首页结构、样式、元素清单由此生成。
- 品牌首页固定单屏，不通过滚动解决越界。
- 背景仍内嵌按钮、标题、推荐框、封面和装饰，独立节点开关不能删除背景像素。
- 按钮初始命中范围来自旧样式推导，尚未真机测量。
- 放大镜字符和标签底色是临时方案，填写各自图片路径即可换图，无需修改布局或业务。

## 保存、生成与校验

- 编辑器保存时备份将被覆盖的现有文件，复制本次暂存上传素材，并写入唯一配置 `design/home-index-elements.json` 及三份产物：`miniprogram/pages/index/index.wxml`、`miniprogram/pages/index/index.wxss`、`docs/home-layout-controls-guide.md`。
- 保存前的编辑和上传仅用于草稿预览；以保存成功结果确认落盘，失败时查看错误和备份，不将预览当作已保存。

`node scripts/home-generator.js --check` 只读比较，缺失或不一致时退出码 1。不带 --check 会写入首页 WXML/WXSS 和本指南；该命令不等同于编辑器保存，不负责写回配置、处理暂存上传或创建编辑器保存备份。

## 元素清单

| designId | 名称 | parentId | type | visible | x, y | width x height | imagePath | defaultImages | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| index-page | 首页 | - | root | true | 0, 0 | 750 x 100vh |  |  | 首页整体范围，不含原生导航栏和底部导航；高度单位为可用窗口百分比。 |
| index-background-image | 首页背景图片 | index-page | image | true | 0, 0 | 750 x 100vh | miniprogram/assets/backgrounds/home-background-placeholder.png | miniprogram/assets/backgrounds/home-background-placeholder.png | 整张背景仍含按钮、标题、推荐框、封面和装饰，不能通过子元素开关删除。 |
| index-primary-region | 寻找传说区域 | index-page | group | true | 32, 444 | 686 x 250rpx |  |  | 整体移动四个子项；自身没有外观，显隐不关闭子项。 |
| index-primary-button | 按钮点击区域 | index-primary-region | hit | true | 83, 45 | 500 x 150rpx |  |  | 保留原生按钮与现有跳转；显隐仅控制编辑辅助标记，不禁用点击。初始范围沿用旧样式推导。 |
| index-primary-background | 按钮底图 | index-primary-region | image | true | 83, -120 | 500 x 150rpx | miniprogram/assets/buttons/home-primary-button-placeholder.png | miniprogram/assets/buttons/home-primary-button-placeholder.png | 只控制按钮图片，不影响文字、图标或点击范围。 |
| index-primary-icon | 放大镜图标 | index-primary-region | icon | false | 150, 82 | 64 x 64rpx |  |  | 临时使用现有放大镜字符，不是最终图片；填写图片路径即可替换。背景另有内嵌放大镜。 |
| index-primary-label | 寻找传说文字 | index-primary-region | text | false | 220, 93 | 240 x 48rpx |  |  | 独立文字，默认延续隐藏，背景中仍有同名文字。 |
| index-recommendation-section | 编辑推荐区域 | index-page | group | true | 32, 650 | 686 x 450rpx |  |  | 整体移动外框、标题、内容和小点；自身没有外观。 |
| index-recommendation-outer-frame | 最底部外框图片 | index-recommendation-section | image | false | 0, 0 | 686 x 448rpx | miniprogram/assets/cards/home-recommendation-panel-placeholder.png | miniprogram/assets/cards/home-recommendation-panel-placeholder.png | 仅保留一个外框节点；背景内嵌外框仍然存在。 |
| index-recommendation-heading | 编辑推荐标题文字 | index-recommendation-section | text | false | 28, 0 | 620 x 42rpx |  |  | 独立大标题，背景中的同名文字仍然存在。 |
| index-recommendation-subtitle | 标题下面的小文字 | index-recommendation-section | text | false | 28, 42 | 620 x 34rpx |  |  | 只控制独立说明文字，不影响故事内容。 |
| index-recommendation-content | 推荐内容区域 | index-recommendation-section | group | true | 28, 90 | 624 x 320rpx |  |  | 每条推荐共用同一套设计；滑动与点击包装不增加视觉编辑项。 |
| index-recommendation-inner-frame | 推荐内框图片 | index-recommendation-content | image | true | 0, 0 | 624 x 320rpx | miniprogram/assets/cards/home-recommendation-card-placeholder.png | miniprogram/assets/cards/home-recommendation-card-placeholder.png | 推荐内容的独立纸纹底图。 |
| index-recommendation-cover | 推荐封面图片 | index-recommendation-content | image | true | 0, 0 | 300 x 200rpx | miniprogram/assets/banners/home-recommendation-cover-placeholder.png | miniprogram/assets/banners/home-recommendation-cover-placeholder.png | 动态封面优先，无动态图使用本地回退图；编辑器只显示一个封面对象。 |
| index-recommendation-tag-group | 推荐标签区域 | index-recommendation-content | group | true | 280, 12 | 132 x 42rpx |  |  | 整体移动标签底图和文字，两者仍可分别调整。 |
| index-recommendation-tag-background | 标签底图 | index-recommendation-tag-group | decoration | true | 0, 0 | 132 x 42rpx |  |  | 临时复用现有标签底色，不是最终图片；填写图片路径即可替换。 |
| index-recommendation-tag-text | 标签文字 | index-recommendation-tag-group | text | true | 0, 5 | 132 x 32rpx |  |  | 显示当前推荐标签，不与底图合并。 |
| index-recommendation-title | 推荐故事标题 | index-recommendation-content | text | true | 280, 64 | 320 x 76rpx |  |  | 当前推荐的标题，在独立文字范围内截断。 |
| index-recommendation-location | 推荐故事地点 | index-recommendation-content | text | true | 280, 146 | 320 x 30rpx |  |  | 保留当前推荐地点，拥有独立显隐与文字样式。 |
| index-recommendation-summary | 推荐故事内容 | index-recommendation-content | text | true | 280, 184 | 320 x 78rpx |  |  | 只控制摘要展示，不修改推荐数据或原始故事。 |
| index-recommendation-action-label | 免费阅读文字 | index-recommendation-content | text | true | 280, 278 | 320 x 32rpx |  |  | 只显示当前阅读提示，不新增跳转事件。 |
| index-recommendation-dots | 轮播小点区域 | index-recommendation-section | group | true | 306, 430 | 74 x 14rpx |  |  | 三个点独立配置，按有效推荐数量显示。 |
| index-recommendation-dot-1 | 第一个轮播小点 | index-recommendation-dots | dot | true | 0, 0 | 14 x 14rpx |  |  | 至少一条有效推荐时显示；当前为第一条时选中。 |
| index-recommendation-dot-2 | 第二个轮播小点 | index-recommendation-dots | dot | true | 30, 0 | 14 x 14rpx |  |  | 至少两条有效推荐时显示；当前为第二条时选中。 |
| index-recommendation-dot-3 | 第三个轮播小点 | index-recommendation-dots | dot | true | 60, 0 | 14 x 14rpx |  |  | 至少三条有效推荐时显示；当前为第三条时选中。 |
