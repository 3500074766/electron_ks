import React, { useState, useEffect, useRef, useMemo } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
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
  XCircle,
  AlertTriangle,
  CreditCard,
  History,
  ArrowRight,
  FileText,
  User,
  Calendar,
  MoveRight
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
    xs: 'px-2 py-1 text-xs rounded-md',
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl'
  }
  const colors = {
    primary:
      variant === 'solid'
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    default: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
    danger: 'bg-rose-600 text-white hover:bg-rose-700'
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`${baseStyles} ${sizes[size]} ${colors[color] || colors.default} ${className}`}
    >
      {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  )
}

// Input Component
const Input = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  className = '',
  size = 'md',
  onClick,
  min = -Infinity,
  max = Infinity,
  wheelMin = -Infinity,
  wheelMax = Infinity,
  step = null,
  integerOnly = false
}) => {
  const inputRef = useRef(null)
  const sizeClass = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'

  const latestProps = useRef({
    value,
    onChange,
    placeholder,
    min,
    max,
    wheelMin,
    wheelMax,
    step,
    integerOnly
  })

  useEffect(() => {
    latestProps.current = {
      value,
      onChange,
      placeholder,
      min,
      max,
      wheelMin,
      wheelMax,
      step,
      integerOnly
    }
  }, [value, onChange, placeholder, min, max, wheelMin, wheelMax, step, integerOnly])

  const handleInputChange = (e) => {
    const val = e.target.value
    if (val === '') {
      onChange(e)
      return
    }

    if (integerOnly) {
      if (!/^\d*$/.test(val)) return
    } else {
      if (!/^\d*\.?\d*$/.test(val)) return
    }

    const numVal = parseFloat(val)
    if (!isNaN(numVal)) {
      if (numVal > max) return
    }

    onChange(e)
  }

  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const handleWheelNative = (e) => {
      if (document.activeElement === el) {
        e.preventDefault()

        const {
          value: currValue,
          onChange: currOnChange,
          placeholder: currPlaceholder,
          wheelMin,
          wheelMax,
          min,
          max,
          step
        } = latestProps.current

        const isUp = e.deltaY < 0

        let baseValue = currValue
        if (baseValue === '' || baseValue === null || baseValue === undefined) {
          baseValue = currPlaceholder || (min !== -Infinity ? String(min) : '0')
        }

        let numVal = parseFloat(baseValue)
        if (isNaN(numVal)) numVal = 0

        let newValue

        if (step && step > 0) {
          if (isUp) {
            newValue = (Math.floor(numVal / step) + 1) * step
          } else {
            newValue = (Math.ceil(numVal / step) - 1) * step
          }
        } else {
          const delta = isUp ? 1 : -1
          newValue = Math.round((numVal + delta) * 100) / 100
        }

        const effectiveMin = wheelMin !== -Infinity ? wheelMin : min
        const effectiveMax = wheelMax !== -Infinity ? wheelMax : max

        if (effectiveMin !== -Infinity && newValue < effectiveMin) newValue = effectiveMin
        if (effectiveMax !== -Infinity && newValue > effectiveMax) newValue = effectiveMax

        if (currOnChange) {
          currOnChange({ target: { value: String(newValue) } })
        }
      }
    }

    el.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheelNative)
    }
  }, [])

  return (
    <div
      className={`flex items-center bg-white rounded-lg border border-zinc-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all ${sizeClass} ${className}`}
      onClick={onClick}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-zinc-900 placeholder-zinc-400 select-text"
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

const ConfirmModal = ({ isOpen, title, content, onConfirm, onCancel }) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-96 p-6 border border-zinc-100">
        <div className="flex items-center gap-3 mb-4 text-amber-600">
          <AlertTriangle size={28} />
          <h3 className="text-xl font-bold text-zinc-800">{title}</h3>
        </div>
        <p className="text-zinc-600 mb-8 leading-relaxed text-base">{content}</p>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            color="default"
            onClick={onCancel}
            className="!bg-white border border-zinc-200 !text-zinc-700 hover:!bg-zinc-50"
          >
            取消
          </Button>
          <Button
            onClick={onConfirm}
            color="primary"
            className="!bg-blue-600 hover:!bg-blue-700 !text-white shadow-lg shadow-blue-200"
          >
            确认修改
          </Button>
        </div>
      </div>
    </div>
  )
}

