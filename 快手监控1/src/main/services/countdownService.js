import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'

export class CountdownService {
  constructor({ usersSvc, ksSvc, roiSvc, walletSvc, send }) {
    this.usersSvc = usersSvc
    this.ksSvc = ksSvc
    this.roiSvc = roiSvc
    this.walletSvc = walletSvc
    this.send = send

    // 默认 10 分钟
    this.refreshIntervalMinutes = 10
    // 初始目标时间（稍后在 _normalize 中会被重置）
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

        // 1. 只加载间隔配置
        let savedInterval = Number(d.refreshIntervalMinutes)
        if (isNaN(savedInterval) || savedInterval < 1) savedInterval = 10
        this.refreshIntervalMinutes = savedInterval

        // 2. 核心修改：强制重置时间，不读取存档的 nextRefreshAt
        // 这解决了 "启动时显示 3:22" 的问题，确保每次启动都是满额倒计时
        this.nextRefreshAt = 0

        // 3. 强制重置冷启动状态，确保启动时立即拉取一次数据
        this.coldStartDone = false
      }
    } catch { }
  }

  // 保存配置 (虽然我们保存了 nextRefreshAt，但在 _load 里我们选择忽略它，以保证启动重置)
  _save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({
        refreshIntervalMinutes: this.refreshIntervalMinutes,
        nextRefreshAt: this.nextRefreshAt,
        coldStartDone: this.coldStartDone
      }), 'utf-8')
    } catch { }
  }

  // 规范化时间：如果时间无效或已过期，重置为【当前时间 + 间隔】
  _normalize() {
    const now = Date.now()
    const safeMins = Math.max(1, this.refreshIntervalMinutes || 10)

    // 启动时 this.nextRefreshAt 被 _load 设为 0，这里一定会触发重置
    if (!this.nextRefreshAt || isNaN(this.nextRefreshAt) || this.nextRefreshAt <= now) {
      this.refreshIntervalMinutes = safeMins
      this.nextRefreshAt = now + safeMins * 60 * 1000
    }
    this._save()
  }

  start() {
    if (this.timer) clearInterval(this.timer)

    // 再次校验并重置时间
    this._normalize()

    // 立即广播一次状态，让前端显示出来
    this._broadcastTick()

    // 开启每秒心跳，即使最小化也会继续运行（Electron主进程特性）
    this.timer = setInterval(() => this._tick(), 1000)

    // 冷启动：立即拉取所有数据
    this._coldStartFetch()
  }

  // 设置间隔
  setIntervalMinutes(mins) {
    let safeMins = Number(mins)
    // 强制修正非法值
    if (isNaN(safeMins) || safeMins < 1) safeMins = 10

    this.refreshIntervalMinutes = safeMins

    // 修改间隔后，立即重置倒计时（从现在开始 + 新间隔）
    this.nextRefreshAt = Date.now() + safeMins * 60 * 1000

    this._save()

    // 立即广播新状态
    this._broadcastTick()

    return { interval: safeMins }
  }

  resume() {
    this._normalize()
    return this.getState()
  }

  // 冷启动数据拉取
  async _coldStartFetch() {
    if (this.coldStartDone) return
    try {
      const fetchPromise = (async () => {
          const users = await this.usersSvc.getAllUsers(false)
          this.send('users_data', { type: 'users_data', status: 'success', data: users })

          if (Array.isArray(users) && users.length > 0) {
            const p1 = this.ksSvc.getAllKuaishouData(users).then(ks =>
              this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: ks, trigger: 'auto' })
            ).catch(e =>
              this.send('kuaishou_data', { type: 'kuaishou_data', status: 'error', code: 500, message: String(e?.message || e) })
            )

            const p2 = this.roiSvc.getAllRoiData(users).then(rois =>
              this.send('roi_data', { type: 'roi_data', status: 'success', data: rois, trigger: 'auto' })
            ).catch(e =>
              this.send('roi_data', { type: 'roi_data', status: 'error', code: 500, message: String(e?.message || e) })
            )

            const p3 = this.walletSvc ? this.walletSvc.getAllWalletData(users).then(wallets =>
              this.send('wallet_data', { type: 'wallet_data', status: 'success', data: wallets, trigger: 'auto' })
            ).catch(e =>
              this.send('wallet_data', { type: 'wallet_data', status: 'error', code: 500, message: String(e?.message || e) })
            ) : Promise.resolve()

            await Promise.allSettled([p1, p2, p3])
          }
      })()

      // 60秒超时保护
      await Promise.race([
        fetchPromise,
        new Promise(resolve => setTimeout(resolve, 60000))
      ])

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
    // 容错：防止计算出 NaN
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

  async _tick(force = false) {
    const now = Date.now()
    const triggered = []

    if ((force || now >= this.nextRefreshAt) && !this.isUpdating) {
      this.isUpdating = true
      try {
        const updateTask = async () => {
            const users = await this.usersSvc.getAllUsers(false)
            // 自动刷新带 trigger: 'auto' 标记，前端根据此更新时间
            const p1 = this.ksSvc.getAllKuaishouData(users).then(ks =>
              this.send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: ks, trigger: 'auto' })
            ).catch(e =>
              this.send('kuaishou_data', { type: 'kuaishou_data', status: 'error', code: 500, message: String(e?.message || e) })
            )
            const p2 = this.roiSvc.getAllRoiData(users).then(rois =>
              this.send('roi_data', { type: 'roi_data', status: 'success', data: rois, trigger: 'auto' })
            ).catch(e =>
              this.send('roi_data', { type: 'roi_data', status: 'error', code: 500, message: String(e?.message || e) })
            )
            const p3 = this.walletSvc ? this.walletSvc.getAllWalletData(users).then(wallets =>
              this.send('wallet_data', { type: 'wallet_data', status: 'success', data: wallets, trigger: 'auto' })
            ).catch(e =>
              this.send('wallet_data', { type: 'wallet_data', status: 'error', code: 500, message: String(e?.message || e) })
            ) : Promise.resolve()

            await Promise.allSettled([p1, p2, p3])
        }

        // 45秒超时保护
        const timeoutTask = new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), 45000))

        await Promise.race([updateTask(), timeoutTask])
        triggered.push('all')

      } catch (e) {
        console.error("Auto refresh failed", e)
      } finally {
        // 重置下一次刷新时间
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
