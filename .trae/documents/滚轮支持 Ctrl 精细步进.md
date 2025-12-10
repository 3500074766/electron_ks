目标：按住 Ctrl 时滚轮步长为 0.1；否则为 1。保持两位小数与下限 0。

实现：
- 更新 `src/renderer/src/components/DataTable.vue` 的 `onWheelRoi(row, e)`：
  - 检测 `e.ctrlKey`，步长 `step = e.ctrlKey ? 0.1 : 1`。
  - 其他逻辑保持：首次滚轮为空则初始化为实时 ROI；`ticks = max(1, round(abs(deltaY)/100))`；`row.newRoi = Number(v.toFixed(2))`；`v >= 0`。

验证：
- 普通滚轮每刻度加减 1。
- 按住 Ctrl 滚轮每刻度加减 0.1。
- 数值始终保留两位小数，且不低于 0。