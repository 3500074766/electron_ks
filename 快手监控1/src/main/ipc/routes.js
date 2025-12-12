import { ipcMain } from 'electron'
import { UserService } from '../services/userService.js'
import { KuaishouService } from '../services/kuaishouService.js'
import { RoiService } from '../services/roiService.js'
import { CountdownService } from '../services/countdownService.js'
import { WalletService } from '../services/walletService.js' // 引入新服务

export function registerIPC(mainWindow) {
  const send = (channel, payload) => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.webContents.send(channel, payload) } }

  const usersSvc = new UserService()
  const ksSvc = new KuaishouService()
  const roiSvc = new RoiService()
  const walletSvc = new WalletService() // 实例化

  // 将 walletSvc 注入到 CountdownService 中，以便冷启动时调用
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

  // 新增：获取所有余额的 IPC 接口
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
      cdSvc.resetAfterManualRefresh()
      const users = await usersSvc.getAllUsers(false)
      send('users_data', { type: 'users_data', status: 'success', data: users })

      // 并发执行三个请求：概览、ROI、余额
      const [ks, rois, wallets] = await Promise.all([
        ksSvc.getAllKuaishouData(users),
        roiSvc.getAllRoiData(users),
        walletSvc.getAllWalletData(users)
      ])

      send('kuaishou_data', { type: 'kuaishou_data', status: 'success', data: ks })
      send('roi_data', { type: 'roi_data', status: 'success', data: rois })
      send('wallet_data', { type: 'wallet_data', status: 'success', data: wallets }) // 发送余额数据

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
