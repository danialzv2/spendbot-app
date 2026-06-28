import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchDashboard, deleteTransaction, addTransaction, updateTransaction } from '../api'
import dashboardHeaderImg from '../components/dashboard_header.png'
import deleteImg          from '../components/delete_button_image.png'

const CAT_EMOJI = {
  Food: '🍜', Drinks: '🧋', Groceries: '🛒', Clothing: '👕',
  Transport: '🚗', Entertainment: '🎮', Health: '💊', Bills: '📄', Other: '📦',
}

const CATEGORIES = [
  { value: 'Food',          emoji: '🍜' },
  { value: 'Drinks',        emoji: '🧋' },
  { value: 'Groceries',     emoji: '🛒' },
  { value: 'Clothing',      emoji: '👕' },
  { value: 'Transport',     emoji: '🚗' },
  { value: 'Entertainment', emoji: '🎮' },
  { value: 'Health',        emoji: '💊' },
  { value: 'Bills',         emoji: '📄' },
  { value: 'Other',         emoji: '📦' },
]

const DOW       = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PAGE_SIZE = 10

// ── Field styles ──────────────────────────────────────────────────────────────

const fieldStyle = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
  padding: '0.55rem 0.75rem', color: 'var(--text-primary)',
  fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
}

const editFieldStyle = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8, padding: '0.45rem 0.65rem',
  display: 'flex', alignItems: 'center', gap: '0.35rem',
}

const editInputStyle = {
  background: 'none', border: 'none', outline: 'none',
  color: 'var(--text-primary)', fontSize: '0.88rem',
  fontFamily: 'var(--mono)', fontWeight: 600, width: '100%', minWidth: 0,
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
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: color || 'var(--accent)' }} /></div>
      <div className="bar-amount">RM {amount.toFixed(0)}</div>
    </div>
  )
}

// ── Pace + Daily Safe Spend ───────────────────────────────────────────────────

function MetricCell({ label, sublabel, value, valueColor }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.65rem 0.7rem', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '0.4rem' }}>
        {label}
        {sublabel && <div style={{ opacity: 0.75, marginTop: '0.1rem', fontSize: '0.57rem' }}>{sublabel}</div>}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem', fontWeight: 700, color: valueColor || 'var(--text-primary)', letterSpacing: '-0.3px' }}>{value}</div>
    </div>
  )
}

function SpendingPaceSection({ pace, dailySafe }) {
  if (!pace) return null
  const statusColor  = { under: 'var(--positive)', on_track: 'var(--warning)', over: 'var(--negative)', no_config: 'var(--text-muted)' }[pace.status] || 'var(--text-muted)'
  const statusIcon   = { under: '🟢', on_track: '🟡', over: '🔴', no_config: '' }[pace.status] || ''
  const hasDailySafe = dailySafe?.has_config && pace.status !== 'no_config'
  return (
    <div className="glass-panel" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{pace.headline}</div>
        {pace.sub && <div style={{ fontSize: '0.75rem', color: statusColor, marginTop: '0.2rem', fontWeight: 500 }}>{statusIcon} {pace.sub}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: hasDailySafe ? '1fr 1fr 1fr' : '1fr 1fr', gap: '0.5rem' }}>
        <MetricCell label="Current pace" value={pace.current > 0 ? `RM${pace.current}/day` : '—'} valueColor={pace.status !== 'no_config' ? statusColor : 'var(--text-muted)'} />
        <MetricCell label="Target" value={pace.target > 0 ? `RM${pace.target}/day` : '—'} valueColor="var(--text-secondary)" />
        {hasDailySafe && (
          <MetricCell
            label="Daily Safe Spend"
            sublabel={dailySafe.amount > 0 ? `${dailySafe.days_remaining}d left · RM${dailySafe.budget_remaining.toFixed(0)} rem.` : 'Budget exceeded'}
            value={dailySafe.amount > 0 ? `RM ${dailySafe.amount.toFixed(2)}` : '—'}
            valueColor={dailySafe.amount > 0 ? 'var(--accent)' : 'var(--negative)'}
          />
        )}
      </div>
    </div>
  )
}

