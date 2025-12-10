import { HttpClient, httpClient } from '../utils/httpClient.js'
// 引入新的数据库管理器
import { appStore } from '../db/appStore.js'

const API_URLS = {
  OVERVIEW: 'https://niu.e.kuaishou.com/rest/esp/report/effect/overview'
}

export class KuaishouService {
  constructor() {
    this.client = httpClient || new HttpClient()
  }

  async _getOverview(ck) {
    const nowMs = Date.now()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const payload = {
      sourceBiz: 'storeWideLiveNew',
      startTime: today.getTime(),
      endTime: nowMs,
      viewType: 1,
      groupType: 2,
      selectors: [ { name: 'promotionType', values: [1] }, { name: 'sceneOrientedType', values: [21] } ],
      searchAd: false
    }
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', cookie: ck }
    const [ok, res] = await this.client.post({ url: API_URLS.OVERVIEW, data: payload, headers })
    if (!ok) throw new Error(res?.error || '概览请求失败')
    return res
  }

  _pickItems(overview) {
    const pick = (name) => overview.find(i => i?.name === name)
    const gmv = pick('全站GMV')
    const orders = pick('全站当日累计订单数')
    const spend = pick('花费')
    const globalRoi = pick('全站ROI')
    return { gmv, orders, spend, globalRoi }
  }

  async processUser(user) {
    const ck = user.ck
    if (!ck) return null

    // 1. 获取 API 数据
    const result = await this._getOverview(ck)
    const dataNode = typeof result?.data === 'object' && result?.data?.data ? result.data.data : result?.data
    if (!dataNode || !Array.isArray(dataNode?.overview)) return null
    const overview = dataNode.overview

    let { gmv, orders, spend, globalRoi } = this._pickItems(overview)
    if (!spend) return null

    // 简单重试逻辑 (保持原有逻辑)
    let retry = 0
    while (retry < 5 && spend?.value === 0) {
      const r = await this._getOverview(ck)
      const dn = typeof r?.data === 'object' && r?.data?.data ? r.data.data : r?.data
      if (!dn || !Array.isArray(dn?.overview)) break
      const o = dn.overview
      ;({ gmv, orders, spend, globalRoi } = this._pickItems(o))
      retry++
      await new Promise(rs => setTimeout(rs, 1000))
    }

    // 2. 数据处理
    const currentSpend = Math.round((spend?.value || 0) / 1000 * 100) / 100
    const currentGmv = Math.round((gmv?.value || 0) / 1000 * 100) / 100
    const currentOrderCount = Math.trunc(orders?.value || 0)
    const currentGlobalRoi = Math.round((globalRoi?.value || 0) * 100) / 100

    // 3. 从新数据库获取上次花费
    const lastSpend = await appStore.getLastSpend(user.UID)
    const changeValue = lastSpend > 0 ? Math.round((currentSpend - lastSpend) * 100) / 100 : '--'

    // 4. 构建要保存的数据对象 (这里就是 data 字段的内容)
    const statsData = {
      花费: currentSpend, // 保存当前值作为下次的"上次花费"
      上次花费: lastSpend, // 用于前端展示
      消耗: changeValue,
      GMV: currentGmv,
      订单数: currentOrderCount,
      全站ROI: currentGlobalRoi,
      时间: new Date().toLocaleTimeString(),
      // 可以在这里加任何你想存的字段，比如:
      // items: overview
    }

    // 5. 存入新数据库
    await appStore.saveUserStats(user.UID, user.名称, statsData)

    // 6. 返回完整数据给前端
    return {
      UID: String(user.UID),
      名称: user.名称,
      头像: user.头像,
      ck: user.ck,
      ...statsData
    }
  }

  async getAllKuaishouData(users) {
    const tasks = users.map(u => this.processUser(u))
    const results = await Promise.all(tasks)
    const filtered = results.filter(Boolean)
    // 这里其实不需要再做复杂的合并，因为 processUser 已经返回了完整数据
    return filtered
  }
}
