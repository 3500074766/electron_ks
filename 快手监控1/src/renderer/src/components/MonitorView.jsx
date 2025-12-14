import React, { useEffect, useRef } from 'react'
import {
  Clock,
  Zap,
  Settings,
  Search,
  AlertCircle,
  CreditCard,
  History,
  RefreshCw
} from 'lucide-react'

// --- 1. 直接在此处重写 UI 组件 ---

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
    if (integerOnly && !/^\d*$/.test(val)) return
    if (!integerOnly && !/^\d*\.?\d*$/.test(val)) return
    const numVal = parseFloat(val)
    if (!isNaN(numVal) && numVal > max) return
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
        if (baseValue === '' || baseValue == null)
          baseValue = currPlaceholder || (min !== -Infinity ? String(min) : '0')
        let numVal = parseFloat(baseValue)
        if (isNaN(numVal)) numVal = 0
        let newValue
        if (step && step > 0) {
          newValue = isUp
            ? (Math.floor(numVal / step) + 1) * step
            : (Math.ceil(numVal / step) - 1) * step
        } else {
          const delta = isUp ? 1 : -1
          newValue = Math.round((numVal + delta) * 100) / 100
        }
        const effectiveMin = wheelMin !== -Infinity ? wheelMin : min
        const effectiveMax = wheelMax !== -Infinity ? wheelMax : max
        if (effectiveMin !== -Infinity && newValue < effectiveMin) newValue = effectiveMin
        if (effectiveMax !== -Infinity && newValue > effectiveMax) newValue = effectiveMax
        if (currOnChange) currOnChange({ target: { value: String(newValue) } })
      }
    }
    el.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => el.removeEventListener('wheel', handleWheelNative)
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

// --- 2. MonitorView 组件主体 ---

export default function MonitorView({
  lastUpdateTime,
  countdown,
  minCost,
  setMinCost,
  maxCost,
  setMaxCost,
  tempInterval,
  handleIntervalInputChange,
  commitIntervalUpdate,
  handleIntervalKeyDown,
  refreshAll,
  loading,
  sortedData,
  COLUMNS,
  sortConfig,
  handleSort,
  selectedUid,
  setSelectedUid,
  formatUrl,
  openRecharge,
  openHistory,
  handleEditRoiChange,
  submitRoi
}) {
  // 本地格式化时间函数
  const formatTime = (s) => {
    const safeS = parseInt(s, 10)
    if (isNaN(safeS)) return '00:00'
    if (safeS <= 0) return '同步中...'
    return `${Math.floor(safeS / 60)
      .toString()
      .padStart(2, '0')}:${(safeS % 60).toString().padStart(2, '0')}`
  }

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

          <Button onClick={refreshAll} loading={loading} className="shadow-lg shadow-blue-200">
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
                    className={`transition-all duration-200 cursor-pointer group border-b border-zinc-50 last:border-0 select-none ${isSelected ? 'bg-blue-100/60 hover:bg-blue-100' : 'hover:bg-blue-50'}`}
                  >
                    <td className="pl-8 pr-3 py-2.5 text-left w-56">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 overflow-hidden border border-zinc-200 shrink-0 shadow-sm group-hover:shadow-md transition-all">
                          {row.头像 && (
                            <img src={formatUrl(row.头像)} className="w-full h-full object-cover" />
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
  )
}
