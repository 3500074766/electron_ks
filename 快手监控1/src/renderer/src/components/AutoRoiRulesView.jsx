import React, { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Settings, Layers, Info } from 'lucide-react'

// --- 内部组件: 规则选择项 ---
const RuleOption = ({ rule, isActive, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(rule.id)}
      className={`relative px-4 py-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-start gap-4 ${
        isActive
          ? 'bg-blue-50/50 border-blue-500 shadow-sm'
          : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
      }`}
    >
      <div
        className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          isActive ? 'border-blue-500 bg-blue-500' : 'border-zinc-300 bg-white'
        }`}
      >
        {isActive && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
      <div>
        <h3 className={`font-bold text-base ${isActive ? 'text-blue-900' : 'text-zinc-700'}`}>
          {rule.name}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">点击查看详情并选中</p>
      </div>
    </div>
  )
}

export default function AutoRoiRulesView() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [activeRuleId, setActiveRuleId] = useState('')
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)

  // 初始化加载状态
  useEffect(() => {
    const init = async () => {
      try {
        const statusRes = await window.api.getAutoRoiStatus()
        if (statusRes.status === 'success') {
          setIsEnabled(statusRes.data.enabled)
          setActiveRuleId(statusRes.data.activeRuleId)
          setRules(statusRes.data.rules || [])
        }
      } catch (e) {
        console.error('Failed to init AutoRoiRulesView', e)
      }
    }
    init()
  }, [])

  const activeRuleDescription = useMemo(() => {
    const rule = rules.find((r) => r.id === activeRuleId)
    return rule ? rule.description : ''
  }, [rules, activeRuleId])

  const handleToggleEnable = async () => {
    setLoading(true)
    try {
      const newState = !isEnabled
      const res = await window.api.toggleAutoRoi(newState)
      if (res.status === 'success') {
        setIsEnabled(res.data.enabled)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRule = async (ruleId) => {
    if (ruleId === activeRuleId) return
    try {
      const res = await window.api.setAutoRoiRule(ruleId)
      if (res.status === 'success') {
        setActiveRuleId(ruleId)
      }
    } catch (e) {
      console.error('Switch rule failed', e)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] relative overflow-hidden">
      {/* 顶部开关栏 */}
      <div className="px-8 py-6 border-b border-zinc-200 bg-white flex items-center justify-between shadow-sm z-10">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
            <Settings className="text-blue-600" />
            配置调控策略
          </h2>
          <p className="text-zinc-500 mt-1 text-sm">
            系统将在倒计时结束时，使用当前选中的策略执行调节。
          </p>
        </div>
        <div
          className={`flex items-center gap-3 px-5 py-2.5 rounded-full border transition-all cursor-pointer select-none ${
            isEnabled ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-zinc-100 border-zinc-200'
          }`}
          onClick={!loading ? handleToggleEnable : undefined}
        >
          <span className={`text-sm font-bold ${isEnabled ? 'text-blue-700' : 'text-zinc-500'}`}>
            {isEnabled ? '功能已启用' : '功能已关闭'}
          </span>
          <div
            className={`relative w-10 h-6 rounded-full transition-colors ${isEnabled ? 'bg-blue-600' : 'bg-zinc-300'}`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </div>
        </div>
      </div>

      {/* 规则内容区：左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：规则列表 */}
        <div className="w-[340px] border-r border-zinc-200 bg-[#fbfbfc] p-6 overflow-y-auto space-y-4">
          <div className="text-sm font-bold text-zinc-500 mb-2 flex items-center gap-2">
            <Layers size={14} /> 可选策略
          </div>
          {rules.map((rule) => (
            <RuleOption
              key={rule.id}
              rule={rule}
              isActive={activeRuleId === rule.id}
              onSelect={handleSelectRule}
            />
          ))}
        </div>

        {/* 右侧：规则详情 (Markdown) */}
        <div className="flex-1 bg-white p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-100">
              <Info className="text-blue-500" />
              <h3 className="text-lg font-bold text-zinc-800">策略详情说明</h3>
            </div>

            <div className="prose prose-zinc prose-headings:font-bold prose-h3:text-lg prose-h4:text-base prose-p:text-sm prose-li:text-sm max-w-none text-zinc-600">
              {activeRuleDescription ? (
                <ReactMarkdown>{activeRuleDescription}</ReactMarkdown>
              ) : (
                <div className="text-zinc-400 italic">暂无描述</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
