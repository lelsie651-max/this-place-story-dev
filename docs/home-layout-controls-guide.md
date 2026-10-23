# 首页布局调整使用说明

这次结构准备完成后，你以后只需要做两件事：

1. 用自己的 PNG 覆盖指定占位图片。
2. 只在 `miniprogram/pages/index/index.wxss` 顶部“首页布局调整区”里修改已经写好的数字。

不要去改 selector、花括号、事件名、WXML 结构和 JS 逻辑。

## 1. 如何进入首页布局调整区

1. 打开项目目录里的 `miniprogram/pages/index/index.wxss`
2. 直接看文件最顶部
3. 找到这一段大注释：

`首页布局调整区`

从这段注释开始，到下面第一批首页样式结束，都是以后可以手动调数字的位置。

## 2. 哪个数字控制背景图

看这一段：

` .page.page--embedded-branding .home-background-image `

这里可以改：

- `top`：背景图上下位置
- `left`：背景图左右位置
- `width`：背景图宽度
- `height`：背景图高度
- `translateX(...)`：背景图左右移动
- `translateY(...)`：背景图上下移动
- `scale(...)`：背景图缩放

方向说明：

- `translateY(40rpx)`：向下 40rpx
- `translateY(-40rpx)`：向上 40rpx
- `translateX(40rpx)`：向右 40rpx
- `translateX(-40rpx)`：向左 40rpx

## 3. 哪个数字控制“寻找传说”区域

看这一段：

- `.page.page--embedded-branding .home-primary-entry-slot`
- `.page.page--embedded-branding .primary-entry`

这里可以改：

- `width`：整个“寻找传说”外层区域宽度
- `min-height`：整个区域最小高度
- `margin-top`：与上方内容的间距
- `margin-bottom`：与下方内容的间距
- `translateX(...)`：整体左右移动
- `translateY(...)`：整体上下移动

## 4. 哪个数字控制“寻找传说”按钮

看这一段：

`.page.page--embedded-branding .primary-entry .action-button--image`

这里可以改：

- `width`：按钮宽度
- `min-height`：按钮高度
- `translateX(...)`：按钮左右移动
- `translateY(...)`：按钮上下移动

## 5. 哪个数字控制编辑推荐外框

看这一段：

- `.page.page--embedded-branding .home-recommendation-slot`
- `.page.page--embedded-branding .recommendation-section`

这里可以改：

- `width`：编辑推荐外层宽度
- `min-height`：编辑推荐外层最小高度
- `margin-top`：和“寻找传说”区域的间距
- `margin-bottom`：和页脚之间的间距
- `translateX(...)`：整体左右移动
- `translateY(...)`：整体上下移动

## 6. 哪个数字控制推荐内部卡片

看这一段：

- `.page.page--embedded-branding .recommendation-card`
- `.page.page--embedded-branding .recommendation-cover`
- `.page.page--embedded-branding .recommendation-body`

这里可以改：

- `recommendation-card` 的 `width`：卡片整体宽度
- `recommendation-card` 的 `height`：卡片整体高度
- `recommendation-cover` 的 `width`：左侧封面宽度
- `recommendation-body` 的 `width`：右侧文字区域宽度

如果你改了左侧封面宽度，通常也要一起改右侧文字区域宽度。

## 7. 哪个数字控制推荐卡片内部文字

看这些 selector：

- `.page.page--embedded-branding .recommendation-card-title`
- `.page.page--embedded-branding .recommendation-card-location`
- `.page.page--embedded-branding .recommendation-card-summary`
- `.page.page--embedded-branding .recommendation-card-action`

这里可以改：

- `margin-top`：和上一行的间距
- `translateY(...)`：当前文字块上下位置

对应关系：

- `recommendation-card-title`：标题位置
- `recommendation-card-location`：地点位置
- `recommendation-card-summary`：简介位置
- `recommendation-card-action`：免费阅读文案位置

## 8. 如何隐藏整个区域

如果你想临时隐藏“寻找传说”区域：

1. 找到 `.page.page--embedded-branding .home-primary-entry-slot`
2. 把 `width` 改小到接近 `0rpx`
3. 把 `min-height` 改成 `0rpx`
4. 把 `margin-top` / `margin-bottom` 改成 `0rpx`

如果你想临时隐藏“编辑推荐”区域：

1. 找到 `.page.page--embedded-branding .home-recommendation-slot`
2. 把 `width` 改小到接近 `0rpx`
3. 把 `min-height` 改成 `0rpx`
4. 把 `margin-top` / `margin-bottom` 改成 `0rpx`

## 9. 如何恢复显示

把上面改小的数字改回原来的默认值即可。

如果你把首页背景图里已经内嵌的 Logo 模式取消，想恢复 WXML 里的旧标题文字：

1. 打开 `miniprogram/pages/index/index.wxml`
2. 找到根节点：
   - `class="page page--embedded-branding"`
3. 把它改回：
   - `class="page"`

这样 `.hero-title`、`.hero-english`、`.hero-slogan` 就会重新显示。

## 10. 如何只去掉旧白色背景但保留功能

本轮已经把这些功能区改成了“图片底层 + 内容层”结构：

- 寻找传说外层卡片
- 寻找传说按钮
- 编辑推荐外层卡片
- 编辑推荐内部卡片
- 推荐封面占位图

以后你只需要替换 PNG，不需要改事件。

## 11. 以后只需要替换哪些 PNG

首页背景图：

- `miniprogram/assets/backgrounds/home-background-placeholder.png`

寻找传说外层卡片：

- `miniprogram/assets/cards/home-primary-entry-panel-placeholder.png`

寻找传说按钮：

- `miniprogram/assets/buttons/home-primary-button-placeholder.png`

编辑推荐外层卡片：

- `miniprogram/assets/cards/home-recommendation-panel-placeholder.png`

编辑推荐内部卡片：

- `miniprogram/assets/cards/home-recommendation-card-placeholder.png`

推荐封面占位图：

- `miniprogram/assets/banners/home-recommendation-cover-placeholder.png`

TabBar 图标：

- `miniprogram/assets/tabbar/home.png`
- `miniprogram/assets/tabbar/home-active.png`
- `miniprogram/assets/tabbar/atlas.png`
- `miniprogram/assets/tabbar/atlas-active.png`
- `miniprogram/assets/tabbar/publish.png`
- `miniprogram/assets/tabbar/publish-active.png`
- `miniprogram/assets/tabbar/profile.png`
- `miniprogram/assets/tabbar/profile-active.png`

注意：

- 图片里不要放 TabBar 文字
- TabBar 文字还是原生显示
- 不要改文件名
- 直接覆盖同名 PNG 即可

## 12. 替换 PNG 后怎么重新编译

1. 回到微信开发者工具
2. 等资源刷新；如果没有自动刷新，就点击“编译”
3. 查看首页和底部 TabBar 是否更新
4. 如果图片没刷新，先保存 PNG，再重新点击“编译”

## 13. 你以后只要记住这两件事

1. 换图：覆盖指定 PNG
2. 调位置：只改 `index.wxss` 顶部“首页布局调整区”里的数字
