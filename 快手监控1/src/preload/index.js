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
  getAllWalletData: () => ipcRenderer.invoke('get_all_wallet_data'), // 新增 API
  refreshData: () => ipcRenderer.invoke('refresh_data', { action: 'refresh_data' }),
  updateInterval: (interval) => ipcRenderer.invoke('update_interval', { interval }),
  updateRoi: (payload) => ipcRenderer.invoke('update_roi', payload),
  getCountdownState: () => ipcRenderer.invoke('get_countdown_state'),
  resumeCountdown: () => ipcRenderer.invoke('resume_countdown'),
  resetRoiCountdown: () => ipcRenderer.invoke('reset_roi_countdown')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
