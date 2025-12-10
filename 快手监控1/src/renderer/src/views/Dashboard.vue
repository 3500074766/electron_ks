<template>
  <div class="dashboard">
    <!-- 顶部控制栏：卡片式设计 -->
    <el-card shadow="never" class="control-panel">
      <div class="control-row">
        <div class="left-actions">
          <el-button type="primary" :loading="store.loading" icon="Refresh" @click="handleRefresh">
            立即刷新
          </el-button>
          <el-button type="success" plain :loading="store.loading" icon="Money" @click="handleRoiRefresh">
            仅刷新 ROI
          </el-button>

          <el-divider direction="vertical" />

          <div class="setting-item">
            <span class="label">刷新间隔</span>
            <el-input-number v-model="refreshInterval" :min="1" :max="60" size="default" @change="handleIntervalChange"
              style="width: 100px" />
            <span class="unit">分钟</span>
          </div>

          <div class="setting-item">
            <span class="label">消耗预警</span>
            <div class="range-inputs">
              <el-input v-model="store.minConsumption" placeholder="Min" size="default" style="width: 70px" />
              <span class="separator">-</span>
              <el-input v-model="store.maxConsumption" placeholder="Max" size="default" style="width: 70px" />
            </div>
          </div>
        </div>

        <div class="right-info">
          <el-tooltip content="数据自动倒计时" placement="top">
            <div class="countdown-badge">
              <el-icon>
                <Timer />
              </el-icon>
              <span>数据: {{ formatTime(kuaishouCountdown) }}</span>
              <el-divider direction="vertical" />
              <span>ROI: {{ formatTime(roiCountdown) }}</span>
            </div>
          </el-tooltip>
          <div class="last-update">最后更新: {{ store.lastUpdateTime || '--:--:--' }}</div>
        </div>
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card" :body-style="{ padding: '0', height: '100%' }">
      <el-table :data="store.tableData" style="width: 100%; height: 100%" v-loading="store.loading" height="100%" stripe
        highlight-current-row>
        <el-table-column label="用户" width="180" fixed="left">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="32" :src="formatUrl(row.头像)" shape="circle" />
              <span class="username" :title="row.名称">{{ row.名称 }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="GMV" label="GMV" align="right" sortable min-width="100">
          <template #default="{ row }">
            <span class="money-text">¥{{ row.GMV }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="花费" label="花费" align="right" sortable min-width="100" />

        <el-table-column prop="消耗" label="实时消耗" align="center" sortable min-width="100">
          <template #default="{ row }">
            <el-tag :type="getConsumptionTagType(row.消耗)" effect="light">
              {{ row.消耗 }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="上次花费" label="上次花费" align="right" min-width="100" class-name="text-secondary" />
        <el-table-column prop="订单数" label="订单数" align="center" sortable min-width="90" />
        <el-table-column prop="全站ROI" label="全站 ROI" align="center" sortable min-width="100" />

        <el-table-column prop="roi" label="当前 ROI" align="center" sortable min-width="100">
          <template #default="{ row }">
            <span style="font-weight: bold;">{{ row.roi }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #header>
            <span>调整 ROI</span>
          </template>
          <template #default="{ row }">
            <div class="roi-action">
              <el-input v-model="row.newRoi" size="small" placeholder="新值" style="width: 70px"
                @keyup.enter="handleUpdateRoi(row)" />
              <el-button type="primary" link size="small" @click="handleUpdateRoi(row)">
                确定
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useDataStore } from '../stores/dataStore'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useDataStore()
const refreshInterval = ref(10)
const kuaishouCountdown = ref(0)
const roiCountdown = ref(0)

// 格式化辅助函数
const formatUrl = (url) => {
  if (!url) return ''
  return url.startsWith('http') ? url : `https://${url}`
}

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const getConsumptionTagType = (val) => {
  const v = Number(val)
  if (isNaN(v)) return 'info'
  if (v < store.minConsumption) return 'success' // 低消耗，绿色
  if (v > store.maxConsumption) return 'danger' // 高消耗，红色
  return 'warning' // 正常
}

// 核心业务逻辑
const handleRefresh = async () => {
  store.setLoading(true)
  try {
    await window.api.refreshData()
    ElMessage.success('刷新指令已发送')
  } catch (e) {
    ElMessage.error('刷新失败')
    store.setLoading(false)
  }
}

const handleRoiRefresh = async () => {
  store.setLoading(true)
  try {
    await window.api.refreshRoiNow() // 假设后端暴露了这个直接接口
    ElMessage.success('ROI 刷新指令已发送')
  } catch (e) {
    store.setLoading(false)
  }
}

const handleIntervalChange = (val) => {
  window.api.updateInterval(val)
  ElMessage.success(`刷新间隔已更新为 ${val} 分钟`)
}

const handleUpdateRoi = async (row) => {
  if (!row.newRoi) return
  const val = Number(row.newRoi)
  if (isNaN(val)) return ElMessage.warning('请输入有效数字')

  // 简单的防呆检查
  if (Math.abs(val - row.roi) > 5) {
    try {
      await ElMessageBox.confirm(`新 ROI (${val}) 与当前值差异较大，确定修改吗？`, '安全警告', {
        confirmButtonText: '确定修改',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
  }

  try {
    store.setLoading(true)
    await window.api.updateRoi({ uid: row.UID, target_id: row.target_id, roi_ratio: val })
    row.newRoi = '' // 清空输入
    ElMessage.success('ROI 修改成功，正在刷新数据...')
  } catch (e) {
    ElMessage.error(e.message || '修改失败')
    store.setLoading(false)
  }
}

// 监听后端 IPC 消息
const setupIpcListeners = () => {
  // 倒计时和状态同步
  window.api.on('countdown_tick', (data) => {
    if (data.remaining) {
      kuaishouCountdown.value = data.remaining.kuaishou
      roiCountdown.value = data.remaining.roi
    }
    if (data.intervalMinutes) {
      refreshInterval.value = data.intervalMinutes
    }
  })

  // 数据更新监听 (合并了原本复杂的 socket 逻辑)
  const handleDataUpdate = (type, payload) => {
    if (payload.status === 'success') {
      store.mergeData(payload.data, type)
      store.setLoading(false)
    } else if (payload.status === 'error') {
      console.error(payload.message)
      store.setLoading(false)
    }
  }

  window.api.on('kuaishou_data', (p) => handleDataUpdate('kuaishou', p))
  window.api.on('roi_data', (p) => handleDataUpdate('roi', p))
  window.api.on('users_data', (p) => handleDataUpdate('users', p))
  window.api.on('update_roi_result', (p) => {
    if (p.status === 'success') handleRoiRefresh() // 修改成功后自动刷新
    else {
      ElMessage.error(p.message)
      store.setLoading(false)
    }
  })
}

onMounted(() => {
  setupIpcListeners()
  // 初始化获取状态
  window.api.getCountdownState()
  // 首次拉取数据
  window.api.getAllKuaishouData()
})
</script>

<style scoped>
.dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-panel {
  border-radius: 8px;
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.left-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.right-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.countdown-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ecf5ff;
  color: #409eff;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.last-update {
  font-size: 12px;
  color: #909399;
}

.table-card {
  flex: 1;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.username {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.money-text {
  font-family: Consolas, monospace;
  font-weight: 600;
}

.roi-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.text-secondary {
  color: #909399;
}
</style>
