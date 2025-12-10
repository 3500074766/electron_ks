1. **修改DataTable.vue组件**：
   - 将@wheel事件从包含输入框的div移到ElInput组件上
   - 移除onWheelRoi函数中对ctrlKey和shiftKey的检查，固定步长为1
   - 确保只有当输入框聚焦时才处理滚轮事件

2. **修改onWheelRoi函数**：
   - 移除第127行的步长计算逻辑，固定步长为1
   - 简化滚轮事件处理，只根据滚轮方向调整ROI值

3. **测试修复效果**：
   - 确保只有输入框聚焦时才能通过滚轮修改ROI
   - 确保滚轮修改时不区分ctrlKey和shiftKey
   - 确保滚轮修改功能正常工作