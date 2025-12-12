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

  // 必须添加这行，确保前端能调用到 create_recharge
  createRecharge: (uid, amount) => ipcRenderer.invoke('create_recharge', { uid, amount }),
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
