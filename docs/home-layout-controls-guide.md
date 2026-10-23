# 首页布局调整使用说明

## 最新操作说明：先看这里

以后只需要打开：

`miniprogram/pages/index/index.wxss`

然后只改文件最顶部两个区域里的值：

- `首页显示/隐藏控制区`
- `首页布局调整区`

不要改 WXML，不要改 JS，不要改事件名。

## A. 如何隐藏和恢复首页标题

首页背景图已经包含品牌 logo 时，以下三项默认隐藏：

- `.page.page--embedded-branding .hero-title`：中文标题
- `.page.page--embedded-branding .hero-english`：英文标题
- `.page.page--embedded-branding .hero-slogan` / `.hero-subtitle` / `.hero-copy`：宣传语

隐藏：

```css
display: none;
```

恢复显示：

```css
display: block;
```

## B. 如何隐藏寻找传说区域里的 icon

放大镜 icon 对应：

`.page.page--embedded-branding .primary-entry-icon`

也可以使用同一个节点上的：

`.page.page--embedded-branding .primary-button-icon`

隐藏：

```css
display: none;
```

恢复：

```css
display: block;
```

## C. 如何保留按钮但隐藏按钮文字

“寻找传说”文字对应：

`.page.page--embedded-branding .primary-button-label`

隐藏文字：

```css
display: none;
```

恢复文字：

```css
display: inline;
```

这样只会隐藏文字，不会隐藏按钮背景，也不会影响 `goToExplore` 点击。

## D. 如何隐藏编辑推荐标题和副标题

“编辑推荐”标题对应：

`.page.page--embedded-branding .recommendation-heading`

隐藏：

```css
display: none;
```

恢复：

```css
display: block;
```

“先听一段传说，再决定要不要出发”副标题对应：

`.page.page--embedded-branding .recommendation-subtitle`

隐藏：

```css
display: none;
```

恢复：

```css
display: block;
```

这些开关不会影响 swiper、推荐卡片、推荐点击和动态数据。

## E. 如何隐藏“传说节选”icon 和文字

“传说节选”的图标对应：

`.page.page--embedded-branding .recommendation-cover-placeholder-icon`

“传说节选”的文字对应：

`.page.page--embedded-branding .recommendation-cover-placeholder-label`

隐藏：

```css
display: none;
```

恢复：

```css
display: block;
```

注意：这里控制的是没有动态封面图时的 fallback 内容。如果推荐数据有 `coverImage`，页面会优先显示动态封面图。

## F. 如何修改推荐卡片位置

推荐卡片对应：

`.page.page--embedded-branding .recommendation-card`

在 `transform` 里改数字：

```css
transform: translateX(0rpx) translateY(0rpx);
```

- `translateX(40rpx)`：向右移动 40rpx
- `translateX(-40rpx)`：向左移动 40rpx
- `translateY(200rpx)`：向下移动 200rpx
- `translateY(-40rpx)`：向上移动 40rpx

品牌图模式不再把卡片放进 swiper，所以不需要通过增加 swiper 高度来解决裁切。

品牌图模式请修改：

- `.home-recommendation-design-canvas`：设计画布位置和工作范围
- `.home-recommendation-panel`：外层编辑推荐框位置和宽高
- `.home-recommendation-card`：内部传说节选卡片位置和宽高

普通模式仍保留原生 swiper，推荐逻辑不变。

## G. 如何修改推荐卡片宽高

推荐卡片仍然改：

`.page.page--embedded-branding .recommendation-card`

可改：

- `width`：卡片宽度
- `height`：卡片高度
- `margin`：卡片在 swiper-item 里的位置
- `transform`：卡片移动

单位使用 `rpx`。

## H. 如何修改推荐封面宽高

推荐左侧封面对应：

`.page.page--embedded-branding .recommendation-cover`

这里要同步改三处：

