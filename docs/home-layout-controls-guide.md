# 首页布局调整使用说明

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
