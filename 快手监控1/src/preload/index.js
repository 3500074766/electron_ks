import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // 通用 IPC 封装
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, listener) => {
    const subscription = (_event, data) => listener(data)
    ipcRenderer.on(channel, subscription)
    return () => { ipcRenderer.removeListener(channel, subscription) }
  },
  off: (channel, listener) => ipcRenderer.removeListener(channel, listener),

  // --- 业务接口 (与 main/ipc/routes.js 对应) ---

  // 1. 获取基础数据
  getAllKuaishouData: () => ipcRenderer.invoke('get_all_kuaishou_data'),
  getAllRoiData: () => ipcRenderer.invoke('get_all_roi_data'),

  // 2. 刷新控制
  refreshData: () => ipcRenderer.invoke('refresh_data'),
  refreshRoiNow: () => ipcRenderer.invoke('refresh_roi_now'), // 新增：后端新加的接口

  // 3. 设置更新
  updateInterval: (interval) => ipcRenderer.invoke('update_interval', { interval }),
  updateRoi: (payload) => ipcRenderer.invoke('update_roi', payload),

  // 4. 倒计时控制
  getCountdownState: () => ipcRenderer.invoke('get_countdown_state'),
  resumeCountdown: () => ipcRenderer.invoke('resume_countdown'),
  resetRoiCountdown: () => ipcRenderer.invoke('reset_roi_countdown')
}

// 暴露 API 到渲染进程
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
