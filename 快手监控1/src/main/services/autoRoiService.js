import fs from 'fs'
import { join } from 'path'
import { app } from 'electron'

const CONFIG_FILE = 'auto_roi_config.json'
const LOG_FILE = 'auto_roi_logs.json'

// === 核心配置变量 ===
const MIN_ROI = 2.66 // 兜底 ROI 值，所有计算结果不会低于此值

export class AutoRoiService {
  constructor({ roiSvc, usersSvc, send }) {
    this.roiSvc = roiSvc
    this.usersSvc = usersSvc
    this.send = send

    this.userDataPath = app.getPath('userData')
    this.configPath = join(this.userDataPath, CONFIG_FILE)
    this.logPath = join(this.userDataPath, LOG_FILE)

    this.isEnabled = false // 默认初始化为关闭
    this.logs = []

    this._loadConfig()
    this._loadLogs()
  }

  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        this.isEnabled = false // 强制默认关闭
      }
    } catch (e) {
      console.error('Failed to load auto roi config', e)
    }
  }

  _saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({ enabled: this.isEnabled }), 'utf-8')
    } catch (e) { console.error('Failed to save auto roi config', e) }
  }

  _loadLogs() {
    try {
      if (fs.existsSync(this.logPath)) {
        this.logs = JSON.parse(fs.readFileSync(this.logPath, 'utf-8'))
      }
    } catch (e) { this.logs = [] }
  }

  _saveLogs() {
    try {
      // 限制日志只存储最近 10 次
      if (this.logs.length > 10) this.logs = this.logs.slice(0, 10)
      fs.writeFileSync(this.logPath, JSON.stringify(this.logs, null, 2), 'utf-8')
    } catch (e) { console.error('Failed to save logs', e) }
  }

  addLog(entry) {
    this.logs.unshift(entry)
    this._saveLogs()
    this.send('auto_roi_log_update', entry)
  }

  toggle(enabled) {
    this.isEnabled = enabled
    this._saveConfig()
    return this.isEnabled
  }

  getStatus() {
    return { enabled: this.isEnabled }
  }

  getLogs() {
    return this.logs
  }

  /**
   * Main logic triggered by CountdownService
   */
  async checkAndAdjust(ksData, roiData) {
    if (!this.isEnabled) return false

    console.log('[AutoRoi] Starting check with UPDATED logic...')

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

      let newRoi = currentRoi
      let shouldModify = false
      let changeReason = ''

      // 获取全站 ROI 和 差值
      const globalRoi = parseFloat(item['全站ROI'])
      const roiChangeStr = item['全站ROI差值'] // '--' or number
      const hasGlobalRoi = !isNaN(globalRoi)
      // 下降值 = -(差值)。
      let drop = null
      if (roiChangeStr !== '--' && roiChangeStr !== undefined && roiChangeStr !== null) {
        drop = -parseFloat(roiChangeStr)
      }

      // =========================
      // 新版自动调控逻辑 (2024-05 Update)
      // =========================

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
          // 兜底保护
          if (newRoi < MIN_ROI) newRoi = MIN_ROI
          shouldModify = true
        }
      }

      // --- [场景 2] 0.5 <= 消耗 <= 1.5 ---
      else if (cost >= 0.5 && cost <= 1.5) {
        // 并且全站 ROI 为 0
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

        // 触发判断全站 ROI (需要全站ROI和降幅数据都存在)
        if (hasGlobalRoi && drop !== null) {
          const bidRoi = currentRoi

          // === A. 全站 ROI > 20 ===
          if (globalRoi > 20) {
            if (drop < 3) {
              increase = (bidRoi <= 5) ? 2 : 1.5
              ruleDesc = `全站ROI>20, 降幅<3, 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            } else if (drop >= 3 && drop <= 5) {
              increase = (bidRoi <= 5) ? 4.5 : 3.5
              ruleDesc = `全站ROI>20, 降幅[3,5], 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            } else if (drop > 6) {
              increase = (bidRoi <= 5) ? 18 : 13
              ruleDesc = `全站ROI>20, 降幅>6, 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            }
          }
          // === B. 全站 ROI 在 [12, 20) ===
          // 处理为 [12, 20] 以覆盖边界
          else if (globalRoi >= 12 && globalRoi <= 20) {
            if (drop < 1) {
              increase = (bidRoi <= 5) ? 2 : 1.5
              ruleDesc = `全站ROI[12,20], 降幅<1, 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            } else if (drop >= 1 && drop <= 3) {
              increase = (bidRoi <= 5) ? 4.5 : 3.5
              ruleDesc = `全站ROI[12,20], 降幅[1,3], 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            } else if (drop > 3) {
              increase = (bidRoi <= 5) ? 18 : 13
              ruleDesc = `全站ROI[12,20], 降幅>3, 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            }
          }
          // === C. 全站 ROI < 12 ===
          else if (globalRoi < 12) {
            if (drop < 1) {
              increase = (bidRoi <= 5) ? 2 : 1.5
              ruleDesc = `全站ROI<12, 降幅<1, 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            } else if (drop >= 1 && drop <= 2) {
              increase = (bidRoi <= 5) ? 4.5 : 3.5
              ruleDesc = `全站ROI<12, 降幅[1,2], 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            } else if (drop > 2) {
              increase = (bidRoi <= 5) ? 18 : 13
              ruleDesc = `全站ROI<12, 降幅>2, 出价ROI${bidRoi <= 5 ? '<=5' : '>5'}`
              matchedRule = true
            }
          }
        }

        // 如果没有匹配到任何复杂规则，则使用默认的 +1.5
        if (!matchedRule) {
          ruleDesc = `消耗>1.5, 未触发特殊规则 -> 默认加1.5`
        } else {
          ruleDesc = `消耗>1.5, ${ruleDesc} -> 加${increase}`
        }

        newRoi = currentRoi + increase
        shouldModify = true
        changeReason = ruleDesc
      }

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
            message: changeReason // 这里写入详细原因
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
        count: batchDetails.length,
        details: batchDetails
      }
      this.addLog(batchLog)
    }

    return anyUpdates
  }
}
