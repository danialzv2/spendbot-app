import { useState, useRef, useEffect } from 'react'
import { sendChat, uploadReceipt } from '../api'

// Convert basic markdown to HTML for display
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

export default function ChatPage({ chatId }) {
  const [messages, setMessages]   = useState([
    { role: 'bot', text: "Hey! 👋 Log spending, check summaries, or ask for financial advice.\n\nTry: *rm25 lunch mcdonalds*\nOr tap 📷 to scan a receipt!" },
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef                 = useRef(null)
  const inputRef                  = useRef(null)
  const fileInputRef              = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Send text message ─────────────────────────────────────────────────────
  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    try {
      const reply = await sendChat(msg, chatId)
      setMessages(prev => [...prev, { role: 'bot', text: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Could not reach SpendBot. Check your connection.' }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  // ── Handle receipt image ──────────────────────────────────────────────────
  async function handleReceiptFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''  // reset so same file can be picked again

    // Show preview message
    const previewUrl = URL.createObjectURL(file)
    setMessages(prev => [...prev,
      { role: 'user', text: '📷 Receipt photo sent', image: previewUrl },
      { role: 'bot',  text: '🧾 Reading your receipt...' },
    ])
    setLoading(true)

    try {
      const result = await uploadReceipt(file, chatId)
      // Replace the "reading..." message with the actual reply
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'bot', text: result.reply }
        return copy
      })
    } catch {
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

      {/* Header */}
      <div style={{
        padding: '0.9rem 1rem', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        background: '#0a0a0a',
      }}>
        <span style={{ fontSize: '1.3rem' }}>💸</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>SpendBot</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#3a3a3a', marginTop: 2 }}>
            AI Spending Tracker
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.3rem' }}>

              {/* Receipt image preview */}
              {m.image && (
                <img
                  src={m.image}
                  alt="Receipt"
                  style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 12, objectFit: 'cover' }}
                />
              )}

              {/* Message bubble */}
              <div
                style={{
                  padding: '0.65rem 0.9rem',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user' ? '#c8f564' : '#111',
                  color: m.role === 'user' ? '#0a0a0a' : '#ede8df',
                  border: m.role === 'bot' ? '1px solid #1e1e1e' : 'none',
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
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
              background: '#111', border: '1px solid #1e1e1e',
              borderRadius: '18px 18px 18px 4px', padding: '0.65rem 0.9rem',
              display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#333',
                  animation: `blink 1.2s ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div style={{
        padding: '0.4rem 1rem 0.3rem',
        display: 'flex', gap: '0.4rem', overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {QUICK_REPLIES.map(q => (
          <button key={q} onClick={() => send(q)}
            style={{
              background: '#111', border: '1px solid #222', borderRadius: 99,
              padding: '0.3rem 0.85rem', color: '#666', fontSize: '0.7rem',
              whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer', flexShrink: 0,
            }}>
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={{
        padding: '0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom))',
        borderTop: '1px solid #1a1a1a',
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        background: '#0a0a0a',
      }}>

        {/* Hidden file input — opens camera on mobile */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleReceiptFile}
          style={{ display: 'none' }}
        />

        {/* Camera button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          title="Scan receipt"
          style={{
            background: '#111', border: '1px solid #222', borderRadius: 12,
            padding: '0.7rem 0.8rem', fontSize: '1.1rem', cursor: 'pointer',
            color: loading ? '#2a2a2a' : '#888', flexShrink: 0,
          }}
        >
          📷
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="rm25 lunch mcdonalds"
          style={{
            flex: 1, background: '#111', border: '1px solid #222',
            borderRadius: 12, padding: '0.7rem 1rem',
            color: '#ede8df', fontSize: '0.9rem', outline: 'none',
          }}
        />

        {/* Send button */}
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            background: input.trim() && !loading ? '#c8f564' : '#1a1a1a',
            border: 'none', borderRadius: 12,
            padding: '0.7rem 1rem', fontWeight: 800, color: '#0a0a0a',
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