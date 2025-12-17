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

    // 状态存储：
    // lastGlobalRoi: 上一次的全站 ROI，用于计算下降幅度
    this.lastGlobalRoi = null

    // itemStates: Map<UID, Object>
    // 存储每个 UID 的计数器状态
    // {
    //   consecutive_02_03: 0, // Rule B
    //   consecutive_03_05: 0, // Rule C
    //   consecutive_005_013: 0, // Rule D
    //   consecutive_less_005: 0 // Rule E
    // }
    this.itemStates = new Map()

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
    // 每次开启/关闭时，重置上一轮的全站 ROI，避免很久以前的数据影响现在的判断
    if (!enabled) {
      this.lastGlobalRoi = null
      this.itemStates.clear()
    }
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
   * 计算全站 ROI (加权平均)
   * 全站 ROI = 总 GMV / 总消耗
   * GMV = 消耗 * ROI
   */
  _calculateGlobalRoi(ksData, roiMap) {
    let totalCost = 0
    let totalGmv = 0

    for (const item of ksData) {
      const costStr = item.消耗
      if (costStr === '--' || costStr == null) continue
      const cost = parseFloat(costStr)
      if (isNaN(cost)) continue

      const uid = String(item.UID)
      const roiItem = roiMap.get(uid)

      // 如果没有对应的 ROI 数据，无法计算 GMV，只能跳过或假设
      // 这里假设只有匹配到的才算入全站 ROI
      if (roiItem && roiItem.roi) {
        const roi = parseFloat(roiItem.roi)
        if (!isNaN(roi)) {
          totalCost += cost
          totalGmv += (cost * roi)
        }
      }
    }

    if (totalCost === 0) return 0
    return totalGmv / totalCost
  }

  /**
   * Main logic triggered by CountdownService
   */
  async checkAndAdjust(ksData, roiData) {
    if (!this.isEnabled) return false

    console.log('[AutoRoi] Starting check with NEW rules...')

    const roiMap = new Map()
    if (Array.isArray(roiData)) {
      roiData.forEach(r => roiMap.set(String(r.UID), r))
    }

    if (!Array.isArray(ksData)) return false

    // 1. 计算当前全站 ROI
    const currentGlobalRoi = this._calculateGlobalRoi(ksData, roiMap)

    // 2. 计算全站 ROI 下降值 (Last - Current)
    // 如果没有上次记录(刚启动)，则认为下降为 0
    let globalRoiDrop = 0
    if (this.lastGlobalRoi !== null) {
      globalRoiDrop = this.lastGlobalRoi - currentGlobalRoi
    }

    // 更新 lastGlobalRoi 供下次使用
    this.lastGlobalRoi = currentGlobalRoi

    console.log(`[AutoRoi] Global ROI: ${currentGlobalRoi.toFixed(2)}, Drop: ${globalRoiDrop.toFixed(2)}`)

    let anyUpdates = false
    const batchDetails = []

    for (const item of ksData) {
      const uid = String(item.UID)
      const costStr = item.消耗

      // 安全获取余额，如果字段不存在默认给一个非0值以通过检查
      // 假设字段名为 '余额' 或 'balance'
      const rawBalance = item.余额 !== undefined ? item.余额 : (item.balance !== undefined ? item.balance : 1)
      const balance = parseFloat(rawBalance)

      if (costStr === '--' || costStr == null) continue
      const cost = parseFloat(costStr)
      if (isNaN(cost)) continue

      const roiItem = roiMap.get(uid)
      if (!roiItem || !roiItem.target_id) continue

      const currentRoi = parseFloat(roiItem.roi)
      if (currentRoi === 0) continue // 智能托管跳过
      if (isNaN(currentRoi)) continue

      // 初始化或获取该 UID 的状态计数器
      if (!this.itemStates.has(uid)) {
        this.itemStates.set(uid, {
          consecutive_02_03: 0,
          consecutive_03_05: 0,
          consecutive_005_013: 0,
          consecutive_less_005: 0
        })
      }
      const state = this.itemStates.get(uid)

      let newRoi = currentRoi
      let shouldModify = false
      let ruleTriggered = null // 用于日志记录触发了哪条规则

      // ===========================
      // 规则判断逻辑开始
      // ===========================

      // 重置所有非当前命中区间的计数器 (严格的“连续”逻辑通常意味着中间不能断)
      // 我们将在命中某个区间时增加该区间的计数，并重置其他计数
      // 如果没有命中任何计数区间，则所有计数器重置 (除非逻辑允许重叠，但这里区间基本互斥)

      // --- Rule Group 1: 消耗 >= 0.5 ---
      if (cost >= 0.5) {
        // 重置低消耗计数器
        state.consecutive_02_03 = 0
        state.consecutive_03_05 = 0
        state.consecutive_005_013 = 0
        state.consecutive_less_005 = 0

        // Sub-rule: 0.5 <= Cost <= 0.7
        if (cost <= 0.7) {
          // Case 1: 全站 ROI > 20
          if (currentGlobalRoi > 20) {
            if (globalRoiDrop < 3) {
              newRoi = currentRoi + (currentRoi <= 5 ? 4 : 3)
              shouldModify = true
            } else if (globalRoiDrop >= 3 && globalRoiDrop <= 5) {
              newRoi = currentRoi + (currentRoi <= 5 ? 8 : 5)
              shouldModify = true
            } else if (globalRoiDrop > 6) {
              newRoi = currentRoi + (currentRoi <= 5 ? 19 : 15)
              shouldModify = true
            }
          }
          // Case 2: 全站 ROI (15, 20]  (区间定义通常含头不含尾或闭区间，这里按逻辑流处理)
          // 假设为 15 < Global <= 20
          else if (currentGlobalRoi > 15 && currentGlobalRoi <= 20) {
            if (globalRoiDrop < 1) {
              newRoi = currentRoi + (currentRoi <= 5 ? 4 : 3)
              shouldModify = true
            } else if (globalRoiDrop >= 1 && globalRoiDrop <= 3) { // Prompt: 1 <= drop <= 3
              newRoi = currentRoi + (currentRoi <= 5 ? 5 : 4)
              shouldModify = true
            } else if (globalRoiDrop > 3) {
              newRoi = currentRoi + (currentRoi <= 5 ? 19 : 15)
              shouldModify = true
            }
          }
          // Case 3: 全站 ROI [10, 15] (Prompt: < 15 >= 10)
          else if (currentGlobalRoi >= 10 && currentGlobalRoi <= 15) {
            if (globalRoiDrop < 0.7) {
              newRoi = currentRoi + (currentRoi <= 5 ? 4 : 3)
              shouldModify = true
            } else if (globalRoiDrop >= 0.7 && globalRoiDrop <= 1.5) {
              newRoi = currentRoi + (currentRoi <= 5 ? 5 : 4)
              shouldModify = true
            } else if (globalRoiDrop > 2) {
              newRoi = currentRoi + (currentRoi <= 5 ? 19 : 15)
              shouldModify = true
            }
          }
          // Case 4: 全站 ROI < 10
          else if (currentGlobalRoi < 10) {
            if (globalRoiDrop < 0.5) {
              newRoi = currentRoi + (currentRoi <= 5 ? 4 : 3)
              shouldModify = true
            } else if (globalRoiDrop >= 0.5 && globalRoiDrop <= 1) {
              newRoi = currentRoi + (currentRoi <= 5 ? 5 : 4)
              shouldModify = true
            } else if (globalRoiDrop > 1) {
              newRoi = currentRoi + (currentRoi <= 5 ? 19 : 15)
              shouldModify = true
            }
          }
        }

        // Sub-rule: Cost > 0.7 (且不属于 [0.5, 0.7] 区间，即确实 > 0.7)
        if (cost > 0.7) {
          // 此规则未指定全站 ROI 的绝对值区间，只看下降幅度
          if (globalRoiDrop < 3) {
            newRoi = currentRoi + (currentRoi <= 5 ? 6 : 5)
            shouldModify = true
          } else if (globalRoiDrop >= 3 && globalRoiDrop <= 5) {
            newRoi = currentRoi + (currentRoi <= 5 ? 9 : 7)
            shouldModify = true
          } else if (globalRoiDrop > 6) {
            newRoi = currentRoi + (currentRoi <= 5 ? 20 : 17)
            shouldModify = true
          }
        }
      }

      // --- Rule Group 2: 0.2 <= Cost <= 0.3 ---
      else if (cost >= 0.2 && cost <= 0.3) {
        state.consecutive_02_03 += 1
        // Reset others
        state.consecutive_03_05 = 0
        state.consecutive_005_013 = 0
        state.consecutive_less_005 = 0

        if (state.consecutive_02_03 >= 2) {
          if (currentRoi < 5) {
            newRoi = currentRoi + 1
            shouldModify = true
            ruleTriggered = 'Cost[0.2,0.3]'
          }
          // 只有在触发判断并完成逻辑后（无论是否修改），如果符合“连续2次”的周期点，是否重置？
          // 题目说：“ROI修改成功后，标记改为0”。
          // 如果不修改（例如 ROI >= 5），标记保留吗？通常为了避免每轮都触发，应该重置或者只在修改后重置。
          // 题目逻辑：“判断出价roi是否小于5... 修改成功后标记0”。如果不小于5，没修改，标记怎么处理？
          // 假设：只要满足连续条件并进入了判断逻辑，如果没修改，可能继续保持高位等待下一次？
          // 但通常这种逻辑是“每满2次尝试一次”。为了防止死锁，我们只在 shouldModify=true 时重置。
          // 不过题目还有“如果不连续...标记改为0”，这个在上面 else if 结构天然满足（进入其他分支就重置了）。
        }
      }

      // --- Rule Group 3: 0.3 < Cost < 0.5 (不包含 0.3 和 0.5) ---
      else if (cost > 0.3 && cost < 0.5) {
        state.consecutive_03_05 += 1
        // Reset others
        state.consecutive_02_03 = 0
        state.consecutive_005_013 = 0
        state.consecutive_less_005 = 0

        if (state.consecutive_03_05 >= 2) {
          if (currentRoi < 5) {
            newRoi = currentRoi + 3
            shouldModify = true
            ruleTriggered = 'Cost(0.3,0.5)'
          } else if (currentRoi > 5 && currentRoi < 7) {
            newRoi = currentRoi + 2
            shouldModify = true
            ruleTriggered = 'Cost(0.3,0.5)'
          }
        }
      }

      // --- Rule Group 4: 0.05 < Cost < 0.13 ---
      else if (cost > 0.05 && cost < 0.13) {
        state.consecutive_005_013 += 1
        // Reset others
        state.consecutive_02_03 = 0
        state.consecutive_03_05 = 0
        state.consecutive_less_005 = 0

        if (state.consecutive_005_013 >= 5) {
          if (currentRoi < 5) newRoi = currentRoi - 0.8
          else if (currentRoi >= 5 && currentRoi < 9) newRoi = currentRoi - 1.6
          else if (currentRoi >= 9 && currentRoi < 13) newRoi = currentRoi - 2.5
          else if (currentRoi >= 13 && currentRoi <= 19) newRoi = currentRoi - 3.2
          else if (currentRoi > 19) newRoi = currentRoi - 5

          if (newRoi < MIN_ROI) newRoi = MIN_ROI // 兜底
          shouldModify = true
          ruleTriggered = 'Cost(0.05,0.13)'
        }
      }

      // --- Rule Group 5: Cost < 0.05 ---
      else if (cost < 0.05) {
        state.consecutive_less_005 += 1
        // Reset others
        state.consecutive_02_03 = 0
        state.consecutive_03_05 = 0
        state.consecutive_005_013 = 0

        if (state.consecutive_less_005 >= 3) {
          // 判断余额是否不等于 0
          if (balance !== 0) {
            if (currentRoi < 5) newRoi = currentRoi - 0.8
            else if (currentRoi >= 5 && currentRoi < 9) newRoi = currentRoi - 1.6
            else if (currentRoi >= 9 && currentRoi < 13) newRoi = currentRoi - 2.5
            else if (currentRoi >= 13 && currentRoi <= 19) newRoi = currentRoi - 3.2
            else if (currentRoi > 19) newRoi = currentRoi - 5

            if (newRoi < MIN_ROI) newRoi = MIN_ROI // 兜底
            shouldModify = true
            ruleTriggered = 'Cost<0.05'
          }
        }
      }

      // Cost 落在空隙区间 (e.g. 0.13 <= Cost < 0.2)，重置所有计数器
      else {
        state.consecutive_02_03 = 0
        state.consecutive_03_05 = 0
        state.consecutive_005_013 = 0
        state.consecutive_less_005 = 0
      }


      // ===========================
      // 执行更新逻辑
      // ===========================

      // 检查上限
      if (newRoi > 100) newRoi = 100
      // 保留3位小数
      newRoi = Math.round(newRoi * 1000) / 1000

      if (shouldModify && newRoi !== currentRoi) {
        try {
          console.log(`[AutoRoi] Adjusting ${item.名称}: Cost=${cost}, ROI ${currentRoi} -> ${newRoi}, Rule=${ruleTriggered || 'HighCost/Drop'}`)

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
            message: ruleTriggered ? `Rule:${ruleTriggered}` : `GlobalDrop:${globalRoiDrop.toFixed(2)}`
          })

          anyUpdates = true

          // *** 关键：修改成功后，将对应的计数标记归零 ***
          if (ruleTriggered === 'Cost[0.2,0.3]') state.consecutive_02_03 = 0
          if (ruleTriggered === 'Cost(0.3,0.5)') state.consecutive_03_05 = 0
          if (ruleTriggered === 'Cost(0.05,0.13)') state.consecutive_005_013 = 0
          if (ruleTriggered === 'Cost<0.05') state.consecutive_less_005 = 0

        } catch (error) {
          console.error(`[AutoRoi] Failed to update ${item.名称}`, error)
          batchDetails.push({
            name: item.名称,
            cost: cost,
            oldRoi: currentRoi,
            newRoi: newRoi,
            status: 'failed',
            message: error.message
          })
          // 失败是否重置标记？通常保持，以便下一次重试。这里不重置。
        }
      }
    }

    if (batchDetails.length > 0) {
      const batchLog = {
        id: Date.now(),
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        count: batchDetails.length,
        globalRoi: currentGlobalRoi.toFixed(2),
        globalRoiDrop: globalRoiDrop.toFixed(2),
        details: batchDetails
      }
      this.addLog(batchLog)
    }

    return anyUpdates
  }
}
