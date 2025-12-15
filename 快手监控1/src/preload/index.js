import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, listener) => {
    const subscription = (_event, data) => listener(data)
    ipcRenderer.on(channel, subscription)
    return () => { ipcRenderer.removeListener(channel, subscription) }
  },
  off: (channel, listener) => ipcRenderer.removeListener(channel, listener),
  getAllKuaishouData: () => ipcRenderer.invoke('get_all_kuaishou_data'),
  getAllRoiData: () => ipcRenderer.invoke('get_all_roi_data'),
  getAllWalletData: () => ipcRenderer.invoke('get_all_wallet_data'),
  refreshData: () => ipcRenderer.invoke('refresh_data', { action: 'refresh_data' }),
  updateInterval: (interval) => ipcRenderer.invoke('update_interval', { interval }),
  updateRoi: (payload) => ipcRenderer.invoke('update_roi', payload),
  getCountdownState: () => ipcRenderer.invoke('get_countdown_state'),
  resumeCountdown: () => ipcRenderer.invoke('resume_countdown'),
  resetRoiCountdown: () => ipcRenderer.invoke('reset_roi_countdown'),
  createRecharge: (uid, amount) => ipcRenderer.invoke('create_recharge', { uid, amount }),
  getPlanRecords: (uid, target_id) => ipcRenderer.invoke('get_plan_records', { uid, target_id }),

  // Auto ROI APIs
  getAutoRoiStatus: () => ipcRenderer.invoke('get_auto_roi_status'),
  toggleAutoRoi: (enabled) => ipcRenderer.invoke('toggle_auto_roi', enabled),
  getAutoRoiLogs: () => ipcRenderer.invoke('get_auto_roi_logs'),

  // [新增] Notification APIs
  getNotificationConfig: () => ipcRenderer.invoke('get_notification_config'),
  saveNotificationConfig: (config) => ipcRenderer.invoke('save_notification_config', config),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
