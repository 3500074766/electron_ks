import { ipcMain } from 'electron'
import { UserService } from '../services/userService.js'
import { KuaishouService } from '../services/kuaishouService.js'
import { RoiService } from '../services/roiService.js'
import { CountdownService } from '../services/countdownService.js'
import { WalletService } from '../services/walletService.js'

export function registerIPC(mainWindow) {
  const send = (channel, payload) => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.webContents.send(channel, payload) } }

  const usersSvc = new UserService()
  const ksSvc = new KuaishouService()
  const roiSvc = new RoiService()
  const walletSvc = new WalletService()

  const cdSvc = new CountdownService({ usersSvc, ksSvc, roiSvc, walletSvc, send })

  mainWindow.webContents.on('did-finish-load', () => {
    send('connection_established', { type: 'connection_established', status: 'success' })
    cdSvc.start()
  })

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
      // 发送用户基础数据，但不触发时间更新（前端已处理）
      send('users_data', { type: 'users_data', status: 'success', data: users })

      // 修改：手动刷新时，仅并发请求 ROI 和 余额，不请求快手核心数据（GMV、消耗等）
      const [rois, wallets] = await Promise.all([
        roiSvc.getAllRoiData(users),
        walletSvc.getAllWalletData(users)
      ])

      // 标记 trigger: 'manual'，前端根据此标记不更新时间
      // 注意：这里不再发送 kuaishou_data，因此页面上的 GMV/消耗 等字段不会变动
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
}