const RechargeModal = ({ isOpen, onClose, data }) => {
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState('input')
  const [qrUrl, setQrUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setStep('input')
      setQrUrl('')
      setError('')
    }
  }, [isOpen])

  const handleCloseOrBack = () => {
    if (step === 'qr') {
      setStep('input')
      setQrUrl('')
    } else {
      onClose()
    }
  }

  const handleCreateOrder = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效的充值金额')
      return
    }

    setStep('loading')
    setError('')

    try {
      if (!window.api || typeof window.api.createRecharge !== 'function') {
        throw new Error('充值功能未正确初始化，请重启应用')
      }

      const res = await window.api.createRecharge(data.UID, amount)
      if (res.status === 'success' && res.data.qrUrl) {
        setQrUrl(res.data.qrUrl)
        setStep('qr')
      } else {
        setError(res.message || '获取二维码失败')
        setStep('input')
      }
    } catch (e) {
      console.error(e)
      setError(e.message || '网络异常')
      setStep('input')
    }
  }

  if (!isOpen || !data) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden border border-zinc-100 flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
            <CreditCard size={20} className="text-blue-600" />
            账户充值
          </h3>
          <button
            onClick={handleCloseOrBack}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center">
          {step === 'input' || step === 'loading' ? (
            <>
              <div className="mb-6 w-full">
                <label className="block text-sm font-medium text-zinc-500 mb-2">充值用户</label>
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/60 text-zinc-800 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-200 overflow-hidden shrink-0 shadow-sm">
                    {data.头像 && <img src={data.头像} className="w-full h-full object-cover" />}
                  </div>
                  <span className="truncate text-lg font-bold">{data.名称}</span>
                </div>
              </div>

              <div className="mb-8 w-full">
                <label className="block text-sm font-medium text-zinc-500 mb-2">
                  充值金额 (元)
                </label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="!text-xl font-bold text-center !py-3"
                  placeholder="请输入金额"
                  min={1}
                  max={500000}
                  step={10}
                  integerOnly={true}
                />
                {error && <p className="text-rose-500 text-xs mt-2 text-center">{error}</p>}
              </div>

              <Button
                onClick={handleCreateOrder}
                loading={step === 'loading'}
                disabled={!amount || parseFloat(amount) < 1}
                className="w-full !text-lg !py-3 shadow-lg shadow-blue-200"
              >
                {step === 'loading' ? '正在创建订单...' : '生成支付二维码'}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center animate-in zoom-in duration-300 w-full">
              <div className="flex items-center gap-2 mb-4 bg-blue-50 px-6 py-2 rounded-full">
                <div className="w-8 h-8 rounded-lg bg-zinc-200 overflow-hidden shrink-0">
                  {data.头像 && <img src={data.头像} className="w-full h-full object-cover" />}
                </div>
                <span className="text-lg font-bold text-blue-800">{data.名称}</span>
              </div>

              <div className="bg-white p-2 rounded-xl border border-zinc-200 shadow-inner mb-4 flex items-center justify-center overflow-hidden">
                <QRCodeCanvas value={qrUrl} size={190} level="M" className="rounded-lg" />
              </div>

              <p className="text-zinc-800 font-bold text-2xl mb-1">¥ {amount}</p>

              <p className="text-zinc-500 text-sm mb-6">
                请使用 <span className="font-bold text-green-600">微信</span> /{' '}
                <span className="font-bold text-blue-500">支付宝</span> 扫码支付
              </p>

              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-full text-xs font-medium animate-pulse">
                <RefreshCw size={12} className="animate-spin" />
                正在检测支付结果...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- History Modal Component (Revised) ---
const HistoryModal = ({ isOpen, onClose, data }) => {
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && data) {
      const fetchData = async () => {
        setLoading(true)
        setError(null)
        setRecords([])

        if (!data.target_id) {
          setError('当前用户无计划ID，无法查询')
          setLoading(false)
          return
        }

        try {
          const res = await window.api.getPlanRecords(data.UID, data.target_id)
          if (res.status === 'success') {
            setRecords(res.data)
          } else {
            setError(res.message || '获取记录失败')
          }
        } catch (err) {
          setError('网络连接异常')
        } finally {
          setLoading(false)
        }
      }
      fetchData()
    }
  }, [isOpen, data])

  // Helper to extract HH:mm:ss from timestamp string
  const formatOnlyTime = (dateStr) => {
    if (!dateStr) return '--'
    const parts = dateStr.split(' ')
    return parts.length > 1 ? parts[1] : dateStr
  }

  if (!isOpen || !data) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[5px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[85vh] flex flex-col border border-zinc-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Re-arranged for cleaner look */}
        <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-start bg-white">
          <div className="flex items-center gap-3">
            {/* Avatar - Slightly larger and cleaner */}
            <div className="w-11 h-11 rounded-lg bg-zinc-100 overflow-hidden shrink-0 border border-zinc-100 shadow-sm">
              {data.头像 && <img src={data.头像} className="w-full h-full object-cover" />}
            </div>

            {/* Info - Re-ordered: Name+Badge top, ID bottom */}
            <div className="flex flex-col gap-1 justify-center pt-0.5">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-zinc-900 leading-none tracking-tight">
                  {data.名称}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-zinc-400 text-xs">
                <span>ID:</span>
                <span className="font-mono text-zinc-500 font-medium text-sm tracking-wide">
                  {data.target_id || '--'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors p-2 hover:bg-zinc-100 rounded-full mt-1"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Content - Centered and Larger Text Table */}
        <div className="flex-1 overflow-y-auto bg-white min-h-[200px] p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-400">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <span className="text-base">加载中...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-rose-500">
              <AlertCircle size={24} />
              <span className="text-base">{error}</span>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-400">
              <History size={32} className="opacity-20" />
              <span className="text-base">暂无记录</span>
            </div>
          ) : (
            <table className="w-full text-base text-center border-collapse">
              <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-base">时间</th>
                  <th className="px-4 py-2 text-base">事件</th>
                  <th className="px-4 py-2 text-base">修改前</th>
                  <th className="px-4 py-2 text-base">修改后</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {records.map((rec, i) => (
                  <tr key={i} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-base text-zinc-600 whitespace-nowrap">
                      {formatOnlyTime(rec.time)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full border border-zinc-200 inline-block font-medium">
                        {rec.event}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-base text-zinc-600">{rec.original}</td>
                    <td className="px-4 py-3.5 font-base text-zinc-600 ">{rec.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const Toast = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (message) {
      setShouldRender(true)
      requestAnimationFrame(() => setIsVisible(true))
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    if (!isVisible && shouldRender) {
      const timer = setTimeout(() => {
        setShouldRender(false)
        onClose()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible, shouldRender, onClose])

  if (!shouldRender && !message) return null

  const styles =
    type === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : type === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200'
  const Icon = type === 'success' ? CheckCircle : type === 'warning' ? AlertTriangle : XCircle

  return (
    <div
      onClick={() => setIsVisible(false)}
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 ${styles}
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
  { label: '订单数', key: '订单数', width: '', align: 'center' },
  { label: '上次', key: '上次花费', width: '', align: 'center' },
  { label: '花费', key: '花费', width: '', align: 'center' },
  { label: '消耗', key: '消耗', width: '', align: 'center' },
  { label: '余额', key: '余额', width: '', align: 'center' },
  { label: '全站ROI', key: '全站ROI', width: '', align: 'center' },
  { label: '投放ROI', key: 'roi', width: '', align: 'center' },
  { label: '操作', key: null, width: 'w-38', align: 'center' }
]

export default function App() {
  const [activeTab, setActiveTab] = useState('monitor')
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState({ message: '', type: '' })

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, data: null })
  const [rechargeModal, setRechargeModal] = useState({ isOpen: false, data: null })
  const [historyModal, setHistoryModal] = useState({ isOpen: false, data: null })

  const [minCost, setMinCost] = useState(0.5)
  const [maxCost, setMaxCost] = useState(2.0)
  const [refreshInterval, setRefreshInterval] = useState(10)
  const [tempInterval, setTempInterval] = useState('10')

  const [tableData, setTableData] = useState([])
  const [lastUpdateTime, setLastUpdateTime] = useState(null)
  const [selectedUid, setSelectedUid] = useState(null)

  const [countdown, setCountdown] = useState(600)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const dataMapRef = useRef(new Map())

  const isManualRefresh = useRef(false)
  const isEditingInterval = useRef(false)

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

  const mergeData = (newData, shouldUpdateTime = true) => {
    if (!Array.isArray(newData)) return

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
    isManualRefresh.current = true

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

  const executeRoiUpdate = async (row, newRoi) => {
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
      refreshAll()
    } else {
      showNotify(res?.message || '更新失败', 'error')
    }
  }

  const submitRoi = async (row, e) => {
    e && e.stopPropagation()
    if (!row.editRoi || !String(row.editRoi).trim()) return

    const newRoi = parseFloat(row.editRoi)

    if (isNaN(newRoi)) return showNotify('请输入有效数字', 'error')
    if (newRoi < 0) return showNotify('ROI 不能小于 0', 'error')
    if (newRoi > 100) return showNotify('ROI 不能大于 100', 'error')

    const currentRoi = parseFloat(row.roi) || 0
    const diff = newRoi - currentRoi

    if (diff > 20) {
      setConfirmModal({
        isOpen: true,
        data: { row, newRoi, currentRoi }
      })
      return
    }

    await executeRoiUpdate(row, newRoi)
  }

  const handleConfirmUpdate = async () => {
    const { row, newRoi } = confirmModal.data
    setConfirmModal({ isOpen: false, data: null })
    await executeRoiUpdate(row, newRoi)
  }

  const handleCancelUpdate = () => {
    setConfirmModal({ isOpen: false, data: null })
    showNotify('已取消修改', 'warning')
  }

  const openRecharge = (row, e) => {
    e.stopPropagation()
    setRechargeModal({ isOpen: true, data: row })
  }

  const openHistory = (row, e) => {
    e.stopPropagation()
    setHistoryModal({ isOpen: true, data: row })
  }

  useEffect(() => {
    if (!window.api) return

    const handleDataUpdate = (res) => {
      if (res.status === 'success') {
        const isManual = res.trigger === 'manual' || isManualRefresh.current
        mergeData(res.data, !isManual)
      }
    }

    const handleRechargeSuccess = (res) => {
      setRechargeModal((prev) => {
        if (prev.isOpen && prev.data?.UID === res.uid) {
          return { isOpen: false, data: null }
        }
        return prev
      })
      showNotify(`${res.name} 充值 ${res.amount} 元成功!`, 'success')
      refreshAll()
    }

    const offs = [
      window.api.on('kuaishou_data', handleDataUpdate),
      window.api.on('roi_data', handleDataUpdate),
      window.api.on('wallet_data', handleDataUpdate),
      window.api.on('users_data', (res) => {
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
      }),
      window.api.on('recharge_success', handleRechargeSuccess)
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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="确认大幅修改 ROI？"
        content={
          confirmModal.data
            ? `您正在将用户【${confirmModal.data.row.名称}】的 ROI 从 ${confirmModal.data.currentRoi} 修改为 ${confirmModal.data.newRoi}。增加幅度超过 20，是否确认？`
            : ''
        }
        onConfirm={handleConfirmUpdate}
        onCancel={handleCancelUpdate}
      />

      <RechargeModal
        isOpen={rechargeModal.isOpen}
        data={rechargeModal.data}
        onClose={() => setRechargeModal({ isOpen: false, data: null })}
      />

      <HistoryModal
        isOpen={historyModal.isOpen}
        data={historyModal.data}
        onClose={() => setHistoryModal({ isOpen: false, data: null })}
      />

      <div className="w-50 bg-white border-r border-zinc-100 flex flex-col z-10 shadow-sm">
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
            <Activity size={20} /> <span>全站直播监控</span>
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
                    <tr className="select-none">
                      {COLUMNS.map((col, i) => (
                        <th
                          key={i}
                          className={`${i === 0 ? 'pl-8 pr-3' : 'px-3'} py-3 text-base font-bold text-zinc-600 uppercase tracking-wide whitespace-nowrap ${col.width} ${col.key ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
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
                      const isSelected = selectedUid === row.UID

                      let badge = !isNaN(costVal)
                        ? costVal < parseFloat(minCost)
                          ? 'default'
                          : costVal > parseFloat(maxCost)
                            ? 'danger'
                            : 'success'
                        : 'default'

                      return (
                        <tr
                          key={row.UID}
                          onClick={() => setSelectedUid(row.UID)}
                          className={`
                              transition-all duration-200 cursor-pointer group border-b border-zinc-50 last:border-0 select-none
                              ${isSelected ? 'bg-blue-100/60 hover:bg-blue-100' : 'hover:bg-blue-50'}
                            `}
                        >
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
                            {row.订单数}
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

                          <td
                            className="px-3 py-2.5 text-center whitespace-nowrap cursor-pointer hover:bg-blue-50 transition-colors relative group/balance"
                            onDoubleClick={(e) => openRecharge(row, e)}
                            title="双击进行充值"
                          >
                            <div
                              className={`flex items-center justify-center gap-1 font-mono text-base font-bold ${isLowBalance ? 'text-rose-600' : 'text-zinc-900'}`}
                            >
                              {isLowBalance && <AlertCircle size={14} strokeWidth={2.5} />}
                              <span>{row.余额 ? `¥${row.余额}` : '--'}</span>
                            </div>
                            <div className="absolute top-1 right-2 p-1 opacity-0 group-hover/balance:opacity-100 transition-opacity pointer-events-none">
                              <CreditCard size={12} className="text-blue-400/70" />
                            </div>
                          </td>

                          <td className="px-3 py-2.5 font-mono text-base font-bold text-zinc-800 text-center whitespace-nowrap">
                            {row.全站ROI}
                          </td>

                          <td
                            className="px-3 py-2.5 font-mono text-base font-bold text-blue-600 text-center whitespace-nowrap relative group/history"
                            onDoubleClick={(e) => openHistory(row, e)}
                            title="双击查看修改记录"
                          >
                            <div className="flex items-center justify-center gap-1 relative">
                              {row.roi}
                              <div className="absolute -top-3 right-0 opacity-0 group-hover/history:opacity-100 transition-opacity pointer-events-none">
                                <History size={10} className="text-blue-300" />
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {/* 新增判断：如果 roi 为 0，显示 '智能'，否则显示编辑框 */}
                            {parseFloat(row.roi) === 0 ? (
                              <span className="text-zinc-500 font-bold text-sm">智能</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <Input
                                  size="sm"
                                  className="w-20 text-center font-mono !text-base bg-white shadow-sm"
                                  placeholder={row.roi}
                                  value={row.editRoi || ''}
                                  onChange={(e) => handleEditRoiChange(row.UID, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      submitRoi(row, e)
                                      e.target.blur()
                                    }
                                  }}
                                  min={0}
                                  max={100}
                                  wheelMin={1}
                                  wheelMax={100}
                                />
                                <Button
                                  size="sm"
                                  className="!px-3 !text-base shadow-sm"
                                  onClick={(e) => submitRoi(row, e)}
                                  disabled={!row.editRoi || !String(row.editRoi).trim()}
                                >
                                  改
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {sortedData.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-16 text-center text-zinc-400 text-base">
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
