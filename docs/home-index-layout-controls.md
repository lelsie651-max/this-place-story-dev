# 首页嵌入品牌模式与布局调整说明

> 当前请优先使用 `docs/home-layout-controls-guide.md`。
> 那份文档已经整理成“只换 PNG、只改数字”的最终使用说明。

## 1. 当前模式

- 首页根节点当前为：`class="page page--embedded-branding"`
- 该模式用于“品牌文字已经内嵌在背景图中”的首页背景素材

## 2. 如何恢复普通文字模式

- 打开 `miniprogram/pages/index/index.wxml`
- 将根节点类名从：
  - `page page--embedded-branding`
- 改回：
  - `page`

恢复后，以下节点会重新显示：

- `.hero-title`
- `.hero-english`
- `.hero-slogan`

## 3. 首页素材调整区位置

- 文件：`miniprogram/pages/index/index.wxss`
- 位置：文件顶部的“首页素材调整区”注释块下方

## 4. 背景图调整

- 调整 selector：
  - `.page.page--embedded-branding .home-background-image`
- 可改属性：
  - `top`
  - `left`
  - `width`
  - `height`
  - `transform`
  - `transform-origin`
- 当前图片 mode：
  - `aspectFill`
- 方向规则：
  - `translateX` 正值向右，负值向左
  - `translateY` 正值向下，负值向上
- 裁切说明：
  - 背景图位于 `.home-background-layer` 中，容器为 `width: 100%; height: 100vh; overflow: hidden;`
  - 图片移动或缩放后，超出可视区域的部分会被裁切

## 5. 主按钮位置调整

- 调整 selector：
  - `.page.page--embedded-branding .home-primary-entry-slot`
  - `.page.page--embedded-branding .primary-entry`
  - `.page.page--embedded-branding .primary-entry .action-button--image`
- 可改属性：
  - `margin-top`
  - `margin-left`
  - `margin-right`
  - `transform`
  - `width`
  - `min-height`
- 当前事件：
  - `bindtap="goToExplore"`
- 说明：
  - 推荐优先通过 `.home-primary-entry-slot` 调整整体位置
  - 通过 `.primary-entry` 控制外层卡片宽度
  - 通过 `.action-button--image` 控制按钮最小高度

## 6. 编辑推荐区域位置调整

- 调整 selector：
  - `.page.page--embedded-branding .home-recommendation-slot`
  - `.page.page--embedded-branding .recommendation-section`
- 可改属性：
  - `margin-top`
  - `margin-left`
  - `margin-right`
  - `transform`
  - `width`
- 当前事件：
  - 推荐卡片点击仍为 `goToRecommendation`

## 7. 文字隐藏规则

- 仅在 `.page--embedded-branding` 模式下生效
- 使用的 CSS selector：
  - `.page--embedded-branding .hero-title`
  - `.page--embedded-branding .hero-english`
  - `.page--embedded-branding .hero-slogan`
- 使用的隐藏方式：
  - `display: none`

## 8. 注意事项

- 不要修改：
  - `miniprogram/pages/index/index.js`
  - `goToExplore`
  - `goToRecommendation`
  - `miniprogram/assets/backgrounds/home-background-placeholder.png`
- 当前首页背景图路径保持不变：
  - `../../assets/backgrounds/home-background-placeholder.png`
- 当前首页按钮图路径保持不变：
  - `../../assets/buttons/home-primary-button-placeholder.png`
