更新要求：保持 15 秒 ROI 倒计时不变，仅消除双请求问题，并加入 Shift 步长 5。

实施：
- DataTable.vue：`onWheelRoi(row, e)` 步长为：Ctrl=0.1、Shift=5，否则=1；保留两位小数与最小值 0。
- CountdownService：不改周期；新增 `refreshRoiNow()` 可选（加锁执行一次 ROI 拉取但不改 `nextRoiAt`），用于 `update_roi` 成功后立即刷新一次，避免与 `_tick()` 重叠导致双次。
- IPC 路由：在 `update_roi` 成功后调用 `await cdSvc.refreshRoiNow()` 替代手动拉取，移除前端重复请求（此前已移除），保证只推送一次。

验证：
- 修改 ROI 后只显示一次 ROI 成功提示；倒计时仍为 15 秒。
- 滚轮步长按键生效，数值两位小数、最小 0。