import { dialog } from 'electron'
import fs from 'fs'
import { appStore } from '../db/appStore.js'

export class ExportService {
  async exportData() {
    try {
      // 1. 从数据库获取所有用户数据
      const rows = await appStore.getAllUserStats()

      if (!rows || rows.length === 0) {
        return { status: 'warning', message: '暂无数据可导出' }
      }

      // 2. 定义表头（对应数据库中的字段名）
      // 注意：这里要确保字段名与你 KuaishouService 中保存的一致
      const columnMapping = {
        'UID': '用户ID',
        '名称': '用户名称',
        'GMV': 'GMV',
        '花费': '总花费',
        '消耗': '实时消耗',
        '上次花费': '上次记录花费',
        '订单数': '订单数',
        '全站ROI': '全站ROI',
        'roi': '当前ROI', // 如果有存入这个字段
        '时间': '更新时间'
      }

      const keys = Object.keys(columnMapping)
      const headers = Object.values(columnMapping)

      // 3. 生成 CSV 内容
      // \uFEFF 是 BOM 头，确保 Excel 打开中文不乱码
      let csvContent = '\uFEFF' + headers.join(',') + '\n'

      rows.forEach(row => {
        const line = keys.map(key => {
          let val = row[key]
          // 处理空值
          if (val === undefined || val === null) val = ''
          // 转换为字符串
          val = String(val)
          // 如果内容包含逗号，需要用双引号包起来，避免格式错乱
          if (val.includes(',') || val.includes('\n')) {
            val = `"${val.replace(/"/g, '""')}"`
          }
          return val
        })
        csvContent += line.join(',') + '\n'
      })

      // 4. 弹出保存文件对话框
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '导出数据报表',
        defaultPath: `快手数据报表_${new Date().toISOString().split('T')[0]}.csv`,
        filters: [{ name: 'CSV 表格', extensions: ['csv'] }]
      })

      if (canceled || !filePath) {
        return { status: 'canceled' }
      }

      // 5. 写入文件
      fs.writeFileSync(filePath, csvContent, 'utf-8')
      return { status: 'success', path: filePath }

    } catch (e) {
      console.error('导出失败:', e)
      return { status: 'error', message: e.message }
    }
  }
}
