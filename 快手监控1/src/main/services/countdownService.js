import { appStore } from '../db/appStore.js'

export class CountdownService {
  constructor({ usersSvc, ksSvc, roiSvc, send }) {
    this.usersSvc = usersSvc
    this.ksSvc = ksSvc
    this.roiSvc = roiSvc
    this.send = send
    this.refreshIntervalMinutes = 10
    this.nextKuaishouAt = Date.now() + this.refreshIntervalMinutes * 60 * 1000
    this.nextRoiAt = Date.now() + 15 * 1000
    this.lockRoi = false
    this.lockKs = false
    this.timer = null
    this.coldStartDone = false

    // 初始化时加载配置
    this._loadConfig()
  }

  async _loadConfig() {
    const config = await appStore.getSetting('countdown_config', {})
    if (config.refreshIntervalMinutes) this.refreshIntervalMinutes = config.refreshIntervalMinutes
    if (config.nextKuaishouAt) this.nextKuaishouAt = config.nextKuaishouAt
    if (config.nextRoiAt) this.nextRoiAt = config.nextRoiAt
    this._normalize()
  }

  async _save() {
    await appStore.setSetting('countdown_config', {
      refreshIntervalMinutes: this.refreshIntervalMinutes,
      nextKuaishouAt: this.nextKuaishouAt,
      nextRoiAt: this.nextRoiAt
    })
  }

  _normalize() {
    const now = Date.now()
    const roiPeriod = 15 * 1000
    const ksPeriod = this.refreshIntervalMinutes * 60 * 1000
    // ... 保持原有逻辑不变 ...
    if (this.nextRoiAt <= now) {
      const delta = now - this.nextRoiAt
      const rem = roiPeriod - (delta % roiPeriod)
      this.nextRoiAt = now + rem
    }
    if (this.nextKuaishouAt <= now) {
      const delta = now - this.nextKuaishouAt
      const rem = ksPeriod - (delta % ksPeriod)
      this.nextKuaishouAt = now + rem
    }
    this._save()
  }

  start() {
    if (this.timer) clearInterval(this.timer)
    const now = Date.now()
    // 强制重置时间，防止读取旧的过期时间导致狂刷
    this.nextKuaishouAt = now + this.refreshIntervalMinutes * 60 * 1000
    this.nextRoiAt = now + 15 * 1000
    this._save()

    this.timer = setInterval(() => this._tick(), 1000)
    // 启动时先推一次缓存的数据，让界面秒开
    this._pushCachedData()
    this._coldStartFetch()
  }

