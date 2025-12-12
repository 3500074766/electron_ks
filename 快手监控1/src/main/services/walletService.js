import { HttpClient, httpClient } from '../utils/httpClient.js'

const API_URLS = {
  WALLET_LIST: 'https://niu.e.kuaishou.com/rest/n/wallet/pay/walletList'
}

export class WalletService {
  constructor() {
    this.client = httpClient || new HttpClient()
  }

  async fetchWalletBalance(user) {
    if (!user.ck) return { UID: String(user.UID), 余额: '--' }

    // 提取并构建 Cookie 对象
    const cookies = {}
    user.ck.split(';').forEach(item => {
      const [k, v] = item.trim().split('=')
      if (k) cookies[k] = v
    })

    const headers = {
      'Referer': 'https://niu.e.kuaishou.com/newFinance/accountWallet',
      'app-key': 'ad.adUkmConfig.adEsp',
      'esp-entrysrc': '204',
      'esp-platform': 'pc',
      'requestsource': 'PC'
    }

    const params = {
      amount: 0,
      buyType: 1
    }

    try {
      // 使用 httpClient 发送 GET 请求
      const [ok, res] = await this.client.get({
        url: API_URLS.WALLET_LIST,
        params,
        headers,
        cookies
      })

      if (!ok) {
        console.error(`UID ${user.UID} 余额请求失败:`, res?.error)
        return { UID: String(user.UID), 余额: '--' }
      }

      const walletList = res?.data?.walletList
      if (Array.isArray(walletList) && walletList.length > 0) {
        const totalAmount = walletList[0].totalAmount
        // 转换为元，保留2位小数
        const balance = (totalAmount / 1000).toFixed(2)
        return { UID: String(user.UID), 余额: balance }
      }

      return { UID: String(user.UID), 余额: '0.00' }
    } catch (error) {
      console.error(`UID ${user.UID} 余额处理异常:`, error)
      return { UID: String(user.UID), 余额: '--' }
    }
  }

  // 获取所有用户的余额，保持传入 users 数组的顺序
  async getAllWalletData(users) {
    // 使用 map + Promise.all 实现并发请求
    const tasks = users.map(user => this.fetchWalletBalance(user))
    const results = await Promise.all(tasks)
    return results
  }
}
