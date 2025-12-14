import React, { useState, useEffect } from 'react'
import {
  Settings,
  FileText,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock
} from 'lucide-react'

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
  const [expandedIds, setExpandedIds] = useState(new Set())

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
      // 修改：前端实时更新时也限制只显示最近 10 条
      setLogs((prev) => [newLog, ...prev].slice(0, 10))
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

  const toggleExpand = (id) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
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

      {/* Logs List */}
      <div className="flex-1 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2 text-zinc-700 font-bold">
            <FileText size={18} className="text-zinc-400" />
            <span>调节记录 (保留最近10次)</span>
            <span className="bg-zinc-200 text-zinc-600 text-xs px-2 py-0.5 rounded-full ml-2">
              {logs.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 bg-zinc-50/30">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
              <span className="text-sm">暂无调节记录</span>
            </div>
          ) : (
            logs.map((log) => {
              // 兼容性处理
              if (!log.details || !Array.isArray(log.details)) return null

              const isExpanded = expandedIds.has(log.id)
              return (
                <div
                  key={log.id}
                  className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md"
                >
                  {/* Header Row - Click to Expand */}
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50 select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-1 rounded-full transition-transform duration-200 ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-zinc-100 text-zinc-400'}`}
                      >
                        <ChevronDown size={18} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-zinc-800 font-bold text-base">
                          <span>{log.time}</span>
                          <span className="text-xs font-normal text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                            自动触发
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500 mt-0.5">
                          共修改 {log.count} 个计划
                        </span>
                      </div>
                    </div>
                    <div className="text-zinc-400">
                      {!isExpanded && <span className="text-xs">点击展开详情</span>}
                    </div>
                  </div>

                  {/* Detail Table - Collapsible */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50/30 animate-in slide-in-from-top-2 duration-200">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500">
                          <tr>
                            <th className="px-6 py-2 text-xs font-semibold uppercase w-48">
                              用户名
                            </th>
                            <th className="px-6 py-2 text-xs font-semibold uppercase text-right">
                              消耗值
                            </th>
                            <th className="px-6 py-2 text-xs font-semibold uppercase text-center">
                              ROI 变更
                            </th>
                            <th className="px-6 py-2 text-xs font-semibold uppercase text-right">
                              状态
                            </th>
                            <th className="px-6 py-2 text-xs font-semibold uppercase">备注</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100/50">
                          {log.details.map((detail, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                              <td className="px-6 py-3 text-sm font-medium text-zinc-800">
                                {detail.name}
                              </td>
                              <td className="px-6 py-3 text-sm text-zinc-600 font-mono text-right">
                                {detail.cost}
                              </td>
                              <td className="px-6 py-3 text-sm text-zinc-800 font-mono text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-zinc-400">{detail.oldRoi}</span>
                                  <span className="text-zinc-300">→</span>
                                  <span className="font-bold text-blue-600">{detail.newRoi}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <Badge status={detail.status} />
                              </td>
                              <td className="px-6 py-3 text-xs text-zinc-400">
                                {detail.message || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