  // 新增：推送数据库里的缓存数据
  async _pushCachedData() {
    const cachedData = await appStore.getAllUserStats()
    if (cachedData && cachedData.length > 0) {
      // 模拟一个 kuaishou_data 事件，让前端先显示旧数据
      this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: cachedData })
    }
  }

  // ... 其余方法 (setIntervalMinutes, resetRoi 等) 只需要确保调用 this._save() 即可 ...

  setIntervalMinutes(mins) {
    this.refreshIntervalMinutes = mins
    this.nextKuaishouAt = Date.now() + mins * 60 * 1000
    this._save()
    return { interval: mins }
  }

  resetRoi(seconds = 15) {
    const now = Date.now()
    this.nextRoiAt = now + seconds * 1000
    this._save()
    // ... 发送 tick ...
    const remaining = {
      kuaishou: Math.max(0, Math.floor((this.nextKuaishouAt - now) / 1000)),
      roi: Math.max(0, Math.floor((this.nextRoiAt - now) / 1000))
    }
    this.send('countdown_tick', { type: 'countdown_tick', remaining, intervalMinutes: this.refreshIntervalMinutes, triggered: [] })
  }

  resetAfterManualRefresh() {
    const now = Date.now()
    this.nextKuaishouAt = now + this.refreshIntervalMinutes * 60 * 1000
    this.nextRoiAt = now + 15 * 1000
    this._save()
    // ... 发送 tick ...
    const remaining = {
      kuaishou: Math.max(0, Math.floor((this.nextKuaishouAt - now) / 1000)),
      roi: Math.max(0, Math.floor((this.nextRoiAt - now) / 1000))
    }
    this.send('countdown_tick', { type: 'countdown_tick', remaining, intervalMinutes: this.refreshIntervalMinutes, triggered: [] })
  }

  // ...

  getState() {
    const now = Date.now()
    const remKs = Math.max(0, Math.floor((this.nextKuaishouAt - now) / 1000))
    const remRoi = Math.max(0, Math.floor((this.nextRoiAt - now) / 1000))
    return { remaining: { kuaishou: remKs, roi: remRoi }, intervalMinutes: this.refreshIntervalMinutes }
  }

  async _tick(force = false) {
    // ... 保持原有逻辑，只是在 finally 里调用 this._save() ...
    const now = Date.now()
    const remaining = { kuaishou: Math.max(0, Math.floor((this.nextKuaishouAt - now) / 1000)), roi: Math.max(0, Math.floor((this.nextRoiAt - now) / 1000)) }
    const triggered = []

    // ROI Check
    if ((force || now >= this.nextRoiAt) && !this.lockRoi) {
      this.lockRoi = true
      try {
        const users = await this.usersSvc.getAllUsers(false)
        const rois = await this.roiSvc.getAllRoiData(users)
        this.send('roi_data', { type: 'roi_data', status: 'success', data: rois })
      } catch (e) {
        this.send('roi_data', { type: 'roi_data', status: 'error', code: 500, message: String(e?.message || e) })
      } finally {
        this.nextRoiAt = Date.now() + 15 * 1000
        this.lockRoi = false
        this._save()
      }
      triggered.push('roi')
    }

    // Kuaishou Data Check
    if ((force || now >= this.nextKuaishouAt) && !this.lockKs) {
      this.lockKs = true
      try {
        const users = await this.usersSvc.getAllUsers(false)
        const ks = await this.ksSvc.getAllKuaishouData(users)
        this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: ks })
      } catch (e) {
        this.send('kuaishou_data', { type: 'kuaishou_data', status: 'error', code: 500, message: String(e?.message || e) })
      } finally {
        this.nextKuaishouAt = Date.now() + this.refreshIntervalMinutes * 60 * 1000
        this.lockKs = false
        this._save()
      }
      triggered.push('kuaishou')
    }

    this.send('countdown_tick', { type: 'countdown_tick', remaining, intervalMinutes: this.refreshIntervalMinutes, triggered })
  }

  async refreshRoiNow() {
    // ... 保持不变
    if (this.lockRoi) return { status: 'busy' }
    this.lockRoi = true
    try {
      const users = await this.usersSvc.getAllUsers(false)
      const rois = await this.roiSvc.getAllRoiData(users)
      this.send('roi_data', { type: 'roi_data', status: 'success', data: rois })
      return { status: 'ok' }
    } catch (e) {
      this.send('roi_data', { type: 'roi_data', status: 'error', code: 500, message: String(e?.message || e) })
      return { status: 'error' }
    } finally {
      this.lockRoi = false
      this._save()
    }
  }

  async _coldStartFetch() {
    // ... 保持不变
    if (this.coldStartDone) return
    try {
      // ... fetching logic ...
      const users = await this.usersSvc.getAllUsers(false)
      this.send('users_data', { type: 'users_data', status: 'success', data: users })

      // 优先获取 KS 数据
      try {
        const ks = await this.ksSvc.getAllKuaishouData(users)
        this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: ks })
      } catch (e) { console.error(e) }

      try {
        const rois = await this.roiSvc.getAllRoiData(users)
        this.send('roi_data', { type: 'roi_data', status: 'success', data: rois })
      } catch (e) { console.error(e) }

    } finally {
      this.coldStartDone = true
      this._save()
    }
  }

  resume() {
    this._normalize()
    return this.getState()
  }
}
