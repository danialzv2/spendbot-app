import { useState, useRef, useEffect } from 'react'
import { sendChat, uploadReceipt } from '../api'
import logoImg from '../components/spendbot_logo_image.png'

function parseMd(text) {
  return text
    .replace(/\*([^*]+)\*/g, '<b>$1</b>')
    .replace(/_([^_]+)_/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code style="background:#1e1e1e;padding:1px 5px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:0.85em">$1</code>')
    .replace(/\n/g, '<br/>')
}

const QUICK_REPLIES = [
  'summary today',
  'summary this month',
  'summary this week',
  'help',
]

export default function ChatPage({ chatId, onUnauth }) {
  const [messages, setMessages]   = useState([
    { role: 'bot', text: "Hey! 👋 Log spending, check summaries, or ask for financial advice.\n\nTry: *rm25 lunch mcdonalds*\nOr tap the camera to scan a receipt!" },
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef                 = useRef(null)
  const inputRef                  = useRef(null)
  const cameraInputRef            = useRef(null)  // opens camera directly
  const galleryInputRef           = useRef(null)  // opens photo gallery

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    try {
      const reply = await sendChat(msg, chatId)
      setMessages(prev => [...prev, { role: 'bot', text: reply }])
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { onUnauth?.(); return }
      setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Could not reach SpendBot. Check your connection.' }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  async function handleReceiptFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const previewUrl = URL.createObjectURL(file)
    setMessages(prev => [...prev,
      { role: 'user', text: '📷 Receipt photo sent', image: previewUrl },
      { role: 'bot',  text: '🧾 Reading your receipt...' },
    ])
    setLoading(true)
    try {
      const result = await uploadReceipt(file, chatId)
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'bot', text: result.reply }
        return copy
      })
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { onUnauth?.(); return }
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'bot', text: '⚠️ Could not scan receipt. Try again or type it manually.' }
        return copy
      })
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header — logo only, centered ── */}
      <div style={{
        padding: '0.85rem 1.1rem',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'rgba(8,8,8,0.9)',
        backdropFilter: 'blur(20px)',
      }}>
        <img src={logoImg} alt="SpendBot" style={{ height: 36, objectFit: 'contain' }} />
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.3rem' }}>
              {m.image && (
                <img src={m.image} alt="Receipt" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 12, objectFit: 'cover' }} />
              )}
              <div
                style={{
                  padding: '0.65rem 0.9rem',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                  color: m.role === 'user' ? '#0a0a0a' : 'var(--text-primary)',
                  border: m.role === 'bot' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  fontSize: '0.88rem', lineHeight: 1.55,
                }}
                dangerouslySetInnerHTML={{ __html: parseMd(m.text) }}
              />
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex' }}>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '18px 18px 18px 4px', padding: '0.65rem 0.9rem',
              display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#333', animation: `blink 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick replies ── */}
      <div style={{ padding: '0.4rem 1rem 0.3rem', display: 'flex', gap: '0.4rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {QUICK_REPLIES.map(q => (
          <button key={q} onClick={() => send(q)} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 99, padding: '0.3rem 0.85rem', color: 'var(--text-muted)',
            fontSize: '0.7rem', whiteSpace: 'nowrap', fontFamily: 'var(--mono)',
            cursor: 'pointer', flexShrink: 0,
          }}>
            {q}
          </button>
        ))}
      </div>

      {/* ── Input bar ── */}
      <div style={{
        padding: '0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom))',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        background: 'rgba(8,8,8,0.9)',
      }}>

        {/* Hidden inputs */}
        <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" onChange={handleReceiptFile} style={{ display: 'none' }} />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleReceiptFile} style={{ display: 'none' }} />

        {/* Camera button */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={loading}
          title="Take photo"
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '0.7rem 0.75rem', fontSize: '1.1rem',
            cursor: loading ? 'default' : 'pointer',
            color: loading ? 'var(--text-muted)' : '#888', flexShrink: 0,
          }}
        >
          📷
        </button>

        {/* Gallery button */}
        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={loading}
          title="Choose from gallery"
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '0.7rem 0.75rem', fontSize: '1.1rem',
            cursor: loading ? 'default' : 'pointer',
            color: loading ? 'var(--text-muted)' : '#888', flexShrink: 0,
          }}
        >
          🖼️
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="rm25 lunch mcdonalds"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
            padding: '0.7rem 1rem', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
          }}
        />

        {/* Send button */}
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            background: input.trim() && !loading ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
            border: 'none', borderRadius: 12, padding: '0.7rem 1rem',
            fontWeight: 800, color: '#0a0a0a',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            fontSize: '1.1rem', transition: 'background 0.15s', flexShrink: 0,
          }}
        >
          →
        </button>
      </div>

      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}