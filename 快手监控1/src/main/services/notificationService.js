import fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import nodemailer from 'nodemailer'
import QRCode from 'qrcode' // [新增] 需要安装 npm install qrcode

const CONFIG_FILE = 'notification_config.json'

export class NotificationService {
  constructor({ rechargeSvc }) {
    this.userDataPath = app.getPath('userData')
    this.configPath = join(this.userDataPath, CONFIG_FILE)
    this.rechargeSvc = rechargeSvc

    // 默认配置
    this.config = {
      enabled: false,           // 总开关
      recipients: [],           // 接收邮箱列表
      // 发件人配置
      smtp: {
        user: '',
        pass: ''
      },
      rules: {
        // interval: 触发频率(分钟)，默认 60 分钟内同类型只触发一次
        // rechargeAmount: 自动生成的充值二维码金额(元)
        low_balance: { enabled: false, threshold: 50, interval: 60, rechargeAmount: 100 },
        high_cost: { enabled: false, threshold: 1000, interval: 60 }
      }
    }

    // 报警历史 { "uid_ruleType": timestamp }
    this.alertHistory = {}

    this._loadConfig()
    this._initTransporter()
  }

  _initTransporter() {
    if (this.config.smtp.user && this.config.smtp.pass) {
      this.transporter = nodemailer.createTransport({
        service: 'qq',
        port: 465,
        secure: true,
        auth: {
          user: this.config.smtp.user,
          pass: this.config.smtp.pass
        }
      })
    } else {
      this.transporter = null
    }
  }

  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const saved = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))

        const mergeRules = (defaultRules, savedRules) => {
          const merged = { ...defaultRules }
          for (const key in savedRules) {
            if (merged[key]) {
              merged[key] = {
                ...merged[key],
                ...savedRules[key],
                interval: savedRules[key].interval !== undefined ? savedRules[key].interval : 60,
                ...(key === 'low_balance' ? { rechargeAmount: savedRules[key].rechargeAmount || 100 } : {})
              }
            }
          }
          return merged
        }

        this.config = {
          ...this.config,
          ...saved,
          smtp: { ...this.config.smtp, ...(saved.smtp || {}) },
          rules: mergeRules(this.config.rules, saved.rules || {})
        }
      }

      this.config.enabled = false;

    } catch (e) { console.error('加载通知配置失败', e) }
  }

  _saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (e) { console.error('保存通知配置失败', e) }
  }

  getConfig() {
    return this.config
  }

  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      rules: { ...this.config.rules, ...(newConfig.rules || {}) },
      smtp: { ...this.config.smtp, ...(newConfig.smtp || {}) }
    }
    this._saveConfig()
    this._initTransporter()
    return this.config
  }

  /**
   * 检查数据并决定是否发送通知
   */
  async checkAndNotify(context) {
    if (!this.config.enabled || !this.config.recipients || this.config.recipients.length === 0 || !this.transporter) {
      return
    }

    const rules = this.config.rules
    const alerts = []

    // --- 规则 A: 余额不足 ---
    if (rules.low_balance && rules.low_balance.enabled && Array.isArray(context.wallets)) {
      const limit = parseFloat(rules.low_balance.threshold)
      const intervalMins = parseFloat(rules.low_balance.interval) || 0
      const rechargeAmt = parseFloat(rules.low_balance.rechargeAmount) || 100

      for (const user of context.wallets) {
        const bal = parseFloat(user.余额)
        const uid = user.UID

        if (!isNaN(bal) && bal < limit) {
          if (this._shouldAlert(uid, 'low_balance', intervalMins)) {
            let qrBase64 = null
            let errorMsg = ''

            // 尝试生成充值二维码并转换为 Base64
            try {
              if (this.rechargeSvc) {
                console.log(`[Notification] Generating recharge QR for ${user.名称} (${uid}), amount: ${rechargeAmt}`)
                const res = await this.rechargeSvc.initiateRecharge({
                  UID: uid,
                  名称: user.名称,
                  ck: user.ck
                }, rechargeAmt)

                if (res && res.qrUrl) {
                  // 生成二维码 Base64，增加 margin 使得图片更好看
                  qrBase64 = await QRCode.toDataURL(res.qrUrl, { margin: 2, width: 300, color: { dark: '#000000', light: '#ffffff' } })
                }
              }
            } catch (e) {
              console.error(`[Notification] Failed to generate QR for ${uid}:`, e)
              errorMsg = '二维码生成失败，请手动充值'
            }

            alerts.push({
              type: '余额不足',
              level: 'error',
              user: user.名称 || uid,
              uid: uid,
              summary: `余额 ${bal}元 (低于 ${limit}元)`,
              // 使用纯文本或简单的 span，避免复杂嵌套
              msgContent: `当前余额仅剩 ${bal} 元，低于设定值 ${limit} 元。`,
              actionContent: `已自动生成 ${rechargeAmt} 元充值码，请扫码支付。`,
              qrCode: qrBase64,
              error: errorMsg
            })
          }
        } else if (!isNaN(bal) && bal >= limit) {
          this._clearAlertHistory(uid, 'low_balance')
        }
      }
    }

    // --- 规则 B: 消耗过高 ---
    if (rules.high_cost && rules.high_cost.enabled && Array.isArray(context.ksData)) {
      const limit = parseFloat(rules.high_cost.threshold)
      const intervalMins = parseFloat(rules.high_cost.interval) || 0

      context.ksData.forEach(user => {
        const cost = parseFloat(user.消耗)
        const uid = user.UID

        if (!isNaN(cost) && cost > limit) {
          if (this._shouldAlert(uid, 'high_cost', intervalMins)) {
            alerts.push({
              type: '消耗过高',
              level: 'warning',
              user: user.名称 || uid,
              uid: uid,
              summary: `消耗 ${cost}元 (高于 ${limit}元)`,
              msgContent: `今日累计消耗已达 ${cost} 元，超过设定阈值 ${limit} 元。`,
              actionContent: '请注意监控账户预算情况。',
              qrCode: null
            })
          }
        } else if (!isNaN(cost) && cost <= limit) {
          this._clearAlertHistory(uid, 'high_cost')
        }
      })
    }

    if (alerts.length > 0) {
      await this._sendBatchEmail(alerts)
    }
  }

  // 判断是否应该报警 (基于时间间隔)
  _shouldAlert(uid, ruleType, intervalMinutes) {
    const key = `${uid}_${ruleType}`
    const lastTime = this.alertHistory[key]
    const now = Date.now()

    if (!lastTime) {
      this.alertHistory[key] = now
      return true
    }

    const cooldownMs = intervalMinutes * 60 * 1000
    if (intervalMinutes > 0 && (now - lastTime < cooldownMs)) {
      return false
    }

    this.alertHistory[key] = now
    return true
  }

  _clearAlertHistory(uid, ruleType) {
    const key = `${uid}_${ruleType}`
    if (this.alertHistory[key]) {
      delete this.alertHistory[key]
    }
  }

  async _sendBatchEmail(alerts) {
    const timeStr = new Date().toLocaleString('zh-CN', { hour12: false })

    // 移动端优化模板
    // 1. 使用 max-width: 100% 适应小屏幕
    // 2. 字体大小适中 (14px-16px)
    // 3. 移除复杂的 details/summary 折叠
    // 4. 清晰的卡片式分割

    const listHtml = alerts.map(a => {
      // 定义颜色常量
      const isError = a.level === 'error'
      const borderColor = isError ? '#ef4444' : '#f59e0b' // red-500 : amber-500
      const bgColor = isError ? '#fef2f2' : '#fffbeb'     // red-50 : amber-50
      const titleColor = isError ? '#b91c1c' : '#b45309'  // red-700 : amber-700

      return `
        <!-- 单个报警卡片 -->
        <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">

          <!-- 标题栏 -->
          <div style="background-color: ${bgColor}; padding: 12px 15px; border-left: 4px solid ${borderColor}; border-bottom: 1px solid ${isError ? '#fee2e2' : '#fef3c7'};">
            <div style="font-size: 16px; font-weight: bold; color: #1f2937; line-height: 1.4;">
              <span style="color: ${titleColor}; margin-right: 5px;">[${a.type}]</span> ${a.user}
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">UID: ${a.uid}</div>
          </div>

          <!-- 内容区域 -->
          <div style="padding: 15px;">
            <div style="font-size: 15px; color: #374151; line-height: 1.6; margin-bottom: 10px;">
              ${a.msgContent}
            </div>

            <div style="font-size: 14px; color: #4b5563; line-height: 1.5; background-color: #f3f4f6; padding: 10px; border-radius: 6px;">
              <strong>操作建议：</strong>${a.actionContent}
            </div>

            <!-- 二维码区域 -->
            ${a.qrCode ? `
              <div style="margin-top: 15px; text-align: center;">
                <div style="display: inline-block; padding: 10px; border: 1px dashed #d1d5db; border-radius: 8px; background-color: #ffffff;">
                  <img src="${a.qrCode}" alt="充值二维码" style="width: 180px; height: 180px; display: block; max-width: 100%;" />
                  <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">请使用 支付宝/微信/快手 扫码</div>
                </div>
              </div>
            ` : ''}

            ${a.error ? `<div style="margin-top: 10px; color: #ef4444; font-size: 13px; text-align: center;">⚠️ ${a.error}</div>` : ''}
          </div>
        </div>
      `
    }).join('')

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>监控预警</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

        <!-- 主容器 -->
        <div style="max-width: 600px; margin: 0 auto; background-color: #f3f4f6; padding: 10px;">

          <!-- 顶部 Header -->
          <div style="text-align: center; padding: 20px 0;">
            <h1 style="font-size: 20px; font-weight: bold; color: #111827; margin: 0;">🚨 监控助手预警</h1>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0;">检测时间：${timeStr}</p>
          </div>

          <!-- 报警列表 -->
          ${listHtml}

          <!-- 底部 Footer -->
          <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">本邮件由系统自动发送，请勿直接回复。</p>
          </div>

        </div>
      </body>
      </html>
    `

    console.log(`[Notification] 准备发送报警邮件，共 ${alerts.length} 条内容...`)

    const sendPromises = this.config.recipients.map(recipient => {
      if (!recipient.trim()) return Promise.resolve()
      return this.transporter.sendMail({
        from: `"监控助手" <${this.config.smtp.user}>`,
        to: recipient.trim(),
        subject: `【监控预警】${alerts.length}个账号异常提醒 - ${timeStr}`,
        html: html
      })
    })

    const results = await Promise.allSettled(sendPromises)
    let successCount = 0
    results.forEach((res) => {
      if (res.status === 'fulfilled') successCount++
      else console.error(`[Notification] 发送失败:`, res.reason)
    })
    console.log(`[Notification] 发送完成: 成功 ${successCount} / 总计 ${this.config.recipients.length}`)
  }
}