```css
width: 220rpx;       /* 封面宽度 */
height: 312rpx;      /* 封面高度 */
flex: 0 0 220rpx;   /* 第三个数字必须和 width 一致 */
```

示例 1：横向矩形

```css
width: 320rpx;
height: 220rpx;
flex: 0 0 320rpx;
```

示例 2：正方形

```css
width: 220rpx;
height: 220rpx;
flex: 0 0 220rpx;
```

封面内部图片已经设置为：

```css
width: 100%;
height: 100%;
```

所以它会跟随封面大小变化。

## I. 每个 selector 对应哪个视觉元素

- `.hero-title`：首页中文标题
- `.hero-english`：首页英文标题
- `.hero-slogan` / `.hero-subtitle` / `.hero-copy`：首页宣传语
- `.primary-entry-panel-image`：寻找传说外框图片
- `.primary-entry-icon` / `.primary-button-icon`：放大镜 icon
- `.primary-button-image`：寻找传说按钮背景图
- `.primary-button-label`：寻找传说按钮文字
- `.recommendation-panel-image`：编辑推荐外框图片
- `.recommendation-heading`：编辑推荐标题
- `.recommendation-subtitle`：编辑推荐副标题
- `.home-recommendation-stage`：推荐区域可视舞台
- `.recommendation-swiper-wrap`：swiper 外层可视容器
- `.recommendation-swiper`：微信 swiper 组件
- `.recommendation-card`：推荐内部卡片
- `.recommendation-cover`：推荐左侧封面区域
- `.recommendation-cover-image`：动态封面图
- `.recommendation-cover-placeholder-icon`：无封面图时的“传说节选”图标
- `.recommendation-cover-placeholder-label`：无封面图时的“传说节选”文字
- `.recommendation-card-title`：推荐卡片标题
- `.recommendation-card-location`：推荐地点
- `.recommendation-card-summary`：推荐简介
- `.recommendation-card-action`：免费阅读文案

当前首页没有独立的 `.primary-entry-title`、`.primary-entry-description`、`.secondary-button-icon`、`.secondary-button-label` 节点。

## J. 占位图路径和替换规则

推荐封面占位图路径：

`miniprogram/assets/banners/home-recommendation-cover-placeholder.png`

WXML 引用路径：

`../../assets/banners/home-recommendation-cover-placeholder.png`

替换后不需要改 WXML。逻辑显示尺寸由 `.recommendation-cover` 控制。动态 `coverImage` 存在时优先显示动态图片；没有动态 `coverImage` 时，会显示本地占位图和 fallback 文案。

## K. 恢复默认值的方法

如果调乱了：

1. 打开 `miniprogram/pages/index/index.wxss`
2. 找到顶部“首页布局调整区”
3. 把你改过的数字改回注释旁边的原值
4. 点击微信开发者工具里的“编译”

显示/隐藏项也是一样：

- 隐藏用 `display: none`
- 恢复显示按注释改回 `display: block` 或 `display: inline`

---

这次修复后，首页的外框图片层和功能内容层已经拆开了。

你以后只需要做两件事：

1. 覆盖指定 PNG；
2. 只修改 `miniprogram/pages/index/index.wxss` 顶部“首页布局调整区”里的数字。

不要改事件名，不要改 WXML 结构，不要改 JS。

## 1. 如何进入首页布局调整区

1. 打开 `miniprogram/pages/index/index.wxss`
2. 直接看文件最顶部
3. 找到大注释：

`首页布局调整区`

从这里开始，下面那一组带中文注释的数字，就是以后手动调整首页的唯一入口。

## 2. 背景图怎么调

看这个 selector：

` .page.page--embedded-branding .home-background-image `

这里可以改：

- `top`：上下位置
- `left`：左右位置
- `width`：宽度
- `height`：高度
- `translateX(...)`：左右移动
- `translateY(...)`：上下移动
- `scale(...)`：缩放

方向说明：

