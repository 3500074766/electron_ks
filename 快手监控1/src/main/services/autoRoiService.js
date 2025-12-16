import fs from 'fs'
import { join } from 'path'
import { app, dialog } from 'electron'

const CONFIG_FILE = 'auto_roi_config.json'
const LOG_FILE = 'auto_roi_logs.json'
const MIN_ROI = 2.66 // 兜底 ROI

// ==========================================
// 在此处定义您的规则策略
// ==========================================
const RULES = [
  {
    id: 'dynamic_v1',
    name: '小颖',
    description: `
### 核心逻辑
基于消耗和全站ROI的差值进行动态调整，适合大多数全站推广场景。

#### 1. 消耗极低 (< 0.5)
快速降价以获取流量：
- **ROI < 5**: 减 1.5
- **ROI [5, 10)**: 减 2.5
- **ROI >= 10**: 减 4.0

#### 2. 消耗一般 (0.5 ~ 1.5)
- 若 **全站ROI为 0**：尝试加 1.0 刺激跑量。
- 否则保持不动。

#### 3. 消耗较高 (> 1.5)
逐步提升 ROI 以优化利润：
- **默认行为**: 加 1.5
- **激进提价触发条件** (需同时满足全站ROI较高且近期降幅较大):
  - 若全站 ROI > 20: 最高可加 18
  - 若全站 ROI > 12: 最高可加 13
    `,
    handler: (item, currentRoi, globalRoi, drop, hasGlobalRoi) => {
      let newRoi = currentRoi
      let changeReason = ''
      let shouldModify = false
      const cost = parseFloat(item.消耗)

      // --- [场景 1] 消耗 < 0.5 ---
      if (cost < 0.5) {
        let decrease = 0
        if (currentRoi < 5) {
          decrease = 1.5
          changeReason = `消耗<0.5, 出价ROI<5 -> 减1.5`
        } else if (currentRoi >= 5 && currentRoi < 10) {
          decrease = 2.5
          changeReason = `消耗<0.5, 出价ROI[5,10) -> 减2.5`
        } else if (currentRoi >= 10) {
          decrease = 4.0
          changeReason = `消耗<0.5, 出价ROI>=10 -> 减4.0`
        }

        if (decrease > 0) {
          newRoi = currentRoi - decrease
          if (newRoi < MIN_ROI) newRoi = MIN_ROI
          shouldModify = true
        }
      }
      // --- [场景 2] 0.5 <= 消耗 <= 1.5 ---
      else if (cost >= 0.5 && cost <= 1.5) {
        if (hasGlobalRoi && globalRoi === 0) {
          newRoi = currentRoi + 1.0
          shouldModify = true
          changeReason = `消耗[0.5,1.5]且全站ROI为0 -> 加1.0`
        }
      }
      // --- [场景 3] 消耗 > 1.5 ---
      else if (cost > 1.5) {
        let increase = 1.5 // 默认增加
        let matchedRule = false
        let ruleDesc = '默认规则'

        if (hasGlobalRoi && drop !== null) {
          const bidRoi = currentRoi
          // === A. 全站 ROI > 20 ===
          if (globalRoi > 20) {
            if (drop < 3) {
              increase = (bidRoi <= 5) ? 2 : 1.5
              ruleDesc = `全站ROI>20, 降幅<3`
              matchedRule = true
            } else if (drop >= 3 && drop <= 5) {
              increase = (bidRoi <= 5) ? 4.5 : 3.5
              ruleDesc = `全站ROI>20, 降幅[3,5]`
              matchedRule = true
            } else if (drop > 6) {
              increase = (bidRoi <= 5) ? 18 : 13
              ruleDesc = `全站ROI>20, 降幅>6`
              matchedRule = true
            }
          }
          // === B. 全站 ROI 在 [12, 20] ===
          else if (globalRoi >= 12 && globalRoi <= 20) {
            if (drop < 1) {
              increase = (bidRoi <= 5) ? 2 : 1.5
              ruleDesc = `全站ROI[12,20], 降幅<1`
              matchedRule = true
            } else if (drop >= 1 && drop <= 3) {
              increase = (bidRoi <= 5) ? 4.5 : 3.5
              ruleDesc = `全站ROI[12,20], 降幅[1,3]`
              matchedRule = true
            } else if (drop > 3) {
              increase = (bidRoi <= 5) ? 18 : 13
              ruleDesc = `全站ROI[12,20], 降幅>3`
              matchedRule = true
            }
          }
          // === C. 全站 ROI < 12 ===
          else if (globalRoi < 12) {
            if (drop < 1) {
              increase = (bidRoi <= 5) ? 2 : 1.5
              ruleDesc = `全站ROI<12, 降幅<1`
              matchedRule = true
            } else if (drop >= 1 && drop <= 2) {
              increase = (bidRoi <= 5) ? 4.5 : 3.5
              ruleDesc = `全站ROI<12, 降幅[1,2]`
              matchedRule = true
            } else if (drop > 2) {
              increase = (bidRoi <= 5) ? 18 : 13
              ruleDesc = `全站ROI<12, 降幅>2`
              matchedRule = true
            }
          }
        }

        if (!matchedRule) {
          ruleDesc = `消耗>1.5, 未匹配特殊规则 -> 默认加1.5`
        } else {
          ruleDesc = `消耗>1.5, ${ruleDesc} -> 加${increase}`
        }

        newRoi = currentRoi + increase
        shouldModify = true
        changeReason = ruleDesc
      }

      return { shouldModify, newRoi, changeReason }
    }
  },
  
]

