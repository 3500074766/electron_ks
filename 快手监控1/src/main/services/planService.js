import { HttpClient, httpClient } from '../utils/httpClient.js'

const API_URL = "https://niu.e.kuaishou.com/rest/esp/operation/v1/query?kuaishou.ad.esp_ph=c39e7b7c89f3f3784d6956af27cf4cb93a1f"

export class PlanService {
  constructor() {
    this.client = httpClient || new HttpClient()
  }

  _parseCookieToDict(cookieStr) {
    const dict = {}
    if (!cookieStr) return dict
    cookieStr.split(';').forEach(item => {
      const [k, v] = item.trim().split('=')
      if (k) dict[k] = v
    })
    return dict
  }

  _formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  async fetchPlanModifyRecords(user, targetId) {
    if (!targetId) return []

    // 1. 计算日期：今天和明天
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const beginTime = this._formatDate(today)
    const endTime = this._formatDate(tomorrow)

    // 2. 构造 Payload
    const payload = {
      operationTarget: 0,
      operationType: 0,
      roleType: 0,
      pageInfo: {
        currentPage: 1,
        pageSize: 10,
        totalCount: 0
      },
      pageNum: 1,
      pageSize: 50, // 获取足够多，然后前端只取前3
      operationTargetId: String(targetId),
      beginTime: beginTime,
      endTime: endTime
    }

    // 3. 构造 Headers & Cookies
    const cookies = this._parseCookieToDict(user.ck)
    const headers = {
      "accept": "application/json,*/*",
      "accept-language": "zh-CN,zh;q=0.9",
      "content-type": "application/json",
      "Referer": "https://niu.e.kuaishou.com/storeManage?sceneOrientedType=21"
      // User-Agent 已经在 HttpClient 中默认设置
    }

    try {
      // 4. 发送请求
      const [ok, response] = await this.client.post({
        url: API_URL,
        data: payload,
        headers,
        cookies
      })

      if (!ok) {
        throw new Error(response?.error || '网络请求失败')
      }

      if (response.result !== 1) {
        // 如果 API 返回业务错误 (result !== 1)，通常 msg 里有原因
        // 这里只是记录日志，返回空数组，避免阻塞 UI
        console.warn(`[PlanService] API Error for ${user.UID}: ${response.msg}`)
        return []
      }

      const records = response.data?.record || []

      // 5. 数据处理：截取前3条并格式化
      const topThree = records.slice(0, 3).map(item => {
        // 解析时间戳
        const timeStr = new Date(item.time).toLocaleString('zh-CN', { hour12: false })

        // 获取字段变更详情 (取 fieldView 数组的第一项)
        const fieldInfo = item.fieldView && item.fieldView.length > 0 ? item.fieldView[0] : {}

        return {
          time: timeStr,
          event: fieldInfo.fieldName || '未知操作',
          original: fieldInfo.originalData !== undefined ? String(fieldInfo.originalData) : '-',
          updated: fieldInfo.updatedData !== undefined ? String(fieldInfo.updatedData) : '-'
        }
      })

      return topThree

    } catch (error) {
      console.error(`[PlanService] Request failed for ${user.UID}:`, error.message)
      return []
    }
  }
}
