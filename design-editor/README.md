# 此地有传说 UI 设计编辑器

这个编辑器独立运行在 `design-editor/`，用于调整《此地有传说》小程序的视觉层。

它遵守当前边界：

- 不修改业务 JS、服务层、云函数、AI、数据库和审核逻辑
- 未点击“应用到小程序”前，不会改动 `miniprogram/`
- 只把可安全落成 WXSS 设计覆盖层的属性自动应用到小程序
- 仅预览或不支持的属性会明确标记，不会伪装成已经生效

## 1. 安装与启动

在项目根目录执行：

```powershell
cd "d:\this-place-story-dev\design-editor"
npm.cmd ci
npm.cmd run dev
```

默认会启动本地 Vite 开发服务。请直接在浏览器打开终端里显示的本地地址。

## 2. 构建

```powershell
cd "d:\this-place-story-dev\design-editor"
npm.cmd run build
```

构建产物会输出到：

- `design-editor/dist/`

`dist/` 和 `node_modules/` 已加入忽略规则，不提交到 Git。

## 3. 如何编辑

1. 左侧选择页面。
2. 在组件树中选择要调整的组件，组件名会同时显示中文名和 `designId`。
3. 中间设备预览区会高亮当前组件。
4. 右侧属性面板按“文字 / 背景 / 尺寸和间距 / 按钮和卡片 / 图片和 Banner”分组展示属性。
5. 每个属性都有状态标记：
   - `可应用`：当前可安全生成到小程序设计覆盖层
   - `仅预览`：编辑器能实时预览，但暂时不会自动写回小程序源码
   - `不支持`：当前不支持自动生成，也不会伪装成生效

当前支持：

- 设备宽度切换：`375 / 390 / 414`
- 页面切换：首页、个人中心、足迹、寻找传说、地点详情、故事详情、投稿、我的投稿、投稿预览、投稿编辑
- 组件树选中与预览高亮
- 颜色、字号、圆角等实时预览
- 图片上传并保存到 `design-editor/resources/uploads/`
- 撤销 / 重做
- 恢复当前组件默认值
- 恢复当前页面默认值
- 恢复全部默认设计
- 未保存修改提示

## 4. 导出设计

点击顶部“导出设计”后，会输出：

- `design/export/design-tokens.json`
- `design/export/page-overrides.json`
- `design/export/asset-manifest.json`
- `design/export/design-preview.json`
- `design/export/README.md`

导出内容包含：

- 页面
- `designId`
- 修改前值
- 修改后值
- 修改时间
- 资源引用
- 当前支持状态
- 无法自动应用的原因

## 5. 应用到小程序

点击“应用到小程序”时，编辑器会先展示应用前预览，包括：

- 设计差异列表
- 修改页面列表
- 修改组件列表
- 修改属性列表
- 预计生成的 WXSS 文件
- 预计修改的 WXSS 文件
- 不能自动应用的属性统计

确认后，本地脚本会执行：

1. 备份当前相关 WXSS / 设计覆盖文件
2. 为有安全选择器的页面生成 `design-overrides.wxss`
3. 在对应页面 `*.wxss` 中按需注入 `@import "./design-overrides.wxss";`
4. 输出本次实际修改文件清单
5. 输出仅预览和不支持的属性清单

当前应用范围说明：

- 优先写入独立 WXSS 设计覆盖层
- 当前不会修改页面 JS
- 当前不会修改云函数、服务层、AI 文件
- 当前不会把页面改成绝对定位
- 当前不会依赖动态 `storyId`、`locationId` 作为组件定位方式

## 6. 当前能力边界

### 可安全应用到小程序

主要是：

- 字体大小
- 字体颜色
- 字重
- 行高
- 字间距
- 对齐方式
- 背景颜色 / 渐变
- margin / padding
- 圆角
- 边框宽度 / 颜色
- 阴影
- 按钮背景 / 文字 / 高度
- 卡片背景 / 边框 / 阴影

前提是该组件已经有稳定的可写 WXSS 选择器。

### 编辑器可预览，但暂时不能自动应用

主要是：

- 文案
- 字体栈
- 背景图片
- 背景图片位置 / 显示方式
- 图片替换
- 图片宽高
- 图片圆角
- `object-fit`
- Banner 比例
- 部分只存在于 `data-design-id` 节点但尚未建立稳定 WXSS 选择器的属性

### 当前不支持

主要是：

- 任意拖拽定位
- 基于动态业务数据定位组件
- 自动安装外部自定义字体

## 7. 回滚与恢复

应用到小程序时会自动写备份到：

- `design-editor/resources/backups/时间戳/`

如果在编辑器里执行“恢复全部默认设计”并再次点击“应用到小程序”，会：

- 清空当前设计覆盖层
- 删除不再需要的 `design-overrides.wxss`
- 从页面 `*.wxss` 中移除对应 `@import`

这样可以恢复到原始视觉基线。

## 8. 校验命令

本轮实现建议至少执行：

```powershell
node --check "d:\this-place-story-dev\design-editor\src\main.js"
node "d:\this-place-story-dev\design-editor\local_validate.js"
cd "d:\this-place-story-dev\design-editor"
npm.cmd ci
npm.cmd run build
```

## 9. 注意事项

- 本编辑器默认以静态示例数据预览，不接 CloudBase，也不需要登录。
- 如果浏览器内的“导出设计 / 应用到小程序 / 上传图片”按钮不可用，请确认你是通过 `npm.cmd run dev` 启动的本地服务访问页面。
- `design/export/` 是导出结果目录，默认不会因为构建或依赖安装而进入 Git。
