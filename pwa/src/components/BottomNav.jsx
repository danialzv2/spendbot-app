export default function BottomNav({ active, onChange }) {
  const tabs = [
    { id: 'chat',      icon: '💬', label: 'Chat'      },
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  ]

  return (
    <div style={{
      display: 'flex',
      background: '#0d0d0d',
      borderTop: '1px solid #1a1a1a',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.2rem',
            padding: '0.6rem 0.4rem',
            color: active === tab.id ? '#c8f564' : '#3a3a3a',
            transition: 'color 0.15s',
          }}
        >
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{tab.icon}</span>
          <span style={{
            fontSize: '0.6rem',
            fontFamily: 'JetBrains Mono, monospace',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
          }}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}
