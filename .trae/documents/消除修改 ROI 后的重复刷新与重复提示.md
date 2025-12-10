## 原因
- 在主进程 `update_roi` 成功后，路由层已经主动刷新并推送一次 `roi_data`。
- 前端 `useWebSocket.js` 的 `update_roi_result` 事件处理里又调用了一次 `sendMessage('get_all_roi_data')`，导致两次 ROI 成功提示。

## 修复
- 删除前端的重复请求，保留主进程的那一次刷新：
  - 修改 `src/renderer/src/composables/useWebSocket.js` 的 `update_roi_result` 处理器，移除 `sendMessage('get_all_roi_data')`。
  - 保留错误分支的提示与 `setLoading(false)`；成功分支交由服务端推送的 `roi_data` 事件来关闭 loading 和提示成功。

## 验证
- 点击“修改 ROI”后，只出现一次“ROI数据刷新成功”提示。
- ROI 倒计时已重置为 2 分钟（此前已实现），下一次自动刷新在 2 分钟后触发。