- `translateX(40rpx)`：向右 40rpx
- `translateX(-40rpx)`：向左 40rpx
- `translateY(40rpx)`：向下 40rpx
- `translateY(-40rpx)`：向上 40rpx

## 3. 寻找传说外框图片怎么调

看这个 selector：

` .page.page--embedded-branding .home-primary-entry-panel-image `

这里控制的是“白色外框图片”，不是按钮内容。

这里可以改：

- `display`
- `width`
- `height`
- `top`
- `left`
- `transform`
- `transform-origin`

正确隐藏方式：

```css
.page.page--embedded-branding .home-primary-entry-panel-image {
  display: none;
}
```

恢复显示：

```css
.page.page--embedded-branding .home-primary-entry-panel-image {
  display: block;
}
```

重要：

- 不要把宽度直接设成 0
- 不要把最小高度直接设成 0
- 不要通过压缩父容器来隐藏外框

## 4. 寻找传说内容怎么调

看这个 selector：

` .page.page--embedded-branding .home-primary-entry-content `

这里控制的是内容层，里面有：

- 放大镜
- 按钮
- 按钮文字

这里可以改：

- `width`
- `margin-top`
- `margin-left`
- `transform`
- `padding`

外框图隐藏后，这一层仍然会保留，所以按钮不会消失，也不会被挤到右边。

## 5. 寻找传说按钮怎么调

看这个 selector：

` .page.page--embedded-branding .primary-entry .action-button--image `

这里可以改：

- `width`
- `min-height`
- `transform`
- `margin`

这里控制的是按钮本身，不会影响外框图片。

## 6. 寻找传说按钮内部元素怎么隐藏和恢复

按钮背景图：

- selector：`.page.page--embedded-branding .primary-button-image`
- 隐藏：把 `display: block;` 改成 `display: none;`
- 恢复：把 `display: none;` 改回 `display: block;`

放大镜 icon：

- selector：`.page.page--embedded-branding .primary-button-icon`
- 隐藏：把 `display: block;` 改成 `display: none;`
- 恢复：把 `display: none;` 改回 `display: block;`

“寻找传说”文字：

- selector：`.page.page--embedded-branding .primary-button-label`
- 隐藏：把 `display: inline;` 改成 `display: none;`
- 恢复：把 `display: none;` 改回 `display: inline;`

这些开关都在 `miniprogram/pages/index/index.wxss` 顶部“首页布局调整区”里。隐藏其中一个，不会删除按钮，也不会改 `goToExplore` 点击事件。

## 7. 编辑推荐外框图片怎么调

看这个 selector：

` .page.page--embedded-branding .recommendation-panel-image `

这里控制的是“编辑推荐外框图片”，不是推荐内容本身。

这里可以改：

- `display`
- `width`
- `height`
- `top`
- `left`
- `transform`

正确隐藏方式：

```css
.page.page--embedded-branding .recommendation-panel-image {
  display: none;
}
```

恢复显示：

```css
.page.page--embedded-branding .recommendation-panel-image {
  display: block;
}
```

隐藏这张图后：

- swiper 还在
- 推荐卡片还在
- 推荐点击事件还在
- 推荐文字还在

## 8. 编辑推荐标题和副标题怎么隐藏和恢复

“编辑推荐”标题：

- selector：`.page.page--embedded-branding .recommendation-heading`
- 隐藏：把 `display: block;` 改成 `display: none;`
- 恢复：把 `display: none;` 改回 `display: block;`

“先听一段传说，再决定要不要出发”副标题：

- selector：`.page.page--embedded-branding .recommendation-subtitle`
- 隐藏：把 `display: block;` 改成 `display: none;`
- 恢复：把 `display: none;` 改回 `display: block;`

这些开关只控制编辑推荐顶部两行文字，不会影响 swiper、推荐卡片、推荐卡片标题、推荐简介、免费阅读和 `goToRecommendation`。

