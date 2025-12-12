import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Activity,
  TrendingUp,
  RefreshCw,
  Clock,
  Search,
  Settings,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'

// --- UI Components ---
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-zinc-100 shadow-sm ${className}`}>
    {children}
  </div>
)

const Button = ({
  children,
  variant = 'solid',
  color = 'primary',
  size = 'md',
  onClick,
  loading,
  className = '',
  disabled
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none outline-none focus:ring-2 focus:ring-offset-1'
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl'
  }
  const colors = {
    primary:
      variant === 'solid'
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    default: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`${baseStyles} ${sizes[size]} ${colors[color]} ${className}`}
    >
      {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  )
}

const Input = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  className = '',
  size = 'md'
}) => {
  const sizeClass = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
  return (
    <div
      className={`flex items-center bg-white rounded-lg border border-zinc-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all ${sizeClass} ${className}`}
    >
      <input
        type="text"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-zinc-900 placeholder-zinc-400"
      />
    </div>
  )
}

const Badge = ({ children, color = 'default' }) => {
  const styles = {
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-rose-100 text-rose-700',
    default: 'bg-zinc-100 text-zinc-600'
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-sm font-bold ${styles[color]}`}>{children}</span>
  )
}

// 优化后的顶部消息提示组件
// 1. 显示时间缩短为 1秒 (1000ms)
// 2. 增加进场和退场动画
const Toast = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // 监听 message 变化来控制显示
  useEffect(() => {
    if (message) {
      setShouldRender(true)
      // 稍微延迟一点点让 DOM 先渲染，触发 transition 动画
      requestAnimationFrame(() => setIsVisible(true))

      // 1秒后开始退场
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [message])

  // 监听可见性变化，处理退场后的卸载
  useEffect(() => {
    if (!isVisible && shouldRender) {
      const timer = setTimeout(() => {
        setShouldRender(false)
        onClose() // 通知父组件清空状态
      }, 300) // 等待 300ms 动画结束
      return () => clearTimeout(timer)
    }
  }, [isVisible, shouldRender, onClose])

  if (!shouldRender && !message) return null

  const styles =
    type === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-rose-50 text-rose-700 border-rose-200'
  const Icon = type === 'success' ? CheckCircle : XCircle

  return (
    <div
      onClick={() => setIsVisible(false)}
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 ${styles}
        transition-all duration-300 ease-in-out cursor-pointer hover:opacity-80
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
    >
      <Icon size={20} />
      <span className="font-medium text-sm">{message}</span>
    </div>
  )
}

// --- Column Definitions ---
const COLUMNS = [
  { label: '用户', key: null, width: 'w-56', align: 'left' },
  { label: 'GMV', key: 'GMV', width: '', align: 'center' },
  { label: '上次', key: '上次花费', width: '', align: 'center' },
  { label: '花费', key: '花费', width: '', align: 'center' },
  { label: '消耗', key: '消耗', width: '', align: 'center' },
  { label: '余额', key: '余额', width: '', align: 'center' },
  { label: '全站ROI', key: '全站ROI', width: '', align: 'center' },
  { label: '投放ROI', key: 'roi', width: '', align: 'center' },
  { label: '操作', key: null, width: '', align: 'center' }
]

// --- Main Logic ---
export default function App() {
  const [activeTab, setActiveTab] = useState('monitor')
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState({ message: '', type: '' })

  // Settings
  const [minCost, setMinCost] = useState(0.5)
  const [maxCost, setMaxCost] = useState(2.0)
  const [refreshInterval, setRefreshInterval] = useState(10)
  const [tempInterval, setTempInterval] = useState('10')

  // Data
  const [tableData, setTableData] = useState([])
  const [lastUpdateTime, setLastUpdateTime] = useState(null)

  // 统一的倒计时状态
  const [countdown, setCountdown] = useState(600)

  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const dataMapRef = useRef(new Map())

  // 用来标记是否是手动刷新
  // 双重保险：不仅依赖后端返回的 trigger，前端自己也记一个 flag
  const isManualRefresh = useRef(false)
  const isEditingInterval = useRef(false)

  // Helpers
  const formatTime = (s) => {
    const safeS = parseInt(s, 10)
    if (isNaN(safeS)) return '00:00'
    if (safeS <= 0) return '同步中...'
    return `${Math.floor(safeS / 60)
      .toString()
      .padStart(2, '0')}:${(safeS % 60).toString().padStart(2, '0')}`
  }

  const formatUrl = (u) => (u ? (u.startsWith('http') ? u : `https://${u}`) : '')

  const showNotify = (msg, type = 'success') => {
    setNotification({ message: msg, type })
  }

  // Data Merging Logic
  const mergeData = (newData, shouldUpdateTime = true) => {
    if (!Array.isArray(newData)) return

    // 只有当 shouldUpdateTime 为 true 时（即非手动刷新），才更新时间
    if (shouldUpdateTime) {
      const now = new Date().toLocaleTimeString()
      setLastUpdateTime(now)
    }

    newData.forEach((item) => {
      const uid = String(item.UID || item.uid)
      if (!uid) return
      const exist = dataMapRef.current.get(uid) || {}
      const merged = { ...exist, ...item, _updated: Date.now() }
      if (exist.editRoi !== undefined) merged.editRoi = exist.editRoi
      dataMapRef.current.set(uid, merged)
    })
    setTableData(Array.from(dataMapRef.current.values()))
  }

  const handleEditRoiChange = (uid, value) => {
    const item = dataMapRef.current.get(uid)
    if (item) {
      item.editRoi = value
      dataMapRef.current.set(uid, { ...item })
      setTableData(Array.from(dataMapRef.current.values()))
    }
  }

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'desc' }
      if (prev.direction === 'desc') return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key: null, direction: null }
      return { key, direction: 'desc' }
    })
  }

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return tableData
    const sorted = [...tableData]
    sorted.sort((a, b) => {
      let aVal = parseFloat(a[sortConfig.key]) || 0
      let bVal = parseFloat(b[sortConfig.key]) || 0
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
    })
    return sorted
  }, [tableData, sortConfig])

  const callApi = async (method, payload) =>
    window.api && window.api[method]
      ? await window.api[method](payload)
      : console.warn('API missing')

  const refreshAll = async () => {
    if (loading) return
    setLoading(true)
    isManualRefresh.current = true // 标记开始手动刷新

    try {
      const res = await callApi('refreshData')
      if (res && res.status === 'success') {
        showNotify('数据刷新成功', 'success')
      } else {
        showNotify(res?.message || '刷新失败', 'error')
      }
    } catch (e) {
      console.error(e)
      showNotify('请求超时或网络异常', 'error')
    } finally {
      setLoading(false)
      // 注意：这里不要立即设为 false，因为 IPC 事件是异步到达的。
      // 我们在 IPC 监听器里处理完数据后，或者依靠后端返回的 trigger 来判断。
      // 为了安全起见，这里设为 false，但在监听器里我们优先检查 trigger 字段。
      // 如果后端没返回 trigger，isManualRefresh.current 可以在这里短暂保持 true 直到 UI 渲染周期结束，
      // 但最稳妥的是后端一定要回传 trigger: 'manual'。
      // 前端这里设为 false 是为了重置状态，防止后续自动刷新被误判。
      setTimeout(() => {
        isManualRefresh.current = false
      }, 500)
    }
  }

  const handleIntervalInputChange = (e) => {
    setTempInterval(e.target.value)
    isEditingInterval.current = true
  }

  const commitIntervalUpdate = async () => {
    isEditingInterval.current = false
    const val = parseInt(tempInterval)

    if (isNaN(val) || val <= 0) {
      setTempInterval(String(refreshInterval))
      return
    }

    if (val === refreshInterval) return

    setRefreshInterval(val)

    // 直接传数值
    await callApi('updateInterval', val)

    const state = await callApi('getCountdownState')
    if (state?.data?.remaining !== undefined && !isNaN(state.data.remaining)) {
      setCountdown(state.data.remaining)
    }

    showNotify(`已设置刷新间隔为 ${val} 分钟`)
  }

  const handleIntervalKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  const submitRoi = async (row) => {
    const newRoi = parseFloat(row.editRoi)
    if (!newRoi) return showNotify('请输入有效数字', 'error')
    setLoading(true)
    const res = await callApi('updateRoi', {
      uid: row.UID,
      target_id: row.target_id,
      roi_ratio: newRoi
    })
    setLoading(false)
    if (res && res.status === 'success') {
      showNotify('ROI 更新成功', 'success')
      handleEditRoiChange(row.UID, '')
    } else {
      showNotify(res?.message || '更新失败', 'error')
    }
  }

  useEffect(() => {
    if (!window.api) return

    // 封装一个通用的数据处理函数，增加双重保险
    const handleDataUpdate = (res) => {
      if (res.status === 'success') {
        // 核心逻辑：
        // 1. 如果后端明确标记为 manual (res.trigger === 'manual')，则它是手动刷新 -> 不更新时间
        // 2. 如果前端 ref 标记为 manual (isManualRefresh.current)，也是手动刷新 -> 不更新时间
        // 只有两者都不是手动，才更新时间 (true)
        const isManual = res.trigger === 'manual' || isManualRefresh.current
        mergeData(res.data, !isManual)
      }
    }

    const offs = [
      window.api.on('kuaishou_data', handleDataUpdate),
      window.api.on('roi_data', handleDataUpdate),
      window.api.on('wallet_data', handleDataUpdate),

      window.api.on('users_data', (res) => {
        // 修复：users_data 也需要判断 isManualRefresh.current
        // 如果是手动刷新期间，传入 false 不更新时间；否则（冷启动等）传入 true 更新时间
        if (res.status === 'success') {
          mergeData(res.data, !isManualRefresh.current)
        }
      }),
      window.api.on('countdown_tick', (res) => {
        if (res.remaining !== undefined && !isNaN(res.remaining)) {
          setCountdown(res.remaining)
        }
        if (
          !isEditingInterval.current &&
          res.intervalMinutes &&
          res.intervalMinutes > 0 &&
          res.intervalMinutes !== refreshInterval
        ) {
          setRefreshInterval(res.intervalMinutes)
          setTempInterval(String(res.intervalMinutes))
        }
      }),
      window.api.on('update_roi_result', (res) => {
        setLoading(false)
        if (res.status !== 'success') console.error(res.message)
      })
    ]
    ;(async () => {
      const state = await callApi('getCountdownState')
      if (state?.data) {
        if (state.data.intervalMinutes) {
          setRefreshInterval(state.data.intervalMinutes)
          setTempInterval(String(state.data.intervalMinutes))
        }
        if (state.data.remaining !== undefined && !isNaN(state.data.remaining)) {
          setCountdown(state.data.remaining)
        }
      }

      callApi('getAllKuaishouData')
      callApi('getAllRoiData')
      callApi('getAllWalletData')
    })()
    return () => offs.forEach((off) => off && off())
  }, [])

  const renderCountdown = () => {
    const text = formatTime(countdown)
    const isSyncing = text === '同步中...'
    return (
      <div
        className={`px-5 py-2.5 rounded-xl border shadow-sm transition-all ${isSyncing ? 'bg-amber-50 border-amber-200' : 'bg-blue-50/60 border-blue-100'}`}
      >
        <span
          className={`text-[11px] block uppercase tracking-wider font-semibold mb-0.5 ${isSyncing ? 'text-amber-600' : 'text-blue-500'}`}
        >
          {isSyncing ? 'Status' : 'Data Sync'}
        </span>
        <span
          className={`font-mono font-bold leading-none ${isSyncing ? 'text-lg text-amber-600' : 'text-2xl text-blue-600'}`}
        >
          {text}
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
      <Toast
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ message: '', type: '' })}
      />

      <div className="w-64 bg-white border-r border-zinc-100 flex flex-col z-10 shadow-sm">
        <div className="h-20 flex items-center px-6 border-b border-zinc-50 gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-blue-200 shadow-md">
            KS
          </div>
          <span className="text-xl font-bold text-zinc-800 tracking-tight">数据助手</span>
        </div>
        <div className="p-4 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-base font-medium ${activeTab === 'monitor' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-zinc-500 hover:bg-zinc-50'}`}
          >
            <Activity size={20} /> <span>核心监控</span>
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-base font-medium ${activeTab === 'analysis' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-zinc-500 hover:bg-zinc-50'}`}
          >
            <TrendingUp size={20} /> <span>数据洞察</span>
          </button>
        </div>
      </div>

      <div className="flex-1 h-full bg-[#f8f9fa] relative overflow-hidden flex flex-col">
        {activeTab === 'monitor' ? (
          <div className="flex flex-col h-full gap-5 p-6 overflow-hidden">
            <Card className="flex flex-wrap items-center justify-between p-5 gap-6 shrink-0 shadow-md">
              <div className="flex items-center gap-8">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">实时数据监控</h2>
                  {lastUpdateTime && (
                    <div className="flex items-center gap-2 text-base text-zinc-500 mt-2 font-medium">
                      <Clock size={18} /> 更新于 {lastUpdateTime}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">{renderCountdown()}</div>
              </div>

              <div className="flex items-center gap-5 ml-auto">
                <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50/80 rounded-xl border border-zinc-200/60">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Zap size={14} />
                    <span className="text-sm font-medium">预警</span>
                  </div>
                  <Input
                    size="md"
                    className="w-16 text-center font-medium"
                    value={minCost}
                    onChange={(e) => setMinCost(e.target.value)}
                  />
                  <span className="text-zinc-300 font-bold">-</span>
                  <Input
                    size="md"
                    className="w-16 text-center font-medium"
                    value={maxCost}
                    onChange={(e) => setMaxCost(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Settings size={14} />
                    <span className="text-sm font-medium">间隔(分)</span>
                  </div>
                  <Input
                    size="md"
                    className="w-20 text-center font-bold text-blue-600 focus:ring-blue-500"
                    value={tempInterval}
                    onChange={handleIntervalInputChange}
                    onBlur={commitIntervalUpdate}
                    onKeyDown={handleIntervalKeyDown}
                  />
                </div>

                <div className="h-8 w-[1px] bg-zinc-200 mx-1"></div>

                <Button
                  onClick={refreshAll}
                  loading={loading}
                  className="shadow-lg shadow-blue-200"
                >
                  刷新ROI和余额
                </Button>
              </div>
            </Card>

            <Card className="flex-1 overflow-hidden flex flex-col relative border-t-4 border-t-blue-500/20">
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="bg-zinc-50/95 sticky top-0 z-10 backdrop-blur-sm border-b border-zinc-200">
                    <tr>
                      {COLUMNS.map((col, i) => (
                        <th
                          key={i}
                          className={`${i === 0 ? 'pl-8 pr-3' : 'px-3'} py-3 text-base font-bold text-zinc-600 uppercase tracking-wide whitespace-nowrap ${col.width} ${col.key ? 'cursor-pointer hover:text-blue-600 select-none transition-colors' : ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                          onClick={() => col.key && handleSort(col.key)}
                        >
                          <div
                            className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}
                          >
                            {col.label}
                            {sortConfig.key === col.key && (
                              <span className="text-blue-500 bg-blue-50 rounded px-1 text-[10px] ml-1">
                                {sortConfig.direction === 'asc'
                                  ? '▲'
                                  : sortConfig.direction === 'desc'
                                    ? '▼'
                                    : ''}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedData.map((row) => {
                      const costVal = parseFloat(row.消耗)
                      const balanceVal = parseFloat(row.余额)
                      const isLowBalance = !isNaN(balanceVal) && balanceVal < 10

                      let badge = !isNaN(costVal)
                        ? costVal < parseFloat(minCost)
                          ? 'success'
                          : costVal > parseFloat(maxCost)
                            ? 'danger'
                            : 'default'
                        : 'default'
                      return (
                        <tr key={row.UID} className="hover:bg-blue-50/40 transition-colors group">
                          <td className="pl-8 pr-3 py-2.5 text-left w-56">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-zinc-100 overflow-hidden border border-zinc-200 shrink-0 shadow-sm group-hover:shadow-md transition-all">
                                {row.头像 && (
                                  <img
                                    src={formatUrl(row.头像)}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex flex-col justify-center">
                                <div
                                  className="font-medium text-base text-zinc-800 truncate max-w-[140px]"
                                  title={row.名称}
                                >
                                  {row.名称}
                                </div>
                                <div className="text-xs text-zinc-400 font-mono">UID:{row.UID}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-2.5 font-mono text-base text-zinc-800 text-center whitespace-nowrap">
                            ¥{row.GMV}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-base text-zinc-800 text-center whitespace-nowrap">
                            {row.上次花费}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-base text-zinc-800 text-center whitespace-nowrap">
                            {row.花费}
                          </td>

                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <Badge color={badge}>{row.消耗}</Badge>
                          </td>

                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <div
                              className={`flex items-center justify-center gap-1 font-mono text-base font-bold ${isLowBalance ? 'text-rose-600' : 'text-zinc-900'}`}
                            >
                              {isLowBalance && <AlertCircle size={14} strokeWidth={2.5} />}
                              <span>{row.余额 ? `¥${row.余额}` : '--'}</span>
                            </div>
                          </td>

                          <td className="px-3 py-2.5 font-mono text-base font-bold text-zinc-800 text-center whitespace-nowrap">
                            {row.全站ROI}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-base font-bold text-blue-600 text-center whitespace-nowrap">
                            {row.roi}
                          </td>

                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              <Input
                                size="sm"
                                className="w-20 text-center font-mono bg-white shadow-sm"
                                placeholder={row.roi}
                                value={row.editRoi || ''}
                                onChange={(e) => handleEditRoiChange(row.UID, e.target.value)}
                              />
                              <Button
                                size="sm"
                                className="!px-3 shadow-sm"
                                onClick={() => submitRoi(row)}
                              >
                                改
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {sortedData.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-16 text-center text-zinc-400 text-base">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-zinc-50 rounded-full">
                              <Search size={32} className="opacity-20" />
                            </div>
                            <span>暂无数据，正在同步...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400">
            <TrendingUp size={48} className="mb-4 text-zinc-300" />
            <p className="text-lg font-medium">数据洞察功能开发中</p>
          </div>
        )}
      </div>
    </div>
  )
}
