import { useState, useEffect, useCallback } from 'react'
import { fetchDashboard } from '../api'

const CAT_EMOJI = {
  Food: '🍜', Drinks: '🧋', Groceries: '🛒', Clothing: '👕',
  Transport: '🚗', Entertainment: '🎮', Health: '💊', Bills: '📄', Other: '📦',
}

// ── Primitives ────────────────────────────────────────────────────────────────

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage({ chatId, onUnauth }) {
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('overall')
  const [lastUpdated, setLastUpdated]     = useState(null)

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

  const periodData   = selectedMonth === 'overall' ? all_time : months.find(m => m.month === selectedMonth)
  const byCategory   = periodData?.by_category || {}
  const transactions = periodData?.transactions || []
  const maxCat       = Math.max(...Object.values(byCategory), 1)
  const periodLabel  = monthOptions.find(o => o.value === selectedMonth)?.label || 'All Time'

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

      {/* ── Sticky header ── */}
      <div style={{
        padding: '0.85rem 1.1rem',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        background: 'rgba(8,8,8,0.9)',
        backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontSize: '1.1rem' }}>📊</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.2px' }}>Dashboard</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {lastUpdated && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
              {lastUpdated.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="btn-icon"
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{ opacity: refreshing ? 0.4 : 1 }}
          >
            {refreshing ? '···' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.6rem', paddingBottom: '3rem' }}>

        {/* ── KPI Cards ── */}
        <div>
          <SectionHead>Overview · This Month</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <KPICard
              label="Today"
              value={`RM ${overview.spend_today.toFixed(2)}`}
              sub={`RM ${overview.spend_yesterday.toFixed(2)} yesterday`}
              accent
            />
            <KPICard
              label="This Month"
              value={`RM ${overview.spend_this_month.toFixed(2)}`}
              sub={spend_last_month > 0 ? `RM ${spend_last_month.toFixed(0)} last month` : 'first month'}
            />
            <KPICard
              label="This Week"
              value={`RM ${overview.spend_this_week.toFixed(2)}`}
            />
            <KPICard
              label="Daily Avg"
              value={`RM ${overview.avg_daily_this_month.toFixed(2)}`}
              sub={`${overview.tx_count_this_month} transactions`}
            />
          </div>
        </div>

        {/* ── Budget Pace ── */}
        {spend_last_month > 0 && (
          <div>
            <SectionHead>Budget Pace</SectionHead>
            <div className="glass-panel" style={{ padding: '1.1rem 1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {pace_label}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                  Day {days_so_far} / {days_in_month}
                </span>
              </div>

              <div className="pace-track">
                <div className="pace-fill" style={{ width: `${Math.min(pace_pct, 100)}%`, background: pace_color }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: pace_color }}>
                  RM {spend_this_month.toFixed(0)} · {pace_pct.toFixed(0)}%
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  Last: RM {spend_last_month.toFixed(0)}
                </span>
              </div>

              {spend_this_month > 0 && days_so_far > 0 && (
                <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  Projected end-of-month · RM {((spend_this_month / days_so_far) * days_in_month).toFixed(0)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Monthly Totals ── */}
        {recentMonths.length > 1 && (
          <div>
            <SectionHead>Monthly Totals</SectionHead>
            <div className="glass-panel" style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {recentMonths.map(m => {
                const short = m.label.split(' ')[0].slice(0, 3) + ' ' + m.label.split(' ')[1]
                const pct   = Math.min((m.total / maxMonthTotal) * 100, 100)
                return (
                  <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)', minWidth: 52 }}>{short}</div>
                    <div className="bar-track" style={{ flex: 1 }}>
                      <div className="bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="bar-amount">RM {m.total.toFixed(0)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── By Category ── */}
        <div>
          <SectionHead>By Category</SectionHead>

          {/* Month selector */}
          <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
            <select
              className="glass-select"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div style={{
              position: 'absolute', right: '0.85rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
              pointerEvents: 'none', fontSize: '0.65rem',
            }}>▼</div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem 1.1rem' }}>
            {Object.entries(byCategory).map(([cat, amt]) => (
              <BarRow
                key={cat}
                label={`${CAT_EMOJI[cat] || '📦'} ${cat}`}
                amount={amt}
                maxAmount={maxCat}
              />
            ))}
            {Object.keys(byCategory).length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0' }}>
                No data for this period
              </div>
            )}
          </div>
        </div>

        {/* ── Transactions ── */}
        <div>
          <SectionHead>Transactions · {periodLabel}</SectionHead>
          <div className="glass-panel">
            {transactions.slice(0, 25).map((tx, i) => (
              <div key={i} className="tx-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tx-place">
                    {CAT_EMOJI[tx.category] || '📦'} {tx.place || '—'}
                  </div>
                  <div className="tx-meta">
                    {tx.timestamp?.slice(0, 16)} · {tx.category}
                    {tx.note ? ` · ${tx.note}` : ''}
                  </div>
                </div>
                <div className="tx-amount">RM {parseFloat(tx.amount).toFixed(2)}</div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No transactions
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}