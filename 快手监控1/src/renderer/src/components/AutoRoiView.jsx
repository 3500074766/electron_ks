import React, { useState, useEffect } from 'react'
import { Settings, Activity, CheckCircle, XCircle, FileText, Power } from 'lucide-react'

const Badge = ({ status }) => {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <CheckCircle size={12} /> 成功
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
      <XCircle size={12} /> 失败
    </span>
  )
}

export default function AutoRoiView() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  // Fetch initial state
  useEffect(() => {
    const init = async () => {
      try {
        const statusRes = await window.api.getAutoRoiStatus()
        if (statusRes.status === 'success') {
          setIsEnabled(statusRes.data.enabled)
        }
        const logsRes = await window.api.getAutoRoiLogs()
        if (logsRes.status === 'success') {
          setLogs(logsRes.data)
        }
      } catch (e) {
        console.error('Failed to init AutoRoiView', e)
      }
    }
    init()

    // Listen for realtime logs
    const removeListener = window.api.on('auto_roi_log_update', (newLog) => {
      setLogs((prev) => [newLog, ...prev].slice(0, 500))
    })

    return () => removeListener()
  }, [])

  const handleToggle = async () => {
    setLoading(true)
    try {
      const newState = !isEnabled
      const res = await window.api.toggleAutoRoi(newState)
      if (res.status === 'success') {
        setIsEnabled(res.data.enabled)
      }
    } catch (e) {
      console.error('Toggle failed', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-5 p-6 overflow-hidden bg-[#f8f9fa]">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-3">
            <Settings className="text-blue-600" />
            自动 ROI 调节
          </h2>
          <p className="text-zinc-500 mt-2 text-sm max-w-2xl leading-relaxed">
            启用此功能后，系统将在每次倒计时结束数据同步时，根据用户的【消耗值】自动调整投放 ROI。
            <br />
            规则：消耗≤0.2 ROI-2(底2.66) | 消耗0.2-0.3 ROI-1 | 消耗0.3-0.5 不变 | 消耗&gt;0.5
            逐步增加
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${isEnabled ? 'bg-blue-50 border-blue-200' : 'bg-zinc-50 border-zinc-200'}`}
          >
            <span className={`text-sm font-bold ${isEnabled ? 'text-blue-700' : 'text-zinc-500'}`}>
              {isEnabled ? '功能已开启' : '功能已关闭'}
            </span>
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isEnabled ? 'bg-blue-600' : 'bg-zinc-300'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2 text-zinc-700 font-bold">
            <FileText size={18} className="text-zinc-400" />
            <span>调节日志</span>
            <span className="bg-zinc-200 text-zinc-600 text-xs px-2 py-0.5 rounded-full ml-2">
              {logs.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  时间
                </th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  用户名
                </th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">
                  消耗值
                </th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">
                  ROI 变更
                </th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">
                  状态
                </th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  备注
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-zinc-400">
                    暂无调节记录
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-3.5 text-sm text-zinc-600 font-mono whitespace-nowrap">
                      {log.time}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-medium text-zinc-800">{log.name}</td>
                    <td className="px-6 py-3.5 text-sm text-zinc-600 font-mono text-right">
                      {log.cost}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-zinc-800 font-mono text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-zinc-400">{log.oldRoi}</span>
                        <span className="text-zinc-300">→</span>
                        <span className="font-bold text-blue-600">{log.newRoi}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Badge status={log.status} />
                    </td>
                    <td className="px-6 py-3.5 text-xs text-zinc-400 max-w-xs truncate">
                      {log.message || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
