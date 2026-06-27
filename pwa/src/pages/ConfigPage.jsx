import { useState, useEffect, useCallback } from 'react'
import { getConfig, saveConfig } from '../api'

export default function ConfigPage({ chatId, onUnauth }) {
  const [salary, setSalary]           = useState('')
  const [commitments, setCommitments] = useState([])
  const [newLabel, setNewLabel]       = useState('')
  const [newAmount, setNewAmount]     = useState('')
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [dirty, setDirty]             = useState(false)
  const [toast, setToast]             = useState(null)
  const [error, setError]             = useState(null)

  // ── Load from backend ─────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getConfig(chatId)
      setSalary(data.salary > 0 ? String(data.salary) : '')
      setCommitments(data.commitments || [])
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') onUnauth?.()
      else setError(e.message)
    } finally {
      setLoading(false)
      setDirty(false)
    }
  }, [chatId, onUnauth])

  useEffect(() => { loadConfig() }, [loadConfig])

  // ── Save to backend ───────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      await saveConfig(chatId, parseFloat(salary) || 0, commitments)
      setDirty(false)
      showToast('✓ Saved to Google Sheets')
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') onUnauth?.()
      else showToast('⚠️ Save failed. Try again.', true)
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg, isError = false) {
    setToast({ msg, isError })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Commitment helpers ────────────────────────────────────────────────────
  function addCommitment() {
    if (!newLabel.trim() || !newAmount) return
    setCommitments(prev => [...prev, { label: newLabel.trim(), amount: parseFloat(newAmount) }])
    setNewLabel('')
    setNewAmount('')
    setDirty(true)
  }

  function removeCommitment(index) {
    setCommitments(prev => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  function updateCommitment(index, field, value) {
    setCommitments(prev => prev.map((c, i) =>
      i === index ? { ...c, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : c
    ))
    setDirty(true)
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const sal          = parseFloat(salary) || 0
  const totalCommit  = commitments.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  const disposable   = sal - totalCommit
  const commitRatio  = sal > 0 ? Math.min((totalCommit / sal) * 100, 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
      loading...
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem' }}>
      <div style={{ color: 'var(--negative)', fontSize: '0.85rem' }}>⚠️ {error}</div>
      <button className="btn-primary" onClick={loadConfig}>Try Again</button>
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '0.85rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontSize: '1.1rem' }}>⚙️</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.2px' }}>Configure</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {dirty && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--warning)' }}>
              unsaved
            </span>
          )}
          <button
            className="btn-icon"
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{ opacity: !dirty || saving ? 0.4 : 1, color: dirty ? 'var(--accent)' : undefined }}
          >
            {saving ? '···' : '↑ Save'}
          </button>
        </div>
      </div>

      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.6rem', paddingBottom: '3rem' }}>

        {/* ── Net Income Summary ── */}
        {sal > 0 && (
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.8px', marginBottom: '0.9rem' }}>
              Monthly Summary
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <SummaryRow label="Salary" value={sal} color="var(--positive)" prefix="+" />
              <SummaryRow label="Commitments" value={totalCommit} color="var(--negative)" prefix="−" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0.3rem 0' }} />
              <SummaryRow
                label="Disposable"
                value={disposable}
                color={disposable >= 0 ? 'var(--accent)' : 'var(--negative)'}
                bold
              />
            </div>

            {/* Commitment ratio bar */}
            {sal > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <span>Fixed commitments</span>
                  <span>{commitRatio.toFixed(0)}% of salary</span>
                </div>
                <div className="pace-track">
                  <div
                    className="pace-fill"
                    style={{
                      width: `${commitRatio}%`,
                      background: commitRatio > 70 ? 'var(--negative)' : commitRatio > 50 ? 'var(--warning)' : 'var(--positive)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Salary ── */}
        <div>
          <div className="section-head">Monthly Salary</div>
          <div className="glass-panel" style={{ padding: '1rem 1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', flexShrink: 0 }}>RM</span>
              <input
                type="number"
                value={salary}
                onChange={e => { setSalary(e.target.value); setDirty(true) }}
                placeholder="0.00"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ── Commitments ── */}
        <div>
          <div className="section-head">
            Monthly Commitments
            <span style={{ float: 'right', color: 'var(--text-secondary)', fontWeight: 400 }}>
              {commitments.length} item{commitments.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Commitments list */}
          {commitments.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: '0.75rem' }}>
              {commitments.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.7rem 1rem',
                  borderBottom: i < commitments.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                }}>
                  {/* Label */}
                  <input
                    value={c.label}
                    onChange={e => updateCommitment(i, 'label', e.target.value)}
                    placeholder="Label"
                    style={{ ...inputStyle, flex: 2, fontSize: '0.85rem' }}
                  />

                  {/* Amount */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>RM</span>
                    <input
                      type="number"
                      value={c.amount}
                      onChange={e => updateCommitment(i, 'amount', e.target.value)}
                      placeholder="0"
                      style={{ ...inputStyle, flex: 1, fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeCommitment(i)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '1rem', padding: '0.2rem',
                      flexShrink: 0, lineHeight: 1,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.target.style.color = 'var(--negative)'}
                    onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new commitment */}
          <div className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.65rem' }}>
              Add Commitment
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCommitment()}
                placeholder="e.g. Rent"
                style={{ ...inputStyle, flex: 2 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>RM</span>
                <input
                  type="number"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCommitment()}
                  placeholder="0"
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <button
                onClick={addCommitment}
                disabled={!newLabel.trim() || !newAmount}
                style={{
                  background: newLabel.trim() && newAmount ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                  color: newLabel.trim() && newAmount ? '#0a0a0a' : 'var(--text-muted)',
                  border: 'none', borderRadius: 8, padding: '0.55rem 0.9rem',
                  fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                  flexShrink: 0, transition: 'background 0.15s, color 0.15s',
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* ── Common commitments hint ── */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          Common commitments: Rent · Car loan · Insurance · Phone bill ·<br />
          Internet · Netflix · Gym · Savings transfer · PTPTN
        </div>

      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)',
          background: toast.isError ? 'rgba(248,113,113,0.15)' : 'rgba(200,245,100,0.12)',
          border: `1px solid ${toast.isError ? 'rgba(248,113,113,0.3)' : 'rgba(200,245,100,0.25)'}`,
          borderRadius: 10, padding: '0.6rem 1.2rem',
          fontFamily: 'var(--mono)', fontSize: '0.75rem',
          color: toast.isError ? 'var(--negative)' : 'var(--accent)',
          backdropFilter: 'blur(20px)', zIndex: 100,
          animation: 'fadeIn 0.2s ease',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SummaryRow({ label, value, color, prefix = '', bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: bold ? '0.9rem' : '0.82rem', color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: bold ? '1rem' : '0.85rem', fontWeight: bold ? 700 : 500, color }}>
        {prefix} RM {Math.abs(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}