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

    this.isEnabled = false
    this.logs = []

    // 用于记录每个 UID 连续消耗为 0 的次数
    this.zeroCostCounter = new Map()

    this._loadConfig()
    this._loadLogs()
  }

  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        this.isEnabled = !!data.enabled
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
      // Limit logs to last 500 to prevent file bloat
      if (this.logs.length > 500) this.logs = this.logs.slice(0, 500)
      fs.writeFileSync(this.logPath, JSON.stringify(this.logs, null, 2), 'utf-8')
    } catch (e) { console.error('Failed to save logs', e) }
  }

  addLog(entry) {
    this.logs.unshift(entry)
    this._saveLogs()
    // Real-time update to frontend
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
   * @param {Array} ksData - Kuaishou data containing '消耗'
   * @param {Array} roiData - ROI data containing 'roi' and 'target_id'
   * @returns {Promise<boolean>} - Returns true if any modification was made
   */
  async checkAndAdjust(ksData, roiData) {
    if (!this.isEnabled) return false

    console.log('[AutoRoi] Starting check...')

    // Create a map for fast lookup
    const roiMap = new Map()
    if (Array.isArray(roiData)) {
      roiData.forEach(r => roiMap.set(String(r.UID), r))
    }

    if (!Array.isArray(ksData)) return false

    let anyUpdates = false

    for (const item of ksData) {
      const uid = String(item.UID)
      const costStr = item.消耗

      // Skip if cost is not valid
      if (costStr === '--' || costStr === undefined || costStr === null) continue

      const cost = parseFloat(costStr)
      if (isNaN(cost)) continue

      const roiItem = roiMap.get(uid)
      if (!roiItem || !roiItem.target_id) continue

      const currentRoi = parseFloat(roiItem.roi)
      if (isNaN(currentRoi)) continue

      // --- 连续 0 消耗计数逻辑 ---
      let zeroCount = this.zeroCostCounter.get(uid) || 0
      if (cost === 0) {
        zeroCount++
      } else {
        zeroCount = 0
      }
      this.zeroCostCounter.set(uid, zeroCount)

      let newRoi = currentRoi
      let shouldModify = false

      // === 优先处理连续 0 消耗的特殊逻辑 (次数 >= 2) ===
      if (zeroCount >= 2) {
        let decrease = 0
        if (zeroCount === 2) decrease = 5        // 连续2次
        else if (zeroCount === 3) decrease = 10  // 连续3次
        else if (zeroCount >= 4) decrease = 20   // 连续4次及以上

        // 计算新 ROI (带兜底 MIN_ROI)
        if (currentRoi > MIN_ROI) {
          newRoi = currentRoi - decrease
          if (newRoi < MIN_ROI) newRoi = MIN_ROI
          shouldModify = true
        } else if (currentRoi < MIN_ROI) {
          newRoi = MIN_ROI
          shouldModify = true
        }

        if (shouldModify) {
          console.log(`[AutoRoi] Zero cost streak ${zeroCount} for ${item.名称}, decreasing by ${decrease}`)
        }
      }
      // === 常规逻辑 (包含第一次 0 消耗的情况) ===
      else {
        // 1. Cost <= 0.2 (第一次 0 消耗会落入这里，执行 -2)
        if (cost >= 0 && cost <= 0.2) {
          if (currentRoi > MIN_ROI) {
            newRoi = currentRoi - 2
            if (newRoi < MIN_ROI) newRoi = MIN_ROI
            shouldModify = true
          } else if (currentRoi < MIN_ROI) {
            newRoi = MIN_ROI
            shouldModify = true
          }
        }
        // 2. 0.2 < Cost < 0.3
        else if (cost > 0.2 && cost < 0.3) {
          if (currentRoi > MIN_ROI) {
            newRoi = currentRoi - 1
            if (newRoi < MIN_ROI) newRoi = MIN_ROI
            shouldModify = true
          } else if (currentRoi < MIN_ROI) {
            newRoi = MIN_ROI
            shouldModify = true
          }
        }
        // 3. 0.3 <= Cost <= 0.5 -> No Change
        else if (cost >= 0.3 && cost <= 0.5) {
          shouldModify = false
        }
        // 4. > 0.5 and <= 0.9 -> +1
        else if (cost > 0.5 && cost <= 0.9) {
          newRoi = currentRoi + 1
          shouldModify = true
        }
        // 5. > 0.9 and <= 1.3 -> +2
        else if (cost > 0.9 && cost <= 1.3) {
          newRoi = currentRoi + 2
          shouldModify = true
        }
        // 6. > 1.3 and <= 1.7 -> +3
        else if (cost > 1.3 && cost <= 1.7) {
          newRoi = currentRoi + 3
          shouldModify = true
        }
        // 7. > 1.7 and <= 2.2 -> +4
        else if (cost > 1.7 && cost <= 2.2) {
          newRoi = currentRoi + 4
          shouldModify = true
        }
        // 8. 2.2 - 3 -> +8
        else if (cost > 2.2 && cost <= 3) {
          newRoi = currentRoi + 8
          shouldModify = true
        }
        // 9. 3 - 5 -> +15
        else if (cost > 3 && cost <= 5) {
          newRoi = currentRoi + 15
          shouldModify = true
        }
        // 10. 5 - 13 -> +20
        else if (cost > 5 && cost <= 13) {
          newRoi = currentRoi + 20
          shouldModify = true
        }
        // 11. > 13 -> +40
        else if (cost > 13) {
          newRoi = currentRoi + 40
          shouldModify = true
        }
      }

      // Upper limit check
      if (newRoi > 100) newRoi = 100

      // Round to 3 decimal places
      newRoi = Math.round(newRoi * 1000) / 1000

      // Execute Update if needed
      if (shouldModify && newRoi !== currentRoi) {
        try {
          console.log(`[AutoRoi] Adjusting ${item.名称}: Cost=${cost}, Streak=${zeroCount}, ROI ${currentRoi} -> ${newRoi}`)

          await this.roiSvc.updateRoi(
            { uid: uid, target_id: roiItem.target_id, roi_ratio: newRoi },
            async (id) => this.usersSvc.getUserByUid(id)
          )

          // Log success
          this.addLog({
            time: new Date().toLocaleString('zh-CN', { hour12: false }),
            name: item.名称,
            cost: cost,
            oldRoi: currentRoi,
            newRoi: newRoi,
            status: 'success',
            message: zeroCount >= 2 ? `连续${zeroCount}次0消耗` : null
          })

          anyUpdates = true

        } catch (error) {
          console.error(`[AutoRoi] Failed to update ${item.名称}`, error)
          // Log failure
          this.addLog({
            time: new Date().toLocaleString('zh-CN', { hour12: false }),
            name: item.名称,
            cost: cost,
            oldRoi: currentRoi,
            newRoi: newRoi,
            status: 'failed',
            message: error.message
          })
        }
      }
    }

    return anyUpdates
  }
}
