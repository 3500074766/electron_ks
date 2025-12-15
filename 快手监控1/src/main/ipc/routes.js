import { ipcMain } from 'electron'
import { UserService } from '../services/userService.js'
import { KuaishouService } from '../services/kuaishouService.js'
import { RoiService } from '../services/roiService.js'
import { CountdownService } from '../services/countdownService.js'
import { WalletService } from '../services/walletService.js'
import { RechargeService } from '../services/rechargeService.js'
import { PlanService } from '../services/planService.js'
import { AutoRoiService } from '../services/autoRoiService.js'
import { NotificationService } from '../services/notificationService.js'

export function registerIPC(mainWindow) {
  const send = (channel, payload) => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.webContents.send(channel, payload) } }

  const usersSvc = new UserService()
  const ksSvc = new KuaishouService()
  const roiSvc = new RoiService()
  const walletSvc = new WalletService()
  const rechargeSvc = new RechargeService(mainWindow)
  const planSvc = new PlanService()
  const autoRoiSvc = new AutoRoiService({ roiSvc, usersSvc, send })

  // [修改] 将 rechargeSvc 注入到 NotificationService
  const notifySvc = new NotificationService({ rechargeSvc })

  const cdSvc = new CountdownService({ usersSvc, ksSvc, roiSvc, walletSvc, autoRoiSvc, notifySvc, send })

  mainWindow.webContents.on('did-finish-load', () => {
    send('connection_established', { type: 'connection_established', status: 'success' })
    cdSvc.start()
  })

  // ... 现有的路由 ...

  ipcMain.handle('get_all_kuaishou_data', async () => {
    try {
      const users = await usersSvc.getAllUsers()
      const ks = await ksSvc.getAllKuaishouData(users)
      const data = { type: 'kuaishou_data', status: 'success', data: ks }
      send('kuaishou_data', data)
      return data
    } catch (e) {
      const err = { type: 'kuaishou_data', status: 'error', code: 500, message: String(e?.message || e) }
      send('kuaishou_data', err)
      return err
    }
  })

  ipcMain.handle('get_all_roi_data', async () => {
    try {
      const users = await usersSvc.getAllUsers(false)
      const rois = await roiSvc.getAllRoiData(users)
      const data = { type: 'roi_data', status: 'success', data: rois }
      send('roi_data', data)
      return data
    } catch (e) {
      const err = { type: 'roi_data', status: 'error', code: 500, message: String(e?.message || e) }
      send('roi_data', err)
      return err
    }
  })

  ipcMain.handle('get_all_wallet_data', async () => {
    try {
      const users = await usersSvc.getAllUsers(false)
      const wallets = await walletSvc.getAllWalletData(users)
      const data = { type: 'wallet_data', status: 'success', data: wallets }
      send('wallet_data', data)
      return data
    } catch (e) {
      const err = { type: 'wallet_data', status: 'error', code: 500, message: String(e?.message || e) }
      send('wallet_data', err)
      return err
    }
  })

  ipcMain.handle('refresh_data', async () => {
    try {
      const users = await usersSvc.getAllUsers(false)
      send('users_data', { type: 'users_data', status: 'success', data: users })
      const [rois, wallets] = await Promise.all([
        roiSvc.getAllRoiData(users),
        walletSvc.getAllWalletData(users)
      ])
      send('roi_data', { type: 'roi_data', status: 'success', data: rois, trigger: 'manual' })
      send('wallet_data', { type: 'wallet_data', status: 'success', data: wallets, trigger: 'manual' })
      return { type: 'refresh_data', status: 'success' }
    } catch (e) {
      const err = { type: 'error', status: 'error', code: 500, message: String(e?.message || e) }
      send('error', err)
      return err
    }
  })

  ipcMain.handle('update_interval', async (_event, payload) => {
    const r = cdSvc.setIntervalMinutes(Number(payload?.interval || 10))
    return { type: 'interval_updated', status: 'success', interval: r.interval }
  })

  ipcMain.handle('update_roi', async (_event, payload) => {
    try {
      const result = await roiSvc.updateRoi(payload, async (uid) => usersSvc.getUserByUid(uid))
      const res = { type: 'update_roi_result', status: 'success', message: 'ROI更新成功', data: result }
      send('update_roi_result', res)
      await cdSvc.refreshRoiNow()
      cdSvc.resetRoi(15)
      return res
    } catch (e) {
      const err = { type: 'update_roi_result', status: 'error', message: String(e?.message || e) }
      send('update_roi_result', err)
      return err
    }
  })

  ipcMain.handle('get_countdown_state', async () => {
    return { type: 'countdown_state', status: 'success', data: cdSvc.getState() }
  })

  ipcMain.handle('resume_countdown', async () => {
    const s = cdSvc.resume()
    return { type: 'countdown_state', status: 'success', data: s }
  })

  ipcMain.handle('reset_roi_countdown', async () => {
    cdSvc.resetRoi(15)
    return { type: 'countdown_state', status: 'success', data: cdSvc.getState() }
  })

  ipcMain.handle('create_recharge', async (_event, payload) => {
    try {
      const { uid, amount } = payload
      const user = await usersSvc.getUserByUid(uid)
      if (!user) throw new Error('用户不存在')
      const result = await rechargeSvc.initiateRecharge(user, amount)
      return { status: 'success', data: result }
    } catch (e) {
      return { status: 'error', message: e.message || '充值发起失败' }
    }
  })

  ipcMain.handle('get_plan_records', async (_event, payload) => {
    try {
      const { uid, target_id } = payload
      const user = await usersSvc.getUserByUid(uid)
      if (!user) throw new Error('用户不存在')
      const records = await planSvc.fetchPlanModifyRecords(user, target_id)
      return { status: 'success', data: records }
    } catch (e) {
      return { status: 'error', message: e.message || '获取记录失败' }
    }
  })

  // Auto ROI Routes
  ipcMain.handle('get_auto_roi_status', async () => {
    return { status: 'success', data: autoRoiSvc.getStatus() }
  })

  ipcMain.handle('toggle_auto_roi', async (_event, enabled) => {
    const newState = autoRoiSvc.toggle(enabled)
    return { status: 'success', data: { enabled: newState } }
  })

  ipcMain.handle('get_auto_roi_logs', async () => {
    return { status: 'success', data: autoRoiSvc.getLogs() }
  })

  // [新增] Notification Routes
  ipcMain.handle('get_notification_config', async () => {
    return { status: 'success', data: notifySvc.getConfig() }
  })

  ipcMain.handle('save_notification_config', async (_event, config) => {
    const newConfig = notifySvc.updateConfig(config)
    return { status: 'success', data: newConfig }
  })
}
