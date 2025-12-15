import React, { useState, useEffect } from 'react'
import { Bell, Mail, Plus, Trash2, AlertCircle, CheckCircle, XCircle, Save, User, AlertTriangle, ChevronDown, ChevronUp, Clock, CreditCard } from 'lucide-react'

// --- 内部 Toast 组件 ---
const Toast = ({ message, type, onClose }) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (message) {
      setShow(true)
      const timer = setTimeout(() => setShow(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    if (!show && message) {
      const timer = setTimeout(onClose, 300)
      return () => clearTimeout(timer)
    }
  }, [show, onClose, message])

  if (!message) return null

  const bgClass = type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                  'bg-amber-50 border-amber-200 text-amber-700'

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertTriangle

  return (
    <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-lg transition-all duration-300 ${bgClass} ${show ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
      <Icon size={20} />
      <span className="font-medium text-sm">{message}</span>
    </div>
  )
}

const Button = ({ children, onClick, className = '', disabled, loading, variant = 'primary' }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap
      ${disabled ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' :
        variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}
      ${className}`}
  >
    {loading && <span className="animate-spin mr-1">↻</span>}
    {children}
  </button>
)

const Input = ({ value, onChange, placeholder, className = '', type = 'text', readOnly = false }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    readOnly={readOnly}
    className={`px-3 py-2 bg-white border border-zinc-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all font-medium text-zinc-700 ${readOnly ? 'bg-zinc-50 text-zinc-400 cursor-not-allowed' : ''} ${className}`}
  />
)

const Switch = ({ checked, onChange }) => (
  <div
    onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    className={`w-12 h-7 rounded-full flex items-center px-1 cursor-pointer transition-colors duration-300 ${checked ? 'bg-blue-600' : 'bg-zinc-300'}`}
  >
    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </div>
)

// 规则卡片组件
const RuleCard = ({ title, desc, enabled, onToggle, children, isExpanded, onExpand }) => {
  return (
    <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${enabled ? 'bg-white border-blue-200 shadow-sm' : 'bg-zinc-50/50 border-zinc-200'}`}>
      <div
        className="flex items-center p-4 cursor-pointer hover:bg-zinc-50/50 transition-colors"
        onClick={onExpand}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Switch checked={enabled} onChange={onToggle} />
            <span className={`font-bold ${enabled ? 'text-zinc-800' : 'text-zinc-500'}`}>{title}</span>
          </div>
          <p className="text-xs text-zinc-400 pl-[60px]">{desc}</p>
        </div>
        <div className="text-zinc-400">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isExpanded && enabled && (
        <div className="px-4 pb-4 pt-0 pl-[60px] animate-in slide-in-from-top-2">
          <div className="pt-4 border-t border-dashed border-zinc-200 space-y-4">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NotificationView() {
  const [loading, setLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [config, setConfig] = useState({
    enabled: false,
    recipients: [],
    smtp: { user: '', pass: '' },
    rules: {
      low_balance: { enabled: false, threshold: 50, interval: 60, rechargeAmount: 100 },
      high_cost: { enabled: false, threshold: 1000, interval: 60 }
    }
  })
  const [newEmail, setNewEmail] = useState('')
  const [showSmtp, setShowSmtp] = useState(false)
  const [expandedRules, setExpandedRules] = useState({ low_balance: true, high_cost: false })
  const [toast, setToast] = useState({ msg: '', type: '' })

  useEffect(() => {
    loadConfig()
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
  }

  const loadConfig = async () => {
    if (!window.api || !window.api.getNotificationConfig) return
    setLoading(true)
    try {
      const res = await window.api.getNotificationConfig()
      if (res && res.status === 'success') {
        const data = res.data
        if (!data.smtp) data.smtp = { user: '', pass: '' }
        if (!data.rules) data.rules = {
          low_balance: { enabled: false, threshold: 50, interval: 60, rechargeAmount: 100 },
          high_cost: { enabled: false, threshold: 1000, interval: 60 }
        }
        // 确保字段存在
        if (data.rules.low_balance.interval === undefined) data.rules.low_balance.interval = 60
        if (data.rules.low_balance.rechargeAmount === undefined) data.rules.low_balance.rechargeAmount = 100
        if (data.rules.high_cost.interval === undefined) data.rules.high_cost.interval = 60

        setConfig(data)
      }
    } catch (e) {
      console.error('加载配置失败', e)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    setSaveLoading(true)
    try {
      if (config.enabled && (!config.smtp.user || !config.smtp.pass)) {
        showToast('请先配置发件人邮箱（SMTP）信息', 'warning')
        setShowSmtp(true)
        setSaveLoading(false)
        return
      }
      await window.api.saveNotificationConfig(config)
      showToast('配置已保存成功！', 'success')
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error')
    } finally {
      setSaveLoading(false)
    }
  }

  const addEmail = () => {
    if (!newEmail || !newEmail.includes('@')) return
    if (config.recipients.includes(newEmail)) return
    setConfig(prev => ({ ...prev, recipients: [...prev.recipients, newEmail] }))
    setNewEmail('')
  }

  const removeEmail = (email) => {
    setConfig(prev => ({ ...prev, recipients: prev.recipients.filter(e => e !== email) }))
  }

  const updateRule = (key, field, value) => {
    setConfig(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        [key]: {
          ...prev.rules[key],
          [field]: value
        }
      }
    }))
  }

  const updateSmtp = (field, value) => {
    setConfig(prev => ({ ...prev, smtp: { ...prev.smtp, [field]: value } }))
  }

  const toggleExpand = (rule) => {
    setExpandedRules(prev => ({ ...prev, [rule]: !prev[rule] }))
  }

  return (
    <div className="h-full p-8 overflow-y-auto bg-[#f8f9fa] relative">
      <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: '' })} />

      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
              <Bell className="text-blue-600" />
              消息通知配置
            </h2>
            <p className="text-zinc-500 mt-1 text-sm">配置异常情况下的邮件提醒规则</p>
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-zinc-100 shadow-sm">
            <span className="font-bold text-zinc-700">启用通知</span>
            <Switch checked={config.enabled} onChange={(val) => setConfig({ ...config, enabled: val })} />
          </div>
        </div>

        {/* 发件人配置 */}
        <div className={`bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden transition-all duration-300 ${!config.enabled ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}`}>
          <div className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-zinc-50" onClick={() => setShowSmtp(!showSmtp)}>
            <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
              <User size={18} className="text-zinc-400" /> 发件人配置 (SMTP)
            </h3>
            <span className="text-sm text-blue-600 font-medium">{showSmtp ? '收起' : (config.smtp.user ? '已配置' : '去配置')}</span>
          </div>
          {showSmtp && (
            <div className="px-6 pb-6 pt-2 bg-zinc-50/50 border-t border-zinc-100 animate-in slide-in-from-top-2">
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl mb-4 text-xs text-zinc-600 leading-relaxed">
                <span className="font-bold text-blue-600">说明：</span> 目前仅支持 QQ 邮箱。密码栏请填写 <strong>授权码</strong>。
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">发件人邮箱</label>
                  <Input value={config.smtp.user} onChange={(e) => updateSmtp('user', e.target.value)} placeholder="例如: 123456@qq.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">授权码 (Pass)</label>
                  <Input type="password" value={config.smtp.pass} onChange={(e) => updateSmtp('pass', e.target.value)} placeholder="填写16位授权码" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 接收人设置 */}
        <div className={`bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 transition-all duration-300 ${!config.enabled ? 'opacity-60 grayscale-[0.5] pointer-events-none' : ''}`}>
          <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <Mail size={18} className="text-zinc-400" /> 接收邮箱
          </h3>
          <div className="flex gap-3 mb-6">
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="输入邮箱地址" className="flex-1" />
            <button onClick={addEmail} disabled={!newEmail} className="px-4 py-2 bg-zinc-100 hover:bg-blue-50 text-zinc-600 hover:text-blue-600 rounded-lg font-bold transition-colors disabled:opacity-50">
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {config.recipients.length === 0 && <div className="text-center py-6 text-zinc-400 text-sm bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">暂无接收邮箱</div>}
            {config.recipients.map(email => (
              <div key={email} className="flex items-center justify-between px-4 py-3 bg-zinc-50 rounded-xl border border-zinc-100 group hover:border-blue-200 transition-colors">
                <span className="text-zinc-700 font-mono font-medium">{email}</span>
                <button onClick={() => removeEmail(email)} className="text-zinc-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* 规则设置 */}
        <div className={`bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 transition-all duration-300 ${!config.enabled ? 'opacity-60 grayscale-[0.5] pointer-events-none' : ''}`}>
          <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-zinc-400" /> 触发规则
          </h3>

          <div className="space-y-4">
            {/* 规则1: 余额不足 */}
            <RuleCard
              title="余额不足预警"
              desc="当账户余额低于阈值时触发，并自动生成充值码发送邮件"
              enabled={config.rules.low_balance.enabled}
              onToggle={(val) => { updateRule('low_balance', 'enabled', val); if(val) setExpandedRules(p => ({...p, low_balance: true})); }}
              isExpanded={expandedRules.low_balance}
              onExpand={() => toggleExpand('low_balance')}
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">触发阈值 (元)</label>
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2">
                    <span className="text-xs text-zinc-400">低于</span>
                    <Input type="number" value={config.rules.low_balance.threshold} onChange={(e) => updateRule('low_balance', 'threshold', e.target.value)} className="!border-0 !bg-transparent !py-1.5 font-bold text-rose-500 text-center flex-1" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500 flex items-center gap-1"><Clock size={12}/> 触发频率 (分钟)</label>
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2">
                    <span className="text-xs text-zinc-400">每隔</span>
                    <Input type="number" value={config.rules.low_balance.interval} onChange={(e) => updateRule('low_balance', 'interval', e.target.value)} className="!border-0 !bg-transparent !py-1.5 font-bold text-zinc-700 text-center flex-1" />
                    <span className="text-xs text-zinc-400">分钟</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-medium text-zinc-500 flex items-center gap-1"><CreditCard size={12}/> 自动充值码金额 (元)</label>
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2">
                    <span className="text-xs text-blue-400">生成</span>
                    <Input type="number" value={config.rules.low_balance.rechargeAmount} onChange={(e) => updateRule('low_balance', 'rechargeAmount', e.target.value)} className="!border-0 !bg-transparent !py-1.5 font-bold text-blue-600 text-center flex-1" />
                    <span className="text-xs text-blue-400">元 的二维码</span>
                  </div>
                </div>
              </div>
            </RuleCard>

            {/* 规则2: 消耗过高 */}
            <RuleCard
              title="消耗过高预警"
              desc="当单日累计消耗超过设定阈值时触发"
              enabled={config.rules.high_cost.enabled}
              onToggle={(val) => { updateRule('high_cost', 'enabled', val); if(val) setExpandedRules(p => ({...p, high_cost: true})); }}
              isExpanded={expandedRules.high_cost}
              onExpand={() => toggleExpand('high_cost')}
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">触发阈值 (元)</label>
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2">
                    <span className="text-xs text-zinc-400">高于</span>
                    <Input type="number" value={config.rules.high_cost.threshold} onChange={(e) => updateRule('high_cost', 'threshold', e.target.value)} className="!border-0 !bg-transparent !py-1.5 font-bold text-amber-500 text-center flex-1" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500 flex items-center gap-1"><Clock size={12}/> 触发频率 (分钟)</label>
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2">
                    <span className="text-xs text-zinc-400">每隔</span>
                    <Input type="number" value={config.rules.high_cost.interval} onChange={(e) => updateRule('high_cost', 'interval', e.target.value)} className="!border-0 !bg-transparent !py-1.5 font-bold text-zinc-700 text-center flex-1" />
                    <span className="text-xs text-zinc-400">分钟</span>
                  </div>
                </div>
              </div>
            </RuleCard>
          </div>
        </div>

        {/* 底部保存 */}
        <div className="flex justify-end pb-8">
          <Button onClick={saveConfig} loading={saveLoading} className="w-auto px-8 py-3">
            <Save size={18} /> 保存配置
          </Button>
        </div>
      </div>
    </div>
  )
}
