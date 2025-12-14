import React, { useState, useEffect, useRef, useMemo } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Activity,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  History,
  Search,
  Settings
} from 'lucide-react'

// 引入组件
import MonitorView from './components/MonitorView'
import AutoRoiView from './components/AutoRoiView' // Use new component

// --- 1. UI 组件 (保留定义) ---
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
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    outline: 'bg-transparent border text-zinc-700 hover:bg-zinc-50'
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

// --- 2. 弹窗组件 (Modal) ---
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
    step === 'qr' ? (setStep('input'), setQrUrl('')) : onClose()
  }
  const handleCreateOrder = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效的充值金额')
      return
    }
    setStep('loading')
    setError('')
    try {
      const res = await window.api.createRecharge(data.UID, amount)
      if (res.status === 'success' && res.data.qrUrl) {
        setQrUrl(res.data.qrUrl)
        setStep('qr')
      } else {
        setError(res.message || '获取二维码失败')
        setStep('input')
      }
    } catch (e) {
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
                <div className="flex items-center bg-white rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent outline-none text-zinc-900 !text-xl font-bold text-center !py-3"
                    placeholder="请输入金额"
                  />
                </div>
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
          res.status === 'success' ? setRecords(res.data) : setError(res.message || '获取记录失败')
        } catch (err) {
          setError('网络连接异常')
        } finally {
          setLoading(false)
        }
      }
      fetchData()
    }
  }, [isOpen, data])
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
        <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-start bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-zinc-100 overflow-hidden shrink-0 border border-zinc-100 shadow-sm">
              {data.头像 && <img src={data.头像} className="w-full h-full object-cover" />}
            </div>
            <div className="flex flex-col gap-1 justify-center pt-0.5">
              <h3 className="text-xl font-bold text-zinc-900 leading-none tracking-tight">
                {data.名称}
              </h3>
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
      const timer = setTimeout(() => setIsVisible(false), 3000)
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
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 ${styles} transition-all duration-300 ease-in-out cursor-pointer hover:opacity-80 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
    >
      <Icon size={20} />
      <span className="font-medium text-sm">{message}</span>
    </div>
  )
}

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

// --- 3. App 主逻辑 ---

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

  const formatUrl = (u) => (u ? (u.startsWith('http') ? u : `https://${u}`) : '')
  const showNotify = (msg, type = 'success') => {
    setNotification({ message: msg, type })
  }

  const mergeData = (newData, shouldUpdateTime = true) => {
    if (!Array.isArray(newData)) return
    if (shouldUpdateTime) setLastUpdateTime(new Date().toLocaleTimeString())
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
      res && res.status === 'success'
        ? showNotify('数据刷新成功', 'success')
        : showNotify(res?.message || '刷新失败', 'error')
    } catch (e) {
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
    if (state?.data?.remaining !== undefined && !isNaN(state.data.remaining))
      setCountdown(state.data.remaining)
    showNotify(`已设置刷新间隔为 ${val} 分钟`)
  }
  const handleIntervalKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur()
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
    if (newRoi < 0 || newRoi > 100) return showNotify('ROI 必须在 0-100 之间', 'error')
    const currentRoi = parseFloat(row.roi) || 0
    const diff = newRoi - currentRoi
    if (diff > 20) {
      setConfirmModal({ isOpen: true, data: { row, newRoi, currentRoi } })
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
      if (res.status === 'success')
        mergeData(res.data, !(res.trigger === 'manual' || isManualRefresh.current))
    }
    const handleRechargeSuccess = (res) => {
      setRechargeModal((prev) =>
        prev.isOpen && prev.data?.UID === res.uid ? { isOpen: false, data: null } : prev
      )
      showNotify(`${res.name} 充值 ${res.amount} 元成功!`, 'success')
      refreshAll()
    }
    const offs = [
      window.api.on('kuaishou_data', handleDataUpdate),
      window.api.on('roi_data', handleDataUpdate),
      window.api.on('wallet_data', handleDataUpdate),
      window.api.on('users_data', (res) => {
        if (res.status === 'success') mergeData(res.data, !isManualRefresh.current)
      }),
      window.api.on('countdown_tick', (res) => {
        if (res.remaining !== undefined && !isNaN(res.remaining)) setCountdown(res.remaining)
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
        if (state.data.remaining !== undefined && !isNaN(state.data.remaining))
          setCountdown(state.data.remaining)
      }
      callApi('getAllKuaishouData')
      callApi('getAllRoiData')
      callApi('getAllWalletData')
    })()
    return () => offs.forEach((off) => off && off())
  }, [])

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
            onClick={() => setActiveTab('auto_roi')}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-base font-medium ${activeTab === 'auto_roi' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-zinc-500 hover:bg-zinc-50'}`}
          >
            <Settings size={20} /> <span>自动ROI调节</span>
          </button>
        </div>
      </div>

      <div className="flex-1 h-full bg-[#f8f9fa] relative overflow-hidden flex flex-col">
        <div
          className="h-full w-full"
          style={{ display: activeTab === 'monitor' ? 'block' : 'none' }}
        >
          <MonitorView
            lastUpdateTime={lastUpdateTime}
            countdown={countdown}
            minCost={minCost}
            setMinCost={setMinCost}
            maxCost={maxCost}
            setMaxCost={setMaxCost}
            tempInterval={tempInterval}
            handleIntervalInputChange={handleIntervalInputChange}
            commitIntervalUpdate={commitIntervalUpdate}
            handleIntervalKeyDown={handleIntervalKeyDown}
            refreshAll={refreshAll}
            loading={loading}
            sortedData={sortedData}
            COLUMNS={COLUMNS}
            sortConfig={sortConfig}
            handleSort={handleSort}
            selectedUid={selectedUid}
            setSelectedUid={setSelectedUid}
            formatUrl={formatUrl}
            openRecharge={openRecharge}
            openHistory={openHistory}
            handleEditRoiChange={handleEditRoiChange}
            submitRoi={submitRoi}
          />
        </div>
        <div
          className="h-full w-full"
          style={{ display: activeTab === 'auto_roi' ? 'block' : 'none' }}
        >
          <AutoRoiView />
        </div>
      </div>
    </div>
  )
}
