import { HttpClient, httpClient } from '../utils/httpClient.js'
import { OverviewRepo } from '../utils/overviewRepo.js'

const API_URLS = {
  OVERVIEW: 'https://niu.e.kuaishou.com/rest/esp/report/effect/overview'
}

export class KuaishouService {
  constructor() {
    this.repo = new OverviewRepo()
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
      selectors: [{ name: 'promotionType', values: [1] }, { name: 'sceneOrientedType', values: [21] }],
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
    const result = await this._getOverview(ck)
    const dataNode = typeof result?.data === 'object' && result?.data?.data ? result.data.data : result?.data
    if (!dataNode || !Array.isArray(dataNode?.overview)) return null
    const overview = dataNode.overview
    let { gmv, orders, spend, globalRoi } = this._pickItems(overview)
    if (!spend) return null
    let retry = 0
    while (retry < 5 && spend?.value === 0) {
      const r = await this._getOverview(ck)
      const dn = typeof r?.data === 'object' && r?.data?.data ? r.data.data : r?.data
      if (!dn || !Array.isArray(dn?.overview)) break
      const o = dn.overview
        ; ({ gmv, orders, spend, globalRoi } = this._pickItems(o))
      retry++
      await new Promise(rs => setTimeout(rs, 1000))
    }
    const spendValue = spend?.value || 0
    const currentSpend = Math.round((spendValue / 1000) * 100) / 100
    const gmvValue = gmv?.value || 0
    const currentGmv = Math.round((gmvValue / 1000) * 100) / 100
    const orderCountValue = orders?.value || 0
    const currentOrderCount = Math.trunc(orderCountValue)
    const globalRoiValue = globalRoi?.value || 0
    const currentGlobalRoi = Math.round(globalRoiValue * 100) / 100
    const lastSpendValue = this.repo.getLastSpend(user.UID)
    const lastSpend = Math.round((lastSpendValue / 1000) * 100) / 100

    // 修改处：将 const 改为 let，并添加负数修正逻辑
    let changeValue = lastSpendValue > 0 ? Math.round(((spendValue / 1000 - lastSpendValue / 1000)) * 100) / 100 : '--'

    // 逻辑：如果计算出的消耗为负数（说明发生了0点重置），则使用当前累计花费作为消耗值
    if (typeof changeValue === 'number' && changeValue < 0) {
      changeValue = currentSpend
    }

    const itemsToSave = overview.map(it => ({ name: it?.name || '', value: it?.value || 0, unit: it?.unit || '' }))
    this.repo.save(user.UID, itemsToSave)
    const timeStr = new Date().toLocaleTimeString()
    return {
      UID: String(user.UID),
      名称: user.名称,
      头像: user.头像,
      消耗: changeValue,
      上次花费: lastSpend,
      花费: currentSpend,
      GMV: currentGmv,
      订单数: currentOrderCount,
      全站ROI: currentGlobalRoi,
      时间: timeStr,
      ck: user.ck
    }
  }

  async getAllKuaishouData(users) {
    const tasks = users.map(u => this.processUser(u))
    const results = await Promise.all(tasks)
    const filtered = results.filter(Boolean)
    const ordered = []
    users.forEach(user => { const item = filtered.find(d => d.UID === user.UID); if (item) ordered.push(item) })
    return ordered
  }
}
