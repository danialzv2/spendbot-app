import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchDashboard, deleteTransaction } from '../api'
import dashboardImg  from '../components/dashboard_image.png'
import deleteImg     from '../components/delete_button_image.png'

const CAT_EMOJI = {
  Food: '🍜', Drinks: '🧋', Groceries: '🛒', Clothing: '👕',
  Transport: '🚗', Entertainment: '🎮', Health: '💊', Bills: '📄', Other: '📦',
}

const PAGE_SIZE = 10

function SectionHead({ children }) {
  return <div className="section-head">{children}</div>
}

function KPICard({ label, value, sub, accent }) {
  return (
    <div className="kpi-card">
      <div className="card-label">{label}</div>
      <div className={`card-value${accent ? ' accent' : ''}`}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}

function BarRow({ label, amount, maxAmount, color }) {
  const pct = maxAmount > 0 ? Math.min((amount / maxAmount) * 100, 100) : 0
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color || 'var(--accent)' }} />
      </div>
      <div className="bar-amount">RM {amount.toFixed(0)}</div>
    </div>
  )
}

function TxRow({ tx, chatId, onDeleted, onUnauth }) {
  const [state, setState] = useState('idle')
  const confirmTimer      = useRef(null)

  function handleDeleteClick() {
    if (state === 'idle') {
      setState('confirm')
      confirmTimer.current = setTimeout(() => setState('idle'), 3000)
    } else if (state === 'confirm') {
      clearTimeout(confirmTimer.current)
      doDelete()
    }
  }

  async function doDelete() {
    setState('deleting')
    try {
      await deleteTransaction(chatId, tx.timestamp)
      setState('deleted')
      setTimeout(() => onDeleted(tx.timestamp), 300)
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { onUnauth?.(); return }
      setState('idle')
    }
  }

  if (state === 'deleted') return null

  const isConfirm  = state === 'confirm'
  const isDeleting = state === 'deleting'

  return (
    <div
      className="tx-row"
      style={{
        background: isConfirm ? 'rgba(248,113,113,0.06)' : undefined,
        transition: 'background 0.2s ease, opacity 0.3s ease',
        opacity: isDeleting ? 0.4 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tx-place">{CAT_EMOJI[tx.category] || '📦'} {tx.place || '—'}</div>
        <div className="tx-meta">
          {tx.timestamp?.slice(0, 16)} · {tx.category}
          {tx.note ? ` · ${tx.note}` : ''}
        </div>
      </div>

      <div className="tx-amount" style={{ marginRight: '0.5rem' }}>
        RM {parseFloat(tx.amount).toFixed(2)}
      </div>

      {/* Delete button with image */}
      <button
        onClick={handleDeleteClick}
        disabled={isDeleting}
        title={isConfirm ? 'Tap again to confirm' : 'Delete transaction'}
        style={{
          background: isConfirm ? 'rgba(248,113,113,0.15)' : 'transparent',
          border: `1px solid ${isConfirm ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: 7,
          padding: isConfirm ? '0.3rem 0.5rem' : '0.35rem',
          cursor: isDeleting ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          minWidth: isConfirm ? 52 : 30,
        }}
      >
        {isDeleting ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>···</span>
        ) : isConfirm ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--negative)', whiteSpace: 'nowrap' }}>Sure?</span>
        ) : (
          <img
            src={deleteImg}
            alt="Delete"
            style={{
              width: 16, height: 16, objectFit: 'contain',
              opacity: 0.4,
              filter: 'brightness(0) invert(1)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
          />
        )}
      </button>
    </div>
  )
}

export default function DashboardPage({ chatId, onUnauth }) {
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('overall')
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE)
  const [lastUpdated, setLastUpdated]     = useState(null)

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [selectedMonth])

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const d = await fetchDashboard(chatId)
      setData(d)
      setLastUpdated(new Date())
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') onUnauth?.()
      else setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [chatId, onUnauth])

  useEffect(() => { loadData() }, [loadData])

  function handleDeleted(timestamp) {
    setData(prev => {
      if (!prev) return prev
      const removeTx = txList => txList.filter(t => t.timestamp !== timestamp)
      return {
        ...prev,
        months:   prev.months.map(m => ({ ...m, transactions: removeTx(m.transactions) })),
        all_time: { ...prev.all_time, transactions: removeTx(prev.all_time.transactions) },
      }
    })
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
      loading...
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem' }}>
      <div style={{ color: 'var(--negative)', fontSize: '0.85rem', textAlign: 'center' }}>⚠️ {error}</div>
      <button className="btn-primary" onClick={() => loadData()}>Try Again</button>
    </div>
  )

  if (!data || !data.months?.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.2rem' }}>
      <div style={{ fontSize: '2rem' }}>📭</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet. Start logging via Chat!</div>
      <button className="btn-primary" onClick={() => loadData(true)}>Refresh</button>
    </div>
  )

  const { overview, months, all_time } = data

  const monthOptions = [
    { value: 'overall', label: 'All Time' },
    ...months.map(m => ({ value: m.month, label: m.label })),
  ]

  const periodData      = selectedMonth === 'overall' ? all_time : months.find(m => m.month === selectedMonth)
  const byCategory      = periodData?.by_category || {}
  const allTransactions = periodData?.transactions || []
  const maxCat          = Math.max(...Object.values(byCategory), 1)
  const periodLabel     = monthOptions.find(o => o.value === selectedMonth)?.label || 'All Time'

  const visibleTransactions = allTransactions.slice(0, visibleCount)
  const hasMore             = allTransactions.length > visibleCount

  const { spend_this_month, spend_last_month, days_so_far } = overview
  const days_in_month = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const expected      = spend_last_month > 0 ? (spend_last_month / days_in_month) * days_so_far : 0
  const pace_pct      = spend_last_month > 0 ? Math.min((spend_this_month / spend_last_month) * 100, 150) : 0
  const pace_color    = spend_this_month <= expected * 0.85 ? 'var(--positive)' : spend_this_month <= expected * 1.15 ? 'var(--warning)' : 'var(--negative)'
  const pace_label    = spend_this_month <= expected * 0.85 ? '🟢 Under pace' : spend_this_month <= expected * 1.15 ? '🟡 On track' : '🔴 Ahead of pace'

  const recentMonths  = [...months].reverse().slice(0, 6).reverse()
  const maxMonthTotal = Math.max(...recentMonths.map(m => m.total), 1)

  return (
    <div style={{ height: '100%', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }}>

      {/* ── Centered header ── */}
      <div style={{
        padding: '0.85rem 1.1rem',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(8,8,8,0.9)',
        backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 10,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
      }}>
        {/* Left — spacer */}
        <div />

        {/* Center — title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src={dashboardImg} alt="" style={{ height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.2px' }}>Dashboard</span>
        </div>

        {/* Right — refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {lastUpdated && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
              {lastUpdated.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn-icon" onClick={() => loadData(true)} disabled={refreshing} style={{ opacity: refreshing ? 0.4 : 1 }}>
            {refreshing ? '···' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.6rem', paddingBottom: '3rem' }}>

        {/* KPI Cards */}
        <div>
          <SectionHead>Overview · This Month</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <KPICard label="Today" value={`RM ${overview.spend_today.toFixed(2)}`} sub={`RM ${overview.spend_yesterday.toFixed(2)} yesterday`} accent />
            <KPICard label="This Month" value={`RM ${overview.spend_this_month.toFixed(2)}`} sub={spend_last_month > 0 ? `RM ${spend_last_month.toFixed(0)} last month` : 'first month'} />
            <KPICard label="This Week" value={`RM ${overview.spend_this_week.toFixed(2)}`} />
            <KPICard label="Daily Avg" value={`RM ${overview.avg_daily_this_month.toFixed(2)}`} sub={`${overview.tx_count_this_month} transactions`} />
          </div>
        </div>

        {/* Budget Pace */}
        {spend_last_month > 0 && (
          <div>
            <SectionHead>Budget Pace</SectionHead>
            <div className="glass-panel" style={{ padding: '1.1rem 1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{pace_label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>Day {days_so_far} / {days_in_month}</span>
              </div>
              <div className="pace-track">
                <div className="pace-fill" style={{ width: `${Math.min(pace_pct, 100)}%`, background: pace_color }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: pace_color }}>RM {spend_this_month.toFixed(0)} · {pace_pct.toFixed(0)}%</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>Last: RM {spend_last_month.toFixed(0)}</span>
              </div>
              {spend_this_month > 0 && days_so_far > 0 && (
                <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  Projected end-of-month · RM {((spend_this_month / days_so_far) * days_in_month).toFixed(0)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Totals */}
        {recentMonths.length > 1 && (
          <div>
            <SectionHead>Monthly Totals</SectionHead>
            <div className="glass-panel" style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {recentMonths.map(m => {
                const short = m.label.split(' ')[0].slice(0, 3) + ' ' + m.label.split(' ')[1]
                return (
                  <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)', minWidth: 52 }}>{short}</div>
                    <div className="bar-track" style={{ flex: 1 }}>
                      <div className="bar-fill" style={{ width: `${Math.min((m.total / maxMonthTotal) * 100, 100)}%` }} />
                    </div>
                    <div className="bar-amount">RM {m.total.toFixed(0)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* By Category */}
        <div>
          <SectionHead>By Category</SectionHead>
          <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
            <select className="glass-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '0.65rem' }}>▼</div>
          </div>
          <div className="glass-panel" style={{ padding: '1rem 1.1rem' }}>
            {Object.entries(byCategory).map(([cat, amt]) => (
              <BarRow key={cat} label={`${CAT_EMOJI[cat] || '📦'} ${cat}`} amount={amt} maxAmount={maxCat} />
            ))}
            {Object.keys(byCategory).length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0' }}>No data for this period</div>
            )}
          </div>
        </div>

        {/* Transactions */}
        <div>
          <SectionHead>
            Transactions · {periodLabel}
            <span style={{ float: 'right', color: 'var(--text-secondary)', fontWeight: 400 }}>
              {allTransactions.length} total
            </span>
          </SectionHead>
          <div className="glass-panel">
            {visibleTransactions.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No transactions</div>
            )}
            {visibleTransactions.map((tx, i) => (
              <TxRow key={`${tx.timestamp}-${i}`} tx={tx} chatId={chatId} onDeleted={handleDeleted} onUnauth={onUnauth} />
            ))}

            {hasMore && (
              <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  Showing {visibleCount} of {allTransactions.length}
                </span>
                <button className="btn-icon" onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)} style={{ fontSize: '0.72rem' }}>
                  See More ↓
                </button>
              </div>
            )}

            {!hasMore && allTransactions.length > PAGE_SIZE && (
              <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                <button className="btn-icon" onClick={() => setVisibleCount(PAGE_SIZE)} style={{ fontSize: '0.65rem' }}>
                  Show Less ↑
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}