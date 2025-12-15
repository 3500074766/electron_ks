import { ipcMain } from 'electron'
// ... 其他导入 ...
import { NotificationService } from '../services/notificationService.js' // 新导入

export function registerIPC(mainWindow) {
  const send = (channel, payload) => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.webContents.send(channel, payload) } }

  const usersSvc = new UserService()
  const ksSvc = new KuaishouService()
  const roiSvc = new RoiService()
  const walletSvc = new WalletService()
  const rechargeSvc = new RechargeService(mainWindow)
  const planSvc = new PlanService()
  const autoRoiSvc = new AutoRoiService({ roiSvc, usersSvc, send })

  // 1. 实例化通知服务
  const notifySvc = new NotificationService()

  // 2. 注入到 CountdownService (注意参数列表中添加 notifySvc)
  const cdSvc = new CountdownService({
    usersSvc, ksSvc, roiSvc, walletSvc, autoRoiSvc, notifySvc, send
  })

  // ... (保留现有的路由代码) ...

  // === 新增：通知配置相关的 IPC ===

  ipcMain.handle('get_notification_config', async () => {
    return { status: 'success', data: notifySvc.getConfig() }
  })

  ipcMain.handle('save_notification_config', async (_event, config) => {
    const newConfig = notifySvc.updateConfig(config)
    return { status: 'success', data: newConfig }
  })
}
