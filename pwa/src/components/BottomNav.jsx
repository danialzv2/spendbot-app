export default function BottomNav({ active, onChange }) {
  const tabs = [
    { id: 'chat',      icon: '💬', label: 'Chat'      },
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'config',    icon: '⚙️', label: 'Configure' },
  ]

  return (
    <div className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className="nav-btn"
          onClick={() => onChange(tab.id)}
          style={{ color: active === tab.id ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}