# 开发测试工具说明

## 1. 文档目的

本文档用于冻结 Sprint 15-A 新增的“开发测试工具”边界。

该工具的目标只有一个：

- 提高开发版 / 体验版真机测试时，恢复放大镜与探索状态的效率

它不是正式产品功能，不属于用户可见能力。

---

## 2. 使用范围

当前只允许以下环境显示入口：

- `develop`
- `trial`

当前明确禁止：

- `release` 环境显示入口
- 正式用户使用该工具
- 把该工具作为正式额度规则的一部分

前端环境判断使用微信官方环境信息：

- `wx.getAccountInfoSync().miniProgram.envVersion`

---

## 3. 入口位置

当前入口位于：

- `pages/profile/profile`

入口文案固定为：

```text
开发测试工具
```

显示条件必须同时满足：

1. 当前小程序环境为 `develop` 或 `trial`
2. 用户主动进入 `pages/devTestTools/devTestTools`
3. 在页面中输入正确的开发测试口令并通过服务端验证

---

## 4. 服务端安全约束

当前使用独立云函数：

- `devTestControls`

服务端必须执行以下校验：

1. `ENABLE_DEV_TEST_TOOLS` 环境变量为 `true`
2. `DEV_TEST_ADMIN_TOKEN` 环境变量为管理员配置的随机长字符串
3. 当前用户身份来自 `wx.cloud.getWXContext().OPENID`
4. 请求必须携带 `devTestToken`
5. `devTestToken` 必须与 `DEV_TEST_ADMIN_TOKEN` 完全一致
6. `action` 必须在白名单中
7. 所有数值参数必须是有限非负整数
8. `dailyTotalCount` 只允许 `0 ~ 10`
9. `locationTypeCount` 只允许 `0 ~ 3`
10. 不接受前端传入 `openid`

这里的 `OPENID` 只用于定位“当前要修改哪一个测试用户”的数据，不再用于管理员鉴权。

正式环境关闭开关时，统一返回：

```json
{
  "ok": false,
  "error": {
    "code": "DEV_TOOLS_DISABLED",
    "message": "开发测试工具未开启"
  }
}
```

管理员 `OPENID` 和开关都只能保存在云函数环境变量中，不得写入小程序前端。
当前已改为：

- 开关保存在云函数环境变量
- 开发测试口令保存在云函数环境变量
- 管理员在小程序端手动输入口令后，使用 `wx.setStorageSync` 只保存在当前设备本地

口令错误或缺失时，统一返回：

```json
{
  "ok": false,
  "error": {
    "code": "DEV_TOOLS_FORBIDDEN",
    "message": "开发测试工具口令不正确"
  }
}
```

---

## 5. 当前支持的测试控制

### 5.1 查看当前状态

返回结构至少包含：

```json
{
  "magnifyingGlass": 0,
  "dailyTotalCount": 0,
  "locationTypeCount": 0,
  "requestLockUntil": 0
}
```

### 5.2 设置放大镜余额

支持：

- 0
- 1
- 5
- 10
- 自定义非负整数

### 5.3 设置当天总成功次数

支持：

- 0
- 1
- 9
- 10
- 自定义 `0 ~ 10`

### 5.4 设置或清空地点 + 标签次数

支持：

- 设置指定 `locationKey + storyType` 的次数
- 清空指定 `locationKey + storyType` 的次数
- 清空全部地点标签计数

### 5.5 清除请求锁

会清空：

- `activeRequestId`
- `activeLocationKey`
- `activeStoryType`
- `requestLockUntil`

### 5.6 一键重置今日探索测试状态

会执行：

- 放大镜余额设置为输入值
- `totalCount = 0`
- `locationTypeCounts = {}`
- `recentRequestIds = []`
- 请求锁字段清空

---

## 6. 不变的正式业务规则

开发测试工具不会改变以下正式判断：

- 每日最多 `10` 次
- 同地点同标签最多 `3` 次
- 放大镜余额不足时的拦截
- `prepare / consume / release` 事务链
- AI 失败不扣放大镜
- 广告奖励只增加余额，不增加每日探索次数上限

它只修改测试数据，不修改业务规则本身。

---

## 7. 部署要求

需要部署：

- `devTestControls`

正式环境上线前，应确认：

1. `ENABLE_DEV_TEST_TOOLS = false`
2. release 版本前端入口已隐藏
3. `DEV_TEST_ADMIN_TOKEN` 未写入前端代码或 Git 历史