export class AutoRoiService {
  constructor({ roiSvc, usersSvc, send }) {
    this.roiSvc = roiSvc
    this.usersSvc = usersSvc
    this.send = send

    this.userDataPath = app.getPath('userData')
    this.configPath = join(this.userDataPath, CONFIG_FILE)
    this.logPath = join(this.userDataPath, LOG_FILE)

    this.isEnabled = false
    this.activeRuleId = 'dynamic_v1' // 默认规则 ID
    this.logs = []

    this._loadConfig()
    this._loadLogs()
  }

  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        this.isEnabled = false // 强制重启关闭，防止意外
        this.activeRuleId = data.activeRuleId || 'dynamic_v1'
      }
    } catch (e) {
      console.error('Failed to load auto roi config', e)
    }
  }

  _saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({
        enabled: this.isEnabled,
        activeRuleId: this.activeRuleId
      }), 'utf-8')
    } catch (e) { console.error('Failed to save auto roi config', e) }
  }

  _loadLogs() {
    try {
      if (fs.existsSync(this.logPath)) {
        this.logs = JSON.parse(fs.readFileSync(this.logPath, 'utf-8'))
        // 启动时也清理一次过期日志
        this._cleanOldLogs()
      }
    } catch (e) { this.logs = [] }
  }

  // 清理 3 天前的日志
  _cleanOldLogs() {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000)
    const initialCount = this.logs.length
    // 假设 log.id 是 timestamp
    this.logs = this.logs.filter(log => log.id > threeDaysAgo)

    if (this.logs.length !== initialCount) {
      console.log(`[AutoRoi] Cleaned ${initialCount - this.logs.length} old logs.`)
      this._saveLogsToFile()
    }
  }

  _saveLogsToFile() {
    try {
      // 移除数量限制，保存所有（已过滤过期的）日志
      fs.writeFileSync(this.logPath, JSON.stringify(this.logs, null, 2), 'utf-8')
    } catch (e) { console.error('Failed to save logs', e) }
  }

  addLog(entry) {
    this.logs.unshift(entry)
    this._cleanOldLogs() // 每次添加时清理过期日志
    this._saveLogsToFile()
    this.send('auto_roi_log_update', entry)
  }

  toggle(enabled) {
    this.isEnabled = enabled
    this._saveConfig()
    return this.isEnabled
  }

  setRule(ruleId) {
    const rule = RULES.find(r => r.id === ruleId)
    if (rule) {
      this.activeRuleId = ruleId
      this._saveConfig()
      return true
    }
    return false
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      activeRuleId: this.activeRuleId,
      rules: RULES.map(r => ({ id: r.id, name: r.name, description: r.description }))
    }
  }

  getLogs() {
    return this.logs
  }

  async exportLogs(window) {
    if (!this.logs || this.logs.length === 0) {
      throw new Error('暂无日志可导出')
    }

    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: '导出自动调节日志',
      defaultPath: `auto_roi_logs_${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (canceled || !filePath) return false

    try {
      fs.writeFileSync(filePath, JSON.stringify(this.logs, null, 2), 'utf-8')
      return true
    } catch (e) {
      throw new Error('写入文件失败: ' + e.message)
    }
  }

  /**
   * Main logic triggered by CountdownService
   */
  async checkAndAdjust(ksData, roiData) {
    if (!this.isEnabled) return false

    console.log(`[AutoRoi] Starting check using rule: ${this.activeRuleId}`)

    // 获取当前激活的规则
    const activeRule = RULES.find(r => r.id === this.activeRuleId) || RULES[0]

    // Create a map for fast lookup
    const roiMap = new Map()
    if (Array.isArray(roiData)) {
      roiData.forEach(r => roiMap.set(String(r.UID), r))
    }

    if (!Array.isArray(ksData)) return false

    let anyUpdates = false
    const batchDetails = []

    for (const item of ksData) {
      const uid = String(item.UID)
      const costStr = item.消耗

      if (costStr === '--' || costStr === undefined || costStr === null) continue

      const cost = parseFloat(costStr)
      if (isNaN(cost)) continue

      const roiItem = roiMap.get(uid)
      if (!roiItem || !roiItem.target_id) continue

      const currentRoi = parseFloat(roiItem.roi)

      // 如果 ROI 为 0，说明是智能投放，跳过
      if (currentRoi === 0) continue
      if (isNaN(currentRoi)) continue

      // 获取全站 ROI 和 差值
      const globalRoi = parseFloat(item['全站ROI'])
      const roiChangeStr = item['全站ROI差值'] // '--' or number
      const hasGlobalRoi = !isNaN(globalRoi)
      // 下降值 = -(差值)。
      let drop = null
      if (roiChangeStr !== '--' && roiChangeStr !== undefined && roiChangeStr !== null) {
        drop = -parseFloat(roiChangeStr)
      }

      // === 调用规则 Handler 计算 ===
      let { shouldModify, newRoi, changeReason } = activeRule.handler(item, currentRoi, globalRoi, drop, hasGlobalRoi)

      // 上限保护
      if (newRoi > 100) newRoi = 100
      // 精度处理
      newRoi = Math.round(newRoi * 1000) / 1000

      // 执行修改
      if (shouldModify && newRoi !== currentRoi) {
        try {
          console.log(`[AutoRoi] Adjusting ${item.名称}: ${changeReason}, ROI ${currentRoi} -> ${newRoi}`)

          await this.roiSvc.updateRoi(
            { uid: uid, target_id: roiItem.target_id, roi_ratio: newRoi },
            async (id) => this.usersSvc.getUserByUid(id)
          )

          batchDetails.push({
            name: item.名称,
            cost: cost,
            oldRoi: currentRoi,
            newRoi: newRoi,
            status: 'success',
            message: changeReason
          })

          anyUpdates = true

        } catch (error) {
          console.error(`[AutoRoi] Failed to update ${item.名称}`, error)
          batchDetails.push({
            name: item.名称,
            cost: cost,
            oldRoi: currentRoi,
            newRoi: newRoi,
            status: 'failed',
            message: `${changeReason} (失败: ${error.message})`
          })
        }
      }
    }

    if (batchDetails.length > 0) {
      const batchLog = {
        id: Date.now(),
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        ruleName: activeRule.name, // 记录使用的规则名
        count: batchDetails.length,
        details: batchDetails
      }
      this.addLog(batchLog)
    }

    return anyUpdates
  }
}
