import { HttpClient, httpClient } from '../utils/httpClient.js'

const API_URLS = {
  CONTROL_PANEL_SEARCH: 'https://niu.e.kuaishou.com/rest/esp/control-panel/report/search',
  CAMPAIGN_UPDATE_BID: 'https://niu.e.kuaishou.com/rest/esp/promotion/hosting/campaign/update/bid'
}

export class RoiService {
  constructor() { this.client = httpClient || new HttpClient() }

  _parseCookieToDict(cookieStr) {
    const dict = {}
    if (!cookieStr) return dict
    cookieStr.split(';').forEach(item => { const [k, v] = item.trim().split('='); if (k) dict[k] = v })
    return dict
  }

  async fetchTargetInfo(user) {
    const cookies = this._parseCookieToDict(user.ck)
    const now = new Date()
    const payload = {
      searchParam: {
        sceneOrientedTypes: [21],
        startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
        frozen: 0,
        searchLevel: 1,
        endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime(),
        status: { campaign: { value: [] }, creative: { value: [] } },
        campaignType: 14,
        sourceBiz: 'storeWideLiveNew',
        campaignIds: [],
        name: '',
        campaignRelType: 1
      },
      pageInfo: { pageNum: 1, pageSize: 5, totalCount: 0 }
    }
    const headers = {
      accept: 'application/json,*/*',
      'content-type': 'application/json',
      'esp-entrysrc': '204',
      'esp-platform': 'pc'
    }
    const [ok, resp] = await this.client.post({ url: API_URLS.CONTROL_PANEL_SEARCH, headers, cookies, data: payload })
    if (!ok) return { target_id: null, roi_ratio: undefined }
    const list = resp?.data?.data
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0]
      return { target_id: String(first?.targetId || ''), roi_ratio: first?.roiRatio }
    }
    return { target_id: null, roi_ratio: undefined }
  }

  async getAllRoiData(users) {
    const tasks = users.map(async user => {
      const info = await this.fetchTargetInfo(user)
      return { UID: String(user.UID), 名称: user.名称, target_id: info.target_id, roi: info.roi_ratio }
    })
    return Promise.all(tasks)
  }

  async updateRoi({ uid, target_id, roi_ratio }, userResolver) {
    const user = await userResolver(uid)
    if (!user) throw new Error(`未找到UID为 ${uid} 的用户`)
    const cookies = this._parseCookieToDict(user.ck)
    const timestamp = Date.now()
    const headers = {
      accept: 'application/json,*/*',
      'content-type': 'application/json',
      'esp-entrysrc': '204',
      'esp-platform': 'pc',
      stamp: String(timestamp)
    }
    const data = { campaignId: String(target_id), roiRatio: Number(roi_ratio) }
    const [ok, result] = await this.client.post({ url: API_URLS.CAMPAIGN_UPDATE_BID, headers, cookies, data })
    if (!ok) throw new Error(`更新ROI请求失败: ${result?.error || ''}`)
    const isSuccess = typeof result === 'object' ? (result.success || result.code === 0 || !result.error) : false
    if (!isSuccess) throw new Error(`更新ROI失败，快手API返回错误`)
    return result
  }
}
