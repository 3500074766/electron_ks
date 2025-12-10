import { ipcMain } from 'electron'
import { UserService } from '../services/userService.js'
import { KuaishouService } from '../services/kuaishouService.js'
import { RoiService } from '../services/roiService.js'
import { CountdownService } from '../services/countdownService.js'

export function registerIPC(mainWindow) {
  // 通用的发送函数
  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload)
    }
  }

  // 服务实例化
  const usersSvc = new UserService()
  const ksSvc = new KuaishouService()
  const roiSvc = new RoiService()
  // CountdownService 负责定时任务，并主动推送 'countdown_tick' 和 数据事件
  const cdSvc = new CountdownService({ usersSvc, ksSvc, roiSvc, send })

  // 页面加载完成后启动倒计时服务
  mainWindow.webContents.on('did-finish-load', () => {
    cdSvc.start()
  })

  // --- IPC Handlers (请求/响应模式) ---

  // 1. 获取快手数据
  ipcMain.handle('get_all_kuaishou_data', async () => {
    try {
      const users = await usersSvc.getAllUsers()
      const ks = await ksSvc.getAllKuaishouData(users)
      return { status: 'success', data: ks }
    } catch (e) {
      return { status: 'error', message: e.message }
    }
  })

  // 2. 获取 ROI 数据
  ipcMain.handle('get_all_roi_data', async () => {
    try {
      const users = await usersSvc.getAllUsers(false)
      const rois = await roiSvc.getAllRoiData(users)
      return { status: 'success', data: rois }
    } catch (e) {
      return { status: 'error', message: e.message }
    }
  })

  // 3. 手动刷新所有数据
  ipcMain.handle('refresh_data', async () => {
    cdSvc.resetAfterManualRefresh() // 重置倒计时
    // 触发异步刷新，通过 send 推送结果，避免前端一直 await
    // 也可以直接在这里 await 并返回，取决于数据量大小
    Promise.all([
        usersSvc.getAllUsers(false).then(d => send('users_data', { status: 'success', data: d })),
        // 这里模拟触发逻辑，实际上 CountdownService 里的 _tick(true) 可能更好
        cdSvc._tick(true)
    ])
    return { status: 'success' }
  })

  // 4. 更新刷新间隔
  ipcMain.handle('update_interval', (_, payload) => {
    const r = cdSvc.setIntervalMinutes(Number(payload?.interval || 10))
    return { status: 'success', interval: r.interval }
  })

  // 5. 更新 ROI
  ipcMain.handle('update_roi', async (_, payload) => {
    try {
      const result = await roiSvc.updateRoi(payload, async (uid) => usersSvc.getUserByUid(uid))
      // 更新成功后，立即触发一次 ROI 刷新
      await cdSvc.refreshRoiNow()
      return { status: 'success', data: result }
    } catch (e) {
      return { status: 'error', message: e.message }
    }
  })

  // 6. 获取倒计时状态
  ipcMain.handle('get_countdown_state', () => {
    return { status: 'success', data: cdSvc.getState() }
  })

  // 7. 立即刷新ROI (新增)
  ipcMain.handle('refresh_roi_now', async () => {
      await cdSvc.refreshRoiNow()
      return { status: 'success' }
  })

  ipcMain.handle('resume_countdown', () => {
    return { status: 'success', data: cdSvc.resume() }
  })

  ipcMain.handle('reset_roi_countdown', () => {
    cdSvc.resetRoi(15)
    return { status: 'success' }
  })
}
