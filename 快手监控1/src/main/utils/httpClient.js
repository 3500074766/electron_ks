import axios from 'axios'

const DEFAULT_TIMEOUT = 10000
const MAX_RETRIES = 2
const RETRY_DELAY = 200

export class HttpClient {
  constructor(timeout = DEFAULT_TIMEOUT) {
    this.timeout = timeout
    this.instance = axios.create({ timeout })
    this.instance.defaults.headers['Content-Type'] = 'application/json'
    this.instance.defaults.headers['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
  }

  async post({ url, data, headers, cookies, maxRetries = MAX_RETRIES }) {
    let attempt = 0
    while (attempt <= maxRetries) {
      try {
        const res = await this.instance.post(url, data, {
          headers,
          withCredentials: !!cookies,
          ...(cookies ? { headers: { ...(headers || {}), Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') } } : {})
        })
        return [true, res.data]
      } catch (e) {
        attempt++
        if (attempt > maxRetries) return [false, { error: `请求错误: ${e?.message || e}` }]
        await new Promise(r => setTimeout(r, RETRY_DELAY))
      }
    }
  }

  async get({ url, params, headers, cookies, maxRetries = MAX_RETRIES }) {
    let attempt = 0
    while (attempt <= maxRetries) {
      try {
        const res = await this.instance.get(url, { params, headers, withCredentials: !!cookies })
        return [true, res.data]
      } catch (e) {
        attempt++
        if (attempt > maxRetries) return [false, { error: `请求错误: ${e?.message || e}` }]
        await new Promise(r => setTimeout(r, RETRY_DELAY))
      }
    }
  }
}

export const httpClient = new HttpClient()
