import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'

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
    this.configPath = join(app.getPath('userData'), 'countdown.json')
    this.coldStartDone = false
    this._load()
    this._normalize()
  }
  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const d = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        this.refreshIntervalMinutes = d.refreshIntervalMinutes ?? this.refreshIntervalMinutes
        this.nextKuaishouAt = d.nextKuaishouAt ?? this.nextKuaishouAt
        this.nextRoiAt = d.nextRoiAt ?? this.nextRoiAt
        this.coldStartDone = !!d.coldStartDone
      }
    } catch { }
  }
  _save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({ refreshIntervalMinutes: this.refreshIntervalMinutes, nextKuaishouAt: this.nextKuaishouAt, nextRoiAt: this.nextRoiAt, coldStartDone: this.coldStartDone }), 'utf-8')
    } catch { }
  }
  _normalize() {
    const now = Date.now()
    const roiPeriod = 15 * 1000
    const ksPeriod = this.refreshIntervalMinutes * 60 * 1000
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
    this.nextKuaishouAt = now + this.refreshIntervalMinutes * 60 * 1000
    this.nextRoiAt = now + 15 * 1000
    this.coldStartDone = false
    this._save()
    this.timer = setInterval(() => this._tick(), 1000)
    this._coldStartFetch()
  }
  setIntervalMinutes(mins) {
    this.refreshIntervalMinutes = mins
    this.nextKuaishouAt = Date.now() + mins * 60 * 1000
    this._save()
    return { interval: mins }
  }
  resetRoiCountdown(minutes = 2) {
    const ms = Math.max(0, Number(minutes)) * 60 * 1000
    this.nextRoiAt = Date.now() + ms
    this._save()
    return { roiNextInMs: ms }
  }
  async refreshRoiNow() {
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
  resetRoi(seconds = 15) {
    const now = Date.now()
    this.nextRoiAt = now + seconds * 1000
    this._save()
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
    const remaining = {
      kuaishou: Math.max(0, Math.floor((this.nextKuaishouAt - now) / 1000)),
      roi: Math.max(0, Math.floor((this.nextRoiAt - now) / 1000))
    }
    this.send('countdown_tick', { type: 'countdown_tick', remaining, intervalMinutes: this.refreshIntervalMinutes, triggered: [] })
  }
  resume() {
    this._normalize()
    const s = this.getState()
    return s
  }
  async _coldStartFetch() {
    if (this.coldStartDone) return
    try {
      const users = await this.usersSvc.getAllUsers(false)
      this.send('users_data', { type: 'users_data', status: 'success', data: users })
      if (Array.isArray(users) && users.length > 0) {
        try {
          const ks = await this.ksSvc.getAllKuaishouData(users)
          this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: ks })
        } catch (e) {
          this.send('kuaishou_data', { type: 'kuaishou_data', status: 'error', code: 500, message: String(e?.message || e) })
        }
        try {
          const rois = await this.roiSvc.getAllRoiData(users)
          this.send('roi_data', { type: 'roi_data', status: 'success', data: rois })
        } catch (e) {
          this.send('roi_data', { type: 'roi_data', status: 'error', code: 500, message: String(e?.message || e) })
        }
      }
    } finally {
      this.coldStartDone = true
      this._save()
    }
  }
  getState() {
    const now = Date.now()
    const remKs = Math.max(0, Math.floor((this.nextKuaishouAt - now) / 1000))
    const remRoi = Math.max(0, Math.floor((this.nextRoiAt - now) / 1000))
    return { remaining: { kuaishou: remKs, roi: remRoi }, intervalMinutes: this.refreshIntervalMinutes }
  }
  async _tick(force = false) {
    const now = Date.now()
    const remaining = { kuaishou: Math.max(0, Math.floor((this.nextKuaishouAt - now) / 1000)), roi: Math.max(0, Math.floor((this.nextRoiAt - now) / 1000)) }
    const triggered = []
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
}