// ── Savings Projection ────────────────────────────────────────────────────────

function SavingsProjection({ data }) {
  if (!data?.has_config) return null
  const isSaving = data.projected_savings >= 0
  const color    = isSaving ? 'var(--positive)' : 'var(--negative)'
  const spendPct = data.disposable > 0 ? Math.min((data.projected_spend / data.disposable) * 100, 100) : 0
  return (
    <div className="glass-panel" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <Row label="Disposable income" value={`RM ${data.disposable.toFixed(0)}`} valueColor="var(--text-secondary)" />
        <Row label="Projected spend" value={`− RM ${data.projected_spend.toFixed(0)}`} valueColor="var(--negative)" />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0.15rem 0' }} />
        <Row label={isSaving ? 'Estimated savings' : 'Projected overspend'} value={`RM ${Math.abs(data.projected_savings).toFixed(0)}`} valueColor={color} bold />
      </div>
      <div className="pace-track"><div className="pace-fill" style={{ width: `${spendPct}%`, background: spendPct > 90 ? 'var(--negative)' : spendPct > 70 ? 'var(--warning)' : 'var(--positive)' }} /></div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'right' }}>{spendPct.toFixed(0)}% of disposable</div>
    </div>
  )
}

function Row({ label, value, valueColor, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: bold ? '0.85rem' : '0.78rem', color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: bold ? '0.88rem' : '0.78rem', fontWeight: bold ? 700 : 500, color: valueColor || 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}

// ── Spending Heatmap ──────────────────────────────────────────────────────────

function SpendingHeatmap({ heatmap }) {
  const values = DOW.map(d => heatmap[d] || 0)
  const maxVal = Math.max(...values, 1)
  const total  = values.reduce((s, v) => s + v, 0)
  if (total === 0) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0' }}>No spending this month yet</div>
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', marginBottom: '0.4rem' }}>
        {DOW_SHORT.map(d => <div key={d} style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {values.map((val, i) => (
          <div key={i} title={`${DOW[i]}: RM ${val.toFixed(2)}`} style={{ height: 36, borderRadius: 8, background: val === 0 ? 'rgba(255,255,255,0.03)' : `rgba(200,245,100,${0.1 + (val / maxVal) * 0.75})`, border: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
        {values.map((val, i) => <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: '0.56rem', color: val > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', textAlign: 'center' }}>{val > 0 ? `RM${val.toFixed(0)}` : '—'}</div>)}
      </div>
    </div>
  )
}

// ── Anomaly Card ──────────────────────────────────────────────────────────────

function AnomalyCard({ anomaly }) {
  return (
    <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 12, padding: '0.55rem 0.85rem', marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.18rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem' }}>⚠️</span>
          {anomaly.place || anomaly.category} · RM {parseFloat(anomaly.amount).toFixed(2)}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{anomaly.timestamp?.slice(0, 16)}</div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{anomaly.description}</div>
    </div>
  )
}

// ── Transaction Row (with Edit + Delete) ──────────────────────────────────────

function TxRow({ tx, chatId, onDeleted, onUpdated, onUnauth }) {
  const [mode,     setMode]     = useState('view') // view | edit | confirm_delete | deleting
  const [amount,   setAmount]   = useState(String(tx.amount))
  const [category, setCategory] = useState(tx.category)
  const [place,    setPlace]    = useState(tx.place || '')
  const [note,     setNote]     = useState(tx.note || '')
  const [saving,   setSaving]   = useState(false)
  const timer                   = useRef(null)

  function startEdit() {
    // Reset fields to current tx values before opening
    setAmount(String(tx.amount))
    setCategory(tx.category)
    setPlace(tx.place || '')
    setNote(tx.note || '')
    setMode('edit')
  }

  function cancelEdit() {
    setMode('view')
  }

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    setSaving(true)
    try {
      await updateTransaction(chatId, tx.timestamp, {
        amount: amt, category,
        place: place.trim() || 'Unknown',
        note: note.trim(),
      })
      onUpdated(tx.timestamp, {
        ...tx, amount: amt, category,
        place: place.trim() || 'Unknown',
        note: note.trim(),
      })
      setMode('view')
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { onUnauth?.(); return }
    } finally {
      setSaving(false)
    }
  }

  function handleDeleteClick() {
    if (mode === 'view') {
      setMode('confirm_delete')
      timer.current = setTimeout(() => setMode('view'), 3000)
    } else if (mode === 'confirm_delete') {
      clearTimeout(timer.current)
      doDelete()
    }
  }

  async function doDelete() {
    setMode('deleting')
    try {
      await deleteTransaction(chatId, tx.timestamp)
      setTimeout(() => onDeleted(tx.timestamp), 300)
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { onUnauth?.(); return }
      setMode('view')
    }
  }

  if (mode === 'deleting') return null

  const isConfirmDelete = mode === 'confirm_delete'
  const canSave         = parseFloat(amount) > 0 && !saving

  // ── Edit mode — expanded inline form ─────────────────────────────────────
  if (mode === 'edit') {
    return (
      <div style={{
        padding: '0.85rem 1.1rem',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        background: 'rgba(200,245,100,0.025)',
        animation: 'fadeIn 0.15s ease',
      }}>
        {/* Reference timestamp */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Editing · {tx.timestamp?.slice(0, 16)}
        </div>

        {/* Amount + Category */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.3rem' }}>Amount</div>
            <div style={editFieldStyle}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>RM</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" style={editInputStyle} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.3rem' }}>Category</div>
            <div style={{ position: 'relative' }}>
              <select value={category} onChange={e => setCategory(e.target.value)} className="glass-select" style={{ padding: '0.45rem 1.8rem 0.45rem 0.65rem', fontSize: '0.82rem' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
              </select>
              <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '0.55rem' }}>▼</div>
            </div>
          </div>
        </div>

        {/* Place */}
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.3rem' }}>Place</div>
          <input value={place} onChange={e => setPlace(e.target.value)} placeholder="e.g. McDonald's" style={{ ...fieldStyle, fontSize: '0.85rem', padding: '0.45rem 0.75rem' }} />
        </div>

        {/* Note */}
        <div style={{ marginBottom: '0.8rem' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.3rem' }}>Note</div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="optional note" style={{ ...fieldStyle, fontSize: '0.85rem', padding: '0.45rem 0.75rem' }} />
        </div>

        {/* Cancel + Save */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={cancelEdit} className="btn-icon" style={{ flex: 1, textAlign: 'center', padding: '0.55rem', fontSize: '0.82rem' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              flex: 2, border: 'none', borderRadius: 8, padding: '0.55rem',
              background: canSave ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
              color: canSave ? '#0a0a0a' : 'var(--text-muted)',
              fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.82rem',
              cursor: canSave ? 'pointer' : 'default', transition: 'all 0.15s',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  return (
    <div className="tx-row" style={{ background: isConfirmDelete ? 'rgba(248,113,113,0.06)' : undefined, transition: 'all 0.2s ease' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tx-place">{CAT_EMOJI[tx.category] || '📦'} {tx.place || '—'}</div>
        <div className="tx-meta">{tx.timestamp?.slice(0, 16)} · {tx.category}{tx.note ? ` · ${tx.note}` : ''}</div>
      </div>

      <div className="tx-amount" style={{ marginRight: '0.4rem' }}>RM {parseFloat(tx.amount).toFixed(2)}</div>

      {/* Edit button */}
      <button
        onClick={startEdit}
        title="Modify"
        style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 7, padding: '0.35rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, width: 30, marginRight: '0.3rem', transition: 'all 0.15s',
          fontSize: '0.8rem',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,245,100,0.3)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
      >
        ✏️
      </button>

      {/* Delete button */}
      <button
        onClick={handleDeleteClick}
        style={{
          background: isConfirmDelete ? 'rgba(248,113,113,0.15)' : 'transparent',
          border: `1px solid ${isConfirmDelete ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: 7, padding: isConfirmDelete ? '0.3rem 0.5rem' : '0.35rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, minWidth: isConfirmDelete ? 52 : 30, transition: 'all 0.15s ease',
        }}
      >
        {isConfirmDelete ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--negative)', whiteSpace: 'nowrap' }}>Sure?</span>
        ) : (
          <img src={deleteImg} alt="Delete" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.4, filter: 'brightness(0) invert(1)' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
          />
        )}
      </button>
    </div>
  )
}

// ── Manual Key In ─────────────────────────────────────────────────────────────

function ManualKeyIn({ chatId, onAdded, onUnauth }) {
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState('Food')
  const [place,    setPlace]    = useState('')
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    setSaving(true); setFeedback(null)
    try {
      const result = await addTransaction(chatId, { amount: amt, category, place: place.trim() || 'Unknown', note: note.trim() })
      setAmount(''); setPlace(''); setNote(''); setCategory('Food')
      setFeedback({ msg: `✓ Logged — RM ${amt.toFixed(2)} · ${category}`, ok: true })
      onAdded(result.transaction)
      setTimeout(() => setFeedback(null), 3000)
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { onUnauth?.(); return }
      setFeedback({ msg: '⚠️ Failed to add. Try again.', ok: false })
      setTimeout(() => setFeedback(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = parseFloat(amount) > 0 && !saving

  return (
    <div className="glass-panel" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <div>
          <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.35rem' }}>Amount</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '0.55rem 0.75rem' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>RM</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()} placeholder="0.00" inputMode="decimal"
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--mono)', fontWeight: 600, width: '100%', minWidth: 0 }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.35rem' }}>Category</div>
          <div style={{ position: 'relative' }}>
            <select value={category} onChange={e => setCategory(e.target.value)} className="glass-select" style={{ padding: '0.55rem 2rem 0.55rem 0.75rem' }}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
            </select>
            <div style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '0.6rem' }}>▼</div>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.35rem' }}>Place <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></div>
        <input value={place} onChange={e => setPlace(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()} placeholder="e.g. McDonald's, Grab, Watsons" style={fieldStyle} />
      </div>
      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#c0c0c0', marginBottom: '0.35rem' }}>Note <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></div>
        <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()} placeholder="e.g. lunch with colleagues" style={fieldStyle} />
      </div>
      <button onClick={handleSubmit} disabled={!canSubmit} style={{ width: '100%', background: canSubmit ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: canSubmit ? '#0a0a0a' : 'var(--text-muted)', border: 'none', borderRadius: 10, padding: '0.75rem', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.88rem', cursor: canSubmit ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' }}>
        {saving ? 'Adding...' : '+ Add Transaction'}
      </button>
      {feedback && (
        <div style={{ marginTop: '0.65rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: feedback.ok ? 'rgba(200,245,100,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${feedback.ok ? 'rgba(200,245,100,0.2)' : 'rgba(248,113,113,0.2)'}`, fontFamily: 'var(--mono)', fontSize: '0.72rem', color: feedback.ok ? 'var(--accent)' : 'var(--negative)', animation: 'fadeIn 0.2s ease' }}>
          {feedback.msg}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage({ chatId, onUnauth }) {
  const [data, setData]                   = useState(null)
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [error, setError]                 = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('overall')
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE)
  const [showAllAnomalies, setShowAllAnomalies] = useState(false)
  const [lastUpdated, setLastUpdated]     = useState(null)

  useEffect(() => { setVisibleCount(PAGE_SIZE); setShowAllAnomalies(false) }, [selectedMonth])

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const d = await fetchDashboard(chatId)
      setData(d); setLastUpdated(new Date())
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') onUnauth?.(); else setError(e.message)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [chatId, onUnauth])

  useEffect(() => { loadData() }, [loadData])

  function handleDeleted(timestamp) {
    setData(prev => {
      if (!prev) return prev
      const rm = list => list.filter(t => t.timestamp !== timestamp)
      return { ...prev, months: prev.months.map(m => ({ ...m, transactions: rm(m.transactions) })), all_time: { ...prev.all_time, transactions: rm(prev.all_time.transactions) } }
    })
  }

  function handleUpdated(timestamp, updatedTx) {
    setData(prev => {
      if (!prev) return prev
      const update = list => list.map(t => t.timestamp === timestamp ? { ...t, ...updatedTx } : t)
      return { ...prev, months: prev.months.map(m => ({ ...m, transactions: update(m.transactions) })), all_time: { ...prev.all_time, transactions: update(prev.all_time.transactions) } }
    })
  }

  function handleTransactionAdded(newTx) {
    setData(prev => {
      if (!prev) return prev
      const now      = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const prepend  = list => [newTx, ...list]
      return {
        ...prev,
        all_time: { ...prev.all_time, transactions: prepend(prev.all_time.transactions) },
        months: prev.months.some(m => m.month === monthKey)
          ? prev.months.map(m => m.month === monthKey ? { ...m, transactions: prepend(m.transactions) } : m)
          : prev.months,
      }
    })
    setTimeout(() => loadData(true), 1500)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>loading...</div>
  if (error)   return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem' }}><div style={{ color: 'var(--negative)', fontSize: '0.85rem' }}>⚠️ {error}</div><button className="btn-primary" onClick={() => loadData()}>Try Again</button></div>
  if (!data || !data.months?.length) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.2rem' }}><div style={{ fontSize: '2rem' }}>📭</div><div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet. Start logging via Chat!</div><button className="btn-primary" onClick={() => loadData(true)}>Refresh</button></div>

  const { overview, months, all_time, insights } = data
  const monthOptions    = [{ value: 'overall', label: 'All Time' }, ...months.map(m => ({ value: m.month, label: m.label }))]
  const periodData      = selectedMonth === 'overall' ? all_time : months.find(m => m.month === selectedMonth)
  const byCategory      = periodData?.by_category || {}
  const allTransactions = periodData?.transactions || []
  const maxCat          = Math.max(...Object.values(byCategory), 1)
  const periodLabel     = monthOptions.find(o => o.value === selectedMonth)?.label || 'All Time'
  const visibleTx       = allTransactions.slice(0, visibleCount)
  const hasMore         = allTransactions.length > visibleCount
  const recentMonths    = [...months].reverse().slice(0, 6).reverse()
  const maxMonthTotal   = Math.max(...recentMonths.map(m => m.total), 1)
  const allAnomalies    = insights?.anomalies || []
  const visibleAnomalies = showAllAnomalies ? allAnomalies : allAnomalies.slice(0, 3)
  const hiddenCount     = allAnomalies.length - 3

  return (
    <div style={{ height: '100%', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }}>

      {/* Header */}
      <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
        <div />
        <img src={dashboardHeaderImg} alt="Dashboard" style={{ height: 28, objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {lastUpdated && <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--text-muted)' }}>{lastUpdated.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button className="btn-icon" onClick={() => loadData(true)} disabled={refreshing} style={{ opacity: refreshing ? 0.4 : 1 }}>{refreshing ? '···' : '↻ Refresh'}</button>
        </div>
      </div>

      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.6rem', paddingBottom: '3rem' }}>

        {/* KPI Cards */}
        <div>
          <SectionHead>Overview · This Month</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <KPICard label="Today" value={`RM ${overview.spend_today.toFixed(2)}`} sub={`RM ${overview.spend_yesterday.toFixed(2)} yesterday`} accent />
            <KPICard label="This Month" value={`RM ${overview.spend_this_month.toFixed(2)}`} sub={overview.spend_last_month > 0 ? `RM ${overview.spend_last_month.toFixed(0)} last month` : 'first month'} />
            <KPICard label="This Week" value={`RM ${overview.spend_this_week.toFixed(2)}`} />
            <KPICard label="Daily Avg" value={`RM ${overview.avg_daily_this_month.toFixed(2)}`} sub={`${overview.tx_count_this_month} transactions`} />
          </div>
        </div>

        {/* Spending Pace + Daily Safe Spend */}
        {insights?.pace && <div><SectionHead>Spending Pace</SectionHead><SpendingPaceSection pace={insights.pace} dailySafe={insights.daily_safe_spend} /></div>}

        {/* Savings Projection */}
        {insights?.savings?.has_config && <div><SectionHead>Savings This Month</SectionHead><SavingsProjection data={insights.savings} /></div>}

        {/* Heatmap */}
        <div><SectionHead>Spending by Day · This Month</SectionHead><div className="glass-panel" style={{ padding: '1rem 1.1rem' }}><SpendingHeatmap heatmap={insights?.heatmap || {}} /></div></div>

        {/* Anomalies */}
        {allAnomalies.length > 0 && (
          <div>
            <SectionHead>Unusual Activity <span style={{ float: 'right', color: 'var(--negative)', fontWeight: 400 }}>{allAnomalies.length} flagged</span></SectionHead>
            {visibleAnomalies.map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
            {!showAllAnomalies && hiddenCount > 0 && <button className="btn-icon" onClick={() => setShowAllAnomalies(true)} style={{ width: '100%', textAlign: 'center', marginTop: '0.25rem', fontSize: '0.72rem', padding: '0.5rem' }}>Show More ({hiddenCount} more)</button>}
            {showAllAnomalies && allAnomalies.length > 3 && <button className="btn-icon" onClick={() => setShowAllAnomalies(false)} style={{ width: '100%', textAlign: 'center', marginTop: '0.25rem', fontSize: '0.72rem', padding: '0.5rem' }}>Show Less ↑</button>}
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
                    <div className="bar-track" style={{ flex: 1 }}><div className="bar-fill" style={{ width: `${Math.min((m.total / maxMonthTotal) * 100, 100)}%` }} /></div>
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
            {Object.entries(byCategory).map(([cat, amt]) => <BarRow key={cat} label={`${CAT_EMOJI[cat] || '📦'} ${cat}`} amount={amt} maxAmount={maxCat} />)}
            {Object.keys(byCategory).length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0' }}>No data for this period</div>}
          </div>
        </div>

        {/* Transactions */}
        <div>
          <SectionHead>Transactions · {periodLabel}<span style={{ float: 'right', color: 'var(--text-secondary)', fontWeight: 400 }}>{allTransactions.length} total</span></SectionHead>
          <div className="glass-panel">
            {visibleTx.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No transactions</div>}
            {visibleTx.map((tx, i) => (
              <TxRow key={`${tx.timestamp}-${i}`} tx={tx} chatId={chatId} onDeleted={handleDeleted} onUpdated={handleUpdated} onUnauth={onUnauth} />
            ))}
            {hasMore && (
              <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>Showing {visibleCount} of {allTransactions.length}</span>
                <button className="btn-icon" onClick={() => setVisibleCount(p => p + PAGE_SIZE)} style={{ fontSize: '0.72rem' }}>See More ↓</button>
              </div>
            )}
            {!hasMore && allTransactions.length > PAGE_SIZE && (
              <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                <button className="btn-icon" onClick={() => setVisibleCount(PAGE_SIZE)} style={{ fontSize: '0.65rem' }}>Show Less ↑</button>
              </div>
            )}
          </div>
        </div>

        {/* Manual Key In */}
        <div>
          <SectionHead>Manual Key In</SectionHead>
          <ManualKeyIn chatId={chatId} onAdded={handleTransactionAdded} onUnauth={onUnauth} />
        </div>

      </div>
    </div>
  )
}