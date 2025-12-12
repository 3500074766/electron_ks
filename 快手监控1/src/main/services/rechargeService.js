import querystring from 'node:querystring'
import { HttpClient, httpClient } from '../utils/httpClient.js'

const API_URLS = {
  CREATE_ORDER: 'https://niu.e.kuaishou.com/rest/n/gateway/wallet/recharge',
  CASHIER: 'https://www.kuaishoupay.com/pay/order/pc/trade/cashier',
  QUERY_STATUS: 'https://www.kuaishoupay.com/pay/order/pc/trade/query'
}

export class RechargeService {
  constructor(mainWindow) {
    this.client = httpClient || new HttpClient()
    this.mainWindow = mainWindow
    // Store active polling loops to prevent memory leaks if needed,
    // though simple loops are fine for this scale.
    this.activeMonitors = new Set()
  }

  // Parse cookie string to object for the http client helper
  _parseCookieToDict(cookieStr) {
    const dict = {}
    if (!cookieStr) return dict
    cookieStr.split(';').forEach(item => {
      const [k, v] = item.trim().split('=')
      if (k) dict[k] = v
    })
    return dict
  }

  // Step 1: Create Order
  async createOrder(user, amount) {
    const cookies = this._parseCookieToDict(user.ck)

    // Amount conversion: Input 52 -> Send 52000
    const rechargeAmount = Math.round(amount * 1000)

    const payload = {
      "walletType": 1,
      "payChannel": 0,
      "rechargeAmount": rechargeAmount,
      "tradeType": 2,
      "payWay": 3
    }

    const headers = {
      'Content-Type': 'application/json',
      'app-key': 'ad.adUkmConfig.adEsp',
      'Referer': 'https://niu.e.kuaishou.com/newFinance/accountWallet',
      'esp-platform': 'pc'
    }

    // Use specific parsing for this service or reuse common client
    const [ok, res] = await this.client.post({
      url: API_URLS.CREATE_ORDER,
      data: payload,
      headers,
      cookies
    })

    if (ok && res.result === 1 && res.msg === 'OK') {
      return res.data // { payCode, merchantCode, ... }
    }

    throw new Error(res?.msg || '创建订单失败')
  }

  // Step 2: Get Cashier URL (QR Code)
  async getCashierUrl(user, merchantCode, payCode) {
    const cookies = this._parseCookieToDict(user.ck)

    // Ensure data is x-www-form-urlencoded
    const data = querystring.stringify({
      'merchant_id': merchantCode,
      'out_order_no': payCode
    })

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://niu.e.kuaishou.com/'
    }

    const [ok, res] = await this.client.post({
      url: API_URLS.CASHIER,
      data: data, // HttpClient's axios instance will handle string data correctly
      headers,
      cookies
    })

    if (ok && res.result === 'SUCCESS') {
      return res.qrcode_url
    }

    throw new Error(res?.error_msg || '获取支付二维码失败')
  }

  // Step 3: Monitor Status (Polling)
  async startMonitoring(user, merchantCode, payCode, amount) {
    const cookies = this._parseCookieToDict(user.ck)
    const monitorId = `${user.UID}_${payCode}`
    this.activeMonitors.add(monitorId)

    const data = querystring.stringify({
      'merchant_id': merchantCode,
      'out_order_no': payCode
    })

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://niu.e.kuaishou.com/'
    }

    console.log(`[Recharge] Started monitoring for user ${user.名称} (${user.UID})`)

    const poll = async () => {
      // Stop if not active (could add logic to cancel monitoring)
      if (!this.activeMonitors.has(monitorId)) return

      try {
        const [ok, res] = await this.client.post({
          url: API_URLS.QUERY_STATUS,
          data,
          headers,
          cookies
        })

        if (ok) {
          const state = res.order_state
          if (state === 'SUCCESS') {
            console.log(`[Recharge] Success for ${user.名称}`)
            this.activeMonitors.delete(monitorId)
            this._notifySuccess(user, amount)
            return
          } else if (state === 'CLOSED' || state === 'Failed') {
            console.log(`[Recharge] Failed/Closed for ${user.名称}`)
            this.activeMonitors.delete(monitorId)
            return // Stop polling
          }
        }
      } catch (e) {
        console.error(`[Recharge] Polling error:`, e)
      }

      // Continue polling every 3 seconds
      setTimeout(poll, 3000)
    }

    // Start the loop
    poll()
  }

  _notifySuccess(user, amount) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('recharge_success', {
        uid: user.UID,
        name: user.名称,
        amount: amount
      })
    }
  }

  // Main entry point called by IPC
  async initiateRecharge(user, amount) {
    // 1. Create Order
    const orderData = await this.createOrder(user, amount)
    if (!orderData) throw new Error("Order creation returned empty data")

    const { merchantCode, payCode } = orderData

    // 2. Get QR Code
    const qrUrl = await this.getCashierUrl(user, merchantCode, payCode)

    // 3. Start Polling (Background)
    // We don't await this; we let it run in the background
    this.startMonitoring(user, merchantCode, payCode, amount)

    return {
      qrUrl,
      payCode,
      merchantCode
    }
  }
}
