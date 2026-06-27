import { useState, useEffect } from 'react'
import { fetchDashboard } from '../api'

const CAT_EMOJI = {
  Food: '🍜', Drinks: '🧋', Groceries: '🛒', Clothing: '👕',
  Transport: '🚗', Entertainment: '🎮', Health: '💊', Bills: '📄', Other: '📦',
}

// ── Reusable components ───────────────────────────────────────────────────────

function SectionHead({ children }) {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
      textTransform: 'uppercase', letterSpacing: '2px', color: '#3a3a3a',
      padding: '0.5rem 0', borderBottom: '1px solid #1a1a1a', marginBottom: '0.75rem',
    }}>
      {children}
    </div>
  )
}

function KPICard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 14,
      padding: '0.9rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #c8f564, transparent)',
      }} />
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
        color: '#444', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.3rem',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: accent ? '#c8f564' : '#ede8df', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#444', marginTop: '0.25rem' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function BarRow({ label, amount, maxAmount, color = '#c8f564' }) {
  const pct = maxAmount > 0 ? Math.min((amount / maxAmount) * 100, 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
      <div style={{
        fontSize: '0.78rem', color: '#aaa', minWidth: 90, maxWidth: 90,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 7, background: '#1a1a1a', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem',
        color: '#666', minWidth: 58, textAlign: 'right',
      }}>
        RM {amount.toFixed(0)}
      </div>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage({ chatId }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('overall')

  useEffect(() => {
    setLoading(true)
    fetchDashboard(chatId)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [chatId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
      Loading...
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#f87171', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>
      ⚠️ {error}
    </div>
  )

  if (!data || !data.months?.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>
      No data yet. Start logging via the Chat tab!
    </div>
  )

  const { overview, months, all_time } = data

  // Month dropdown options
  const monthOptions = [
    { value: 'overall', label: 'Overall (All Time)' },
    ...months.map(m => ({ value: m.month, label: m.label })),
  ]

  // Selected period data
  const periodData     = selectedMonth === 'overall' ? all_time : months.find(m => m.month === selectedMonth)
  const byCategory     = periodData?.by_category || {}
  const transactions   = periodData?.transactions || []
  const maxCat         = Math.max(...Object.values(byCategory), 1)
  const periodLabel    = monthOptions.find(o => o.value === selectedMonth)?.label || 'Overall'

  // Budget pace (always vs last month)
  const { spend_this_month, spend_last_month, days_so_far } = overview
  const days_in_month  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const expected       = spend_last_month > 0 ? (spend_last_month / days_in_month) * days_so_far : 0
  const pace_pct       = spend_last_month > 0 ? Math.min((spend_this_month / spend_last_month) * 100, 150) : 0
  const pace_color     = spend_this_month <= expected * 0.85 ? '#4ade80' : spend_this_month <= expected * 1.15 ? '#fbbf24' : '#f87171'
  const pace_label     = spend_this_month <= expected * 0.85 ? '🟢 Under pace' : spend_this_month <= expected * 1.15 ? '🟡 On track' : '🔴 Ahead of pace'

  // Monthly totals for bar chart (last 6)
  const recentMonths   = [...months].reverse().slice(0, 6).reverse()
  const maxMonthTotal  = Math.max(...recentMonths.map(m => m.total), 1)

  return (
    <div style={{ padding: '0 0 2rem' }}>

      {/* Header */}
      <div style={{
        padding: '0.9rem 1rem', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        background: '#0a0a0a', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontSize: '1.3rem' }}>📊</span>
        <div style={{ fontWeight: 800, fontSize: '1rem' }}>Dashboard</div>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Overview KPIs (always current month context) ── */}
        <div>
          <SectionHead>Overview — This Month</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <KPICard
              label="Today"
              value={`RM ${overview.spend_today.toFixed(2)}`}
              sub={`RM ${overview.spend_yesterday.toFixed(2)} yesterday`}
              accent
            />
            <KPICard
              label="This Month"
              value={`RM ${overview.spend_this_month.toFixed(2)}`}
              sub={spend_last_month > 0 ? `last month RM ${spend_last_month.toFixed(0)}` : 'first month'}
            />
            <KPICard
              label="This Week"
              value={`RM ${overview.spend_this_week.toFixed(2)}`}
            />
            <KPICard
              label="Daily Avg"
              value={`RM ${overview.avg_daily_this_month.toFixed(2)}`}
              sub={`${overview.tx_count_this_month} tx this month`}
            />
          </div>
        </div>

        {/* ── Budget Pace ── */}
        {spend_last_month > 0 && (
          <div>
            <SectionHead>Budget Pace</SectionHead>
            <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '1rem' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#444', marginBottom: '0.6rem' }}>
                {pace_label} · Day {days_so_far} of {days_in_month}
              </div>
              <div style={{ height: 10, background: '#1a1a1a', borderRadius: 99, overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{
                  width: `${Math.min(pace_pct, 100)}%`, height: '100%',
                  background: pace_color, borderRadius: 99, transition: 'width 0.6s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem' }}>
                <span style={{ color: pace_color }}>RM {spend_this_month.toFixed(0)} ({pace_pct.toFixed(0)}%)</span>
                <span style={{ color: '#333' }}>Last month: RM {spend_last_month.toFixed(0)}</span>
              </div>
              {spend_this_month > 0 && days_so_far > 0 && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#555', marginTop: '0.5rem' }}>
                  Projected end-of-month: RM {((spend_this_month / days_so_far) * days_in_month).toFixed(0)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Monthly Totals trend ── */}
        {recentMonths.length > 1 && (
          <div>
            <SectionHead>Monthly Totals</SectionHead>
            <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentMonths.map(m => {
                const shortLabel = m.label.split(' ')[0].slice(0, 3) + ' ' + m.label.split(' ')[1]
                return (
                  <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#444', minWidth: 55 }}>
                      {shortLabel}
                    </div>
                    <div style={{ flex: 1, height: 7, background: '#1a1a1a', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min((m.total / maxMonthTotal) * 100, 100)}%`,
                        height: '100%', background: '#c8f564', borderRadius: 99,
                      }} />
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#666', minWidth: 58, textAlign: 'right' }}>
                      RM {m.total.toFixed(0)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── By Category (with month dropdown) ── */}
        <div>
          <SectionHead>By Category</SectionHead>

          {/* Month selector */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{
                width: '100%', background: '#111', border: '1px solid #222',
                borderRadius: 10, padding: '0.7rem 2rem 0.7rem 1rem',
                color: '#ede8df', fontSize: '0.88rem', outline: 'none',
              }}
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div style={{
              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              color: '#555', pointerEvents: 'none', fontSize: '0.75rem',
            }}>▼</div>
          </div>

          {Object.entries(byCategory).map(([cat, amt]) => (
            <BarRow
              key={cat}
              label={`${CAT_EMOJI[cat] || '📦'} ${cat}`}
              amount={amt}
              maxAmount={maxCat}
            />
          ))}

          {Object.keys(byCategory).length === 0 && (
            <div style={{ color: '#444', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
              No data for this period
            </div>
          )}
        </div>

        {/* ── Transactions ── */}
        <div>
          <SectionHead>Transactions · {periodLabel}</SectionHead>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, overflow: 'hidden' }}>
            {transactions.slice(0, 25).map((tx, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.7rem 1rem', gap: '0.5rem',
                  borderBottom: i < Math.min(transactions.length, 25) - 1 ? '1px solid #161616' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.85rem', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {CAT_EMOJI[tx.category] || '📦'} {tx.place || '—'}
                  </div>
                  <div style={{
                    fontSize: '0.65rem', color: '#444',
                    fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
                  }}>
                    {tx.timestamp?.slice(0, 16)} · {tx.category}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem',
                  fontWeight: 600, color: '#c8f564', whiteSpace: 'nowrap',
                }}>
                  RM {parseFloat(tx.amount).toFixed(2)}
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#444', fontSize: '0.85rem' }}>
                No transactions
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
