# 首页真实图片素材替换说明

## 1. 首页背景图片

- 文件名：`home-background-placeholder.png`
- 路径：`miniprogram/assets/backgrounds/home-background-placeholder.png`
- 当前用途：首页固定背景图层，位于页面内容层下方。
- WXML 引用：`miniprogram/pages/index/index.wxml` 内的 `image.home-background-image`
- mode：`aspectFill`
- 是否会裁切：会。背景层显示尺寸是 `width: 100%; height: 100vh;`，源码未声明固定视口高度，因此不同设备会按视口比例裁切。
- 是否包含文字：否

### 实际显示约束

- 显示宽度：`100%`
- 显示高度：`100vh`
- 定位方式：`position: fixed`
- 层级约束：背景层 `z-index: 0`，首页内容层与页脚在其上方
- 点击约束：背景图不绑定事件，且位于内容层下方，不参与按钮点击
- Safe Area / tabBar 约束：背景层覆盖可视区域；页面内容仍通过 `.page` 的 `padding-bottom: calc(112rpx + env(safe-area-inset-bottom))` 规避底部原生 tabBar

### 建议制作尺寸

- 当前占位图文件尺寸：`1500 x 3000 px`
- 建议继续使用纵向长图，并保留足够上下裁切余量
- 该素材显示宽度由父节点和页面 rpx 布局决定，不能用单个固定 CSS px 表示。
- 源码未声明固定高度，需要保留布局约束。

### 尺寸依据

- 来自源码的尺寸：
  - `miniprogram/pages/index/index.wxss` 中的 `width: 100%`
  - `miniprogram/pages/index/index.wxss` 中的 `height: 100vh`
  - `miniprogram/pages/index/index.wxss` 中的 `position: fixed`
- 响应式尺寸：
  - 背景实际显示高度随设备视口变化，不能写成固定 px
  - 背景实际显示宽度随页面宽度变化，不能写成固定 px

## 2. 首页主按钮图片

- 文件名：`home-primary-button-placeholder.png`
- 路径：`miniprogram/assets/buttons/home-primary-button-placeholder.png`
- 当前用途：首页“寻找传说”主按钮的图片底图，文字继续叠加在按钮上层。
- WXML 引用：`miniprogram/pages/index/index.wxml` 内的 `image.action-button-image`
- mode：`scaleToFill`
- 是否会裁切：不会。当前实现使用 `scaleToFill`，图片会按按钮盒子直接铺满。
- 是否包含文字：否

### 实际显示约束

- 按钮节点仍为原生 `button`
- 事件仍为 `bindtap="goToExplore"`
- 文字仍为 `寻找传说`
- 按钮宽度约束：
  - `.page` 水平内边距为 `32rpx + 32rpx`
  - 小程序页面逻辑宽度为 `750rpx`
  - `750rpx - 64rpx = 686rpx`
  - `.panel` 水平内边距为 `32rpx + 32rpx`
  - `.panel` 左右边框共 `2rpx`
  - 当前按钮所在内容宽度为 `686rpx - 64rpx - 2rpx = 620rpx`
  - `.action-button` 为 `width: 100%`，因此当前按钮图片显示宽度跟随 `620rpx` 内容宽度
- 按钮高度约束：
  - `miniprogram/app.wxss` 中 `.action-button` 声明 `min-height: 96rpx`
  - 源码未声明固定 `height`，当前应按“最小高度 96rpx”理解

### 建议制作尺寸

- 当前占位图文件尺寸：`1240 x 192 px`
- 计算依据：按当前按钮显示盒子的 `620rpx : 96rpx` 比例输出 2x PNG
- 该素材显示宽度由父节点和页面 rpx 布局决定，不能用单个固定 CSS px 表示。
- 当前按钮高度的源码约束是 `min-height: 96rpx`，不是固定 CSS px 高度。

### 尺寸依据

- 来自源码的尺寸：
  - `miniprogram/app.wxss` 中 `.page { padding: 40rpx 32rpx ... }`
  - `miniprogram/app.wxss` 中 `.panel { padding: 34rpx 32rpx; border: 1rpx solid ... }`
  - `miniprogram/app.wxss` 中 `.action-button { width: 100%; min-height: 96rpx; padding: 0 32rpx; box-sizing: border-box; }`
- 响应式尺寸：
  - 按钮在设备上的 CSS px 宽度会随 viewport 变化
  - 按钮图片应继续跟随按钮盒子宽度，不应写成固定 px

## 3. 后续替换方式

- 直接替换图片文件内容、保持原路径和原文件名：
  - 不需要修改 WXML
  - 不需要修改 WXSS
- 更换图片文件名或目录：
  - 需要修改对应 `image` 节点的 `src`
  - 不需要修改 WXSS，前提是新图继续遵守当前显示约束

## 4. 本轮实现边界

- 未修改 `miniprogram/pages/index/index.js`
- 未修改任何云函数、AI 逻辑、service 层或数据库逻辑
- 未修改推荐 Banner 业务逻辑
- 未修改 tabBar 配置
- 未修改 `goToExplore` 事件函数名
- 未修改原有 `data-design-id`
