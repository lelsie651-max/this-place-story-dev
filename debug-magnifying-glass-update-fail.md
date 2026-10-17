# Debug Session: magnifying-glass-update-fail
- **Status**: [OPEN]
- **progress_status**: collecting
- **Issue**: 真机测试临时微信地点时，探索成功后前端提示“放大镜状态更新失败，请稍后再试”，需要定位 consumeMagnifyingGlass 的真实失败原因，并确认 prepare/consume/release 契约、临时地点 locationKey 与 CloudBase 集合/部署状态。
- **Evidence Source**: Existing CloudBase function logs / local command outputs
- **Evidence Directory**: C:\Users\1\AppData\Local\Temp\this-place-story-dev-debug\magnifying-glass-update-fail
- **Debug Server**: N/A
- **Log File**: N/A

## Reproduction Steps
1. 在真机上通过 `wx.chooseLocation` 选择一个未命中正式 `locations` 的临时微信地点。
2. 进入 `pages/location/location`。
3. 点击 `民间传说` 或 `AI说`。
4. 观察前端 Toast、云函数返回、CloudBase 日志与数据库变化。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 临时地点 `locationKey` 生成不稳定或为空，导致 `prepare/consume/release` 其中一步参数无效 | High | Low | Pending |
| B | `prepare` 成功但 `consume` 使用了不同参数或缺少统一 `reservationId/requestId`，导致服务端无法命中同一预留记录 | High | Medium | Pending |
| C | `magnifying_glass_usage_daily` 或 `users` 集合缺失、字段异常、环境错误，导致事务写入失败 | High | Low | Pending |
| D | `consumeMagnifyingGlass` 云函数当前部署版本与前端契约不一致，真机实际调到旧版本 | Medium | Medium | Pending |
| E | `consumeMagnifyingGlass` 事务或锁释放路径在临时地点分支触发数据库异常，前端只显示了泛化 Toast | Medium | Medium | Pending |

## Log Evidence
- 2026-10-17: Added instrumentation only, no business-logic changes yet.
- Instrumented files:
  - `cloudfunctions/consumeMagnifyingGlass/index.js`
  - `miniprogram/services/userService.js`
  - `miniprogram/pages/location/location.js`
- Added evidence points:
  - client request/response summary for `wx.cloud.callFunction`
  - location page prepare/consume/release lifecycle summaries
  - cloud function action entry, transaction stage, collection names, and sanitized error object

## Verification Conclusion
- Static evidence before runtime reproduction:
  - The exact user-facing message `放大镜状态更新失败，请稍后再试` currently maps to the generic `DATABASE_ERROR` wrapper in `prepareUsage()`.
  - The current contract uses `requestId + locationKey + storyType`, not `reservationId`.
  - Temporary-place `locationKey` is generated only on the client and is opaque to the cloud function.

## Final Evidence Gate
- **Evidence Sources**: CloudBase deployed function metadata, CloudBase function logs, local code audit, git state
- **progress_status**: collecting
- **Hypothesis Conclusions**: A=Pending, B=Pending, C=Pending, D=Pending, E=Pending
