import { defineStore } from 'pinia'

export const useDataStore = defineStore('data', {
  state: () => ({
    tableData: [],
    loading: false,
    lastUpdateTime: '',
    minConsumption: 0.5,
    maxConsumption: 2.0
  }),
  actions: {
    setLoading(val) {
      this.loading = val
    },
    // 简化的合并逻辑：直接基于 UID 更新或插入
    mergeData(newData, type) {
      if (!Array.isArray(newData) || newData.length === 0) return

      const now = new Date().toLocaleTimeString()

      // 创建映射以提高查找速度
      const map = new Map(this.tableData.map(item => [item.UID, item]))

      newData.forEach(item => {
        const uid = String(item.UID)
        if (!uid) return

        const existing = map.get(uid)
        if (existing) {
          // 更新现有数据
          Object.assign(existing, item)
        } else {
          // 新增数据
          const newItem = { ...item }
          map.set(uid, newItem)
          this.tableData.push(newItem)
        }
      })

      this.lastUpdateTime = now
    }
  }
})
