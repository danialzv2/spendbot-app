import { useState, useEffect } from 'react'
import ChatPage from './pages/ChatPage'
import DashboardPage from './pages/DashboardPage'
import ConfigPage from './pages/ConfigPage'
import BottomNav from './components/BottomNav'
import { verifyPin, setToken, clearToken } from './api'

const CHAT_ID = import.meta.env.VITE_USER_ID || 'default_user'

export default function App() {
  const [tab, setTab]           = useState('chat')
  const [authed, setAuthed]     = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('spendbot_token') || ''
    if (stored) {
      verifyPin(stored)
        .then(ok => { if (ok) setAuthed(true); else clearToken() })
        .catch(() => {})
        .finally(() => setChecking(false))
    } else {
      setChecking(false)
    }
  }, [])

  function handleLogout() {
    clearToken()
    setAuthed(false)
  }

  if (checking) return <LoadingScreen />
  if (!authed)  return <PinScreen onAuth={() => setAuthed(true)} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        <div style={{ display: tab === 'chat' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ChatPage chatId={CHAT_ID} onUnauth={handleLogout} />
        </div>

        <div style={{ display: tab === 'dashboard' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
          <DashboardPage chatId={CHAT_ID} onUnauth={handleLogout} />
        </div>

        <div style={{ display: tab === 'config' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
          <ConfigPage chatId={CHAT_ID} onUnauth={handleLogout} />
        </div>

      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: '0.8rem' }}>
      <div style={{ fontSize: '2.2rem' }}>💸</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '2px' }}>LOADING</div>
    </div>
  )
}

function PinScreen({ onAuth }) {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!pin.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const ok = await verifyPin(pin.trim())
      if (ok) { setToken(pin.trim()); onAuth() }
      else    { setError('Wrong PIN. Try again.'); setPin('') }
    } catch {
      setError('Could not connect. Check your internet.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100dvh', padding: '2rem', gap: '1rem',
      background: 'radial-gradient(ellipse at 50% 60%, rgba(200,245,100,0.04) 0%, transparent 70%)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(200,245,100,0.15), rgba(200,245,100,0.05))',
        border: '1px solid rgba(200,245,100,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.8rem', marginBottom: '0.5rem', backdropFilter: 'blur(20px)',
      }}>
        💸
      </div>

      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>SpendBot</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Enter your PIN to continue</div>
      </div>

      <input
        value={pin}
        onChange={e => { setPin(e.target.value); setError('') }}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="••••••"
        type="password"
        inputMode="numeric"
        autoFocus
        style={{
          width: '100%', maxWidth: 280,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${error ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 12, padding: '0.9rem 1rem',
          color: 'var(--text-primary)', fontSize: '1.1rem',
          textAlign: 'center', letterSpacing: '0.4rem', outline: 'none',
          transition: 'border-color 0.15s', fontFamily: 'inherit',
        }}
      />

      {error && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--negative)' }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !pin.trim()}
        className="btn-primary"
        style={{ width: '100%', maxWidth: 280, opacity: !pin.trim() || loading ? 0.4 : 1 }}
      >
        {loading ? 'Verifying...' : 'Enter →'}
      </button>
    </div>
  )
}