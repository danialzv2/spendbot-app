import chatImg      from './chat_image.png'
import dashboardImg  from './dashboard_image.png'
import configureImg  from './configure_image.png'

const tabs = [
  { id: 'chat',      img: chatImg,      label: 'Chat'      },
  { id: 'dashboard', img: dashboardImg, label: 'Dashboard' },
  { id: 'config',    img: configureImg, label: 'Configure' },
]

export default function BottomNav({ active, onChange }) {
  return (
    <div className="bottom-nav">
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            className="nav-btn"
            onClick={() => onChange(tab.id)}
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <img
              src={tab.img}
              alt={tab.label}
              style={{
                width: 24,
                height: 24,
                objectFit: 'contain',
                opacity: isActive ? 1 : 0.4,
                transition: 'opacity 0.15s ease',
                filter: isActive
                  ? 'brightness(0) saturate(100%) invert(91%) sepia(28%) saturate(800%) hue-rotate(30deg) brightness(103%)'
                  : 'brightness(0) invert(1)',
              }}
            />
            <span className="nav-label">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}