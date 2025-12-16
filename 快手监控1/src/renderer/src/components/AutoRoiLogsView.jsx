import React, { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle
} from 'lucide-react'

// --- 内部组件: 状态徽章 ---
const Badge = ({ status }) => {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">
        <CheckCircle size={10} /> 成功
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-700">
      <XCircle size={10} /> 失败
    </span>
  )
}

export default function AutoRoiLogsView() {
  const [logs, setLogs] = useState([])
  const [expandedLogIds, setExpandedLogIds] = useState(new Set())
  const [exportLoading, setExportLoading] = useState(false)

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      try {
        const logsRes = await window.api.getAutoRoiLogs()
        if (logsRes.status === 'success') {
          setLogs(logsRes.data)
        }
      } catch (e) {
        console.error('Failed to init AutoRoiLogsView', e)
      }
    }
    init()

    // 监听实时日志更新
    const removeListener = window.api.on('auto_roi_log_update', (newLog) => {
      setLogs((prev) => [newLog, ...prev])
    })

    return () => removeListener()
  }, [])

  // 过滤今日日志
  const todayLogs = useMemo(() => {
    const today = new Date().toLocaleDateString()
    return logs.filter((log) => {
      if (log.id && typeof log.id === 'number') {
        const logDate = new Date(log.id).toLocaleDateString()
        return logDate === today
      }
      return true // 兜底
    })
  }, [logs])

  const handleExport = async () => {
    setExportLoading(true)
    try {
      await window.api.exportAutoRoiLogs()
    } catch (e) {
      console.error(e)
    } finally {
      setExportLoading(false)
    }
  }

  const toggleLogExpand = (id) => {
    const newSet = new Set(expandedLogIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedLogIds(newSet)
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部栏 */}
      <div className="px-8 py-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-800">今日执行日志</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              仅显示当天的操作记录，历史记录请导出查看。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-500">
            今日共 <span className="font-bold text-zinc-800">{todayLogs.length}</span> 条记录
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading || todayLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 hover:border-blue-300 hover:text-blue-600 text-zinc-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            <span>导出日志</span>
          </button>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#f8f9fa]">
        {todayLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-4">
            <FileText size={64} className="opacity-20" />
            <p className="text-lg font-medium">今日暂无调节记录</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {todayLogs.map((log) => {
              const isExpanded = expandedLogIds.has(log.id)
              const successCount = log.details
                ? log.details.filter((d) => d.status === 'success').length
                : 0
              const failCount = log.details ? log.details.length - successCount : 0

              return (
                <div
                  key={log.id}
                  className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div
                    className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
                    onClick={() => toggleLogExpand(log.id)}
                  >
                    <div className="flex items-center gap-6">
                      <div className="text-lg font-mono font-bold text-zinc-700 w-20">
                        {log.time.split(' ')[1] || log.time}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-zinc-800">
                          {log.ruleName || '未知策略'}
                        </span>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
                            共 {log.count} 个任务
                          </span>
                          {failCount > 0 && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-medium">
                              {failCount} 个失败
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`p-1.5 rounded-full transition-all duration-200 ${isExpanded ? 'bg-zinc-100 rotate-180 text-zinc-600' : 'text-zinc-400'}`}
                    >
                      <ChevronDown size={20} />
                    </div>
                  </div>

                  {isExpanded && log.details && (
                    <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 animate-in slide-in-from-top-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {log.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-zinc-100 p-3 rounded-lg text-sm flex flex-col gap-2 shadow-sm"
                          >
                            <div className="flex justify-between items-center border-b border-dashed border-zinc-100 pb-2">
                              <span
                                className="font-bold text-zinc-700 truncate max-w-[150px]"
                                title={detail.name}
                              >
                                {detail.name}
                              </span>
                              <Badge status={detail.status} />
                            </div>
                            <div className="flex justify-between text-zinc-500 text-xs">
                              <span>
                                消耗: <span className="font-mono text-zinc-700">{detail.cost}</span>
                              </span>
                              <div className="flex items-center gap-1 font-mono">
                                <span className="text-zinc-400 line-through">{detail.oldRoi}</span>
                                <ChevronRight size={10} />
                                <span className="text-blue-600 font-bold bg-blue-50 px-1 rounded">
                                  {detail.newRoi}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-zinc-400 bg-zinc-50 p-2 rounded leading-relaxed">
                              {detail.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
