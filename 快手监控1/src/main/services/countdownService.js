import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'

export class CountdownService {
  constructor({ usersSvc, ksSvc, roiSvc, walletSvc, autoRoiSvc, send }) {
    this.usersSvc = usersSvc
    this.ksSvc = ksSvc
    this.roiSvc = roiSvc
    this.walletSvc = walletSvc
    this.autoRoiSvc = autoRoiSvc // Injected AutoRoiService
    this.send = send

    // 默认 10 分钟
    this.refreshIntervalMinutes = 10
    // 初始目标时间
    this.nextRefreshAt = 0

    this.isUpdating = false
    this.timer = null
    this.configPath = join(app.getPath('userData'), 'countdown.json')
    this.coldStartDone = false

    this._load()
    this._normalize()
  }

  // 加载配置
  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const d = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        let savedInterval = Number(d.refreshIntervalMinutes)
        if (isNaN(savedInterval) || savedInterval < 1) savedInterval = 10
        this.refreshIntervalMinutes = savedInterval
        this.nextRefreshAt = 0
        this.coldStartDone = false
      }
    } catch { }
  }

  _save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({
        refreshIntervalMinutes: this.refreshIntervalMinutes,
        nextRefreshAt: this.nextRefreshAt,
        coldStartDone: this.coldStartDone
      }), 'utf-8')
    } catch { }
  }

  _normalize() {
    const now = Date.now()
    const safeMins = Math.max(1, this.refreshIntervalMinutes || 10)
    if (!this.nextRefreshAt || isNaN(this.nextRefreshAt) || this.nextRefreshAt <= now) {
      this.refreshIntervalMinutes = safeMins
      this.nextRefreshAt = now + safeMins * 60 * 1000
    }
    this._save()
  }

  start() {
    if (this.timer) clearInterval(this.timer)
    this._normalize()
    this._broadcastTick()
    this.timer = setInterval(() => this._tick(), 1000)
    this._coldStartFetch()
  }

  setIntervalMinutes(mins) {
    let safeMins = Number(mins)
    if (isNaN(safeMins) || safeMins < 1) safeMins = 10
    this.refreshIntervalMinutes = safeMins
    this.nextRefreshAt = Date.now() + safeMins * 60 * 1000
    this._save()
    this._broadcastTick()
    return { interval: safeMins }
  }

  resume() {
    this._normalize()
    return this.getState()
  }

  async _coldStartFetch() {
    if (this.coldStartDone) return
    try {
      const users = await this.usersSvc.getAllUsers(false)
      this.send('users_data', { type: 'users_data', status: 'success', data: users })

      if (Array.isArray(users) && users.length > 0) {
        // Cold start doesn't trigger Auto ROI adjust
        const p1 = this.ksSvc.getAllKuaishouData(users).then(ks =>
          this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: ks, trigger: 'auto' })
        )
        const p2 = this.roiSvc.getAllRoiData(users).then(rois =>
          this.send('roi_data', { type: 'roi_data', status: 'success', data: rois, trigger: 'auto' })
        )
        const p3 = this.walletSvc ? this.walletSvc.getAllWalletData(users).then(wallets =>
          this.send('wallet_data', { type: 'wallet_data', status: 'success', data: wallets, trigger: 'auto' })
        ) : Promise.resolve()

        await Promise.allSettled([p1, p2, p3])
      }
    } catch (e) {
      console.error("Cold start fetch failed", e)
    } finally {
      this.coldStartDone = true
      this._save()
    }
  }

  getState() {
    const now = Date.now()
    let target = this.nextRefreshAt
    if (!target || isNaN(target)) {
      target = now + (this.refreshIntervalMinutes || 10) * 60 * 1000
    }
    const remaining = Math.max(0, Math.floor((target - now) / 1000))
    return { remaining, intervalMinutes: this.refreshIntervalMinutes }
  }

  _broadcastTick(triggered = []) {
    const state = this.getState()
    this.send('countdown_tick', {
      type: 'countdown_tick',
      remaining: state.remaining,
      intervalMinutes: this.refreshIntervalMinutes,
      triggered
    })
  }

  // Helper to refresh only ROI and Wallet
  async _refreshRoiAndWallet() {
    try {
      console.log('[Countdown] Refreshing ROI and Wallet after modifications...')
      const users = await this.usersSvc.getAllUsers(false)
      const [rois, wallets] = await Promise.all([
        this.roiSvc.getAllRoiData(users),
        this.walletSvc ? this.walletSvc.getAllWalletData(users) : Promise.resolve([])
      ])

      this.send('roi_data', { type: 'roi_data', status: 'success', data: rois, trigger: 'auto_refresh' })
      if (this.walletSvc) {
        this.send('wallet_data', { type: 'wallet_data', status: 'success', data: wallets, trigger: 'auto_refresh' })
      }
    } catch (e) {
      console.error('[Countdown] Failed to refresh ROI/Wallet:', e)
    }
  }

  async _tick(force = false) {
    const now = Date.now()
    const triggered = []

    if ((force || now >= this.nextRefreshAt) && !this.isUpdating) {
      this.isUpdating = true
      try {
        let fetchedKsData = []
        let fetchedRoiData = []

        const updateTask = async () => {
          const users = await this.usersSvc.getAllUsers(false)

          // Execute fetches
          const [ksResult, roiResult, walletResult] = await Promise.allSettled([
            this.ksSvc.getAllKuaishouData(users),
            this.roiSvc.getAllRoiData(users),
            this.walletSvc ? this.walletSvc.getAllWalletData(users) : Promise.resolve([])
          ])

          // Handle KS Data
          if (ksResult.status === 'fulfilled') {
            fetchedKsData = ksResult.value
            this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: fetchedKsData, trigger: 'auto' })
          } else {
            this.send('kuaishou_data', { type: 'kuaishou_data', status: 'error', code: 500, message: String(ksResult.reason) })
          }

          // Handle ROI Data
          if (roiResult.status === 'fulfilled') {
            fetchedRoiData = roiResult.value
            this.send('roi_data', { type: 'roi_data', status: 'success', data: fetchedRoiData, trigger: 'auto' })
          } else {
            this.send('roi_data', { type: 'roi_data', status: 'error', code: 500, message: String(roiResult.reason) })
          }

          // Handle Wallet Data
          if (walletResult.status === 'fulfilled') {
            this.send('wallet_data', { type: 'wallet_data', status: 'success', data: walletResult.value, trigger: 'auto' })
          }
        }

        const timeoutTask = new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), 45000))

        await Promise.race([updateTask(), timeoutTask])

        triggered.push('all')

        // --- Trigger Auto ROI Adjustment if we have valid data ---
        if (this.autoRoiSvc && fetchedKsData.length > 0 && fetchedRoiData.length > 0) {
          // Await the adjustment completion and check if any updates occurred
          const hasUpdates = await this.autoRoiSvc.checkAndAdjust(fetchedKsData, fetchedRoiData)

          if (hasUpdates) {
            // If updates happened, fetch fresh ROI and Wallet data (bulk)
            await this._refreshRoiAndWallet()
          }
        }

      } catch (e) {
        console.error("Auto refresh failed", e)
      } finally {
        this.nextRefreshAt = Date.now() + this.refreshIntervalMinutes * 60 * 1000
        this.isUpdating = false
        this._save()
        this._broadcastTick()
      }
    } else {
      this._broadcastTick()
    }
  }

  async refreshRoiNow() { return { status: 'ok' } }
  resetRoi(seconds) { }
}
