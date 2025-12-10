原因：ROI 修改是通过渲染层的 socket 向后端服务发送，主进程的倒计时服务并不知道修改事件，因此没有把 ROI 倒计时重置为 15 秒。我们之前把重置逻辑写在主进程的 IPC `update_roi` 成功回调里，但渲染层没有走该 IPC 通道，所以不会触发重置。

修复方案：在主进程提供一个显式的倒计时重置入口，并在渲染层收到 `update_roi_result` 成功事件后调用它。

具体改动：
- 主进程 `routes.js`：新增 IPC 处理器 `reset_roi_countdown`，调用 `cdSvc.resetRoi(15)` 并广播 `countdown_tick`。
- 预加载 `preload/index.js`：暴露 `resetRoiCountdown: () => ipcRenderer.invoke('reset_roi_countdown')`。
- 渲染层 `useWebSocket.js`：在 `update_roi_result` 成功分支中，清理输入值后调用 `window.api.resetRoiCountdown()`；不再自行修改本地倒计时，避免闪动。

验证：
- 修改 ROI 成功后，立即只请求一次 ROI 数据；倒计时从 15 秒开始递减，且不出现旧剩余值回跳。