## 9. 编辑推荐内容怎么调

看这个 selector：

` .page.page--embedded-branding .recommendation-panel-content `

这里可以改：

- `width`
- `margin-top`
- `margin-left`
- `transform`
- `padding`

这里控制的是：

- 编辑推荐标题
- 副标题
- swiper
- 推荐卡片内容

## 10. 推荐内部卡片怎么调

看这个 selector：

` .page.page--embedded-branding .recommendation-card `

这里可以改：

- `width`
- `height`
- `transform`
- `margin`

这控制的是整张推荐卡片。

## 11. 推荐左侧封面怎么调

看这个 selector：

` .page.page--embedded-branding .recommendation-cover `

这里可以改：

- `width`
- `height`
- `transform`

## 12. 推荐文字区域怎么调

看这个 selector：

` .page.page--embedded-branding .recommendation-body `

这里可以改：

- `width`
- `padding`
- `transform`
- `margin`

如果你只想调文字区域，不想动卡片外框，就改这里。

## 13. 推荐卡片内部文字位置怎么调

看这些 selector：

- `.page.page--embedded-branding .recommendation-card-title`
- `.page.page--embedded-branding .recommendation-card-location`
- `.page.page--embedded-branding .recommendation-card-summary`
- `.page.page--embedded-branding .recommendation-card-action`

这里可以改每一段文字自己的上下位置。

## 14. 如何恢复普通文字模式

如果以后不用“背景图已内嵌品牌文字”模式：

1. 打开 `miniprogram/pages/index/index.wxml`
2. 找到根节点：
   - `class="page page--embedded-branding"`
3. 改回：
   - `class="page"`

这样：

- `.hero-title`
- `.hero-english`
- `.hero-slogan`

就会重新显示。

## 15. 以后要替换哪些 PNG

- 背景图：
  - `miniprogram/assets/backgrounds/home-background-placeholder.png`
- 寻找传说外框图：
  - `miniprogram/assets/cards/home-primary-entry-panel-placeholder.png`
- 寻找传说按钮图：
  - `miniprogram/assets/buttons/home-primary-button-placeholder.png`
- 编辑推荐外框图：
  - `miniprogram/assets/cards/home-recommendation-panel-placeholder.png`
- 推荐内部卡片图：
  - `miniprogram/assets/cards/home-recommendation-card-placeholder.png`
- 推荐封面占位图：
  - `miniprogram/assets/banners/home-recommendation-cover-placeholder.png`

替换这些 PNG 只会改变外观，不会改变点击事件。

## 16. TabBar 图标对应关系

底部 TabBar 的文字仍然由小程序原生显示，PNG 里不要放文字。

首页：

- 未点击普通状态：`miniprogram/assets/tabbar/home.png`
- 点击后选中状态：`miniprogram/assets/tabbar/home-active.png`

足迹：

- 未点击普通状态：`miniprogram/assets/tabbar/atlas.png`
- 点击后选中状态：`miniprogram/assets/tabbar/atlas-active.png`

投稿：

- 未点击普通状态：`miniprogram/assets/tabbar/publish.png`
- 点击后选中状态：`miniprogram/assets/tabbar/publish-active.png`

我的：

- 未点击普通状态：`miniprogram/assets/tabbar/profile.png`
- 点击后选中状态：`miniprogram/assets/tabbar/profile-active.png`

你只需要覆盖这些 PNG，不需要修改 `app.json`。TabBar 顺序保持：首页 / 足迹 / 投稿 / 我的。

## 17. 替换 PNG 后怎么重新编译

1. 回到微信开发者工具
2. 点击“编译”
3. 看首页是否更新
4. 如果图片没有刷新，先保存 PNG，再重新点击“编译”

## 18. 以后记住这两件事

1. 换图：覆盖指定 PNG
2. 调位置：只改 `index.wxss` 顶部“首页布局调整区”里的数字
