import { useState } from 'react'
import ChatPage from './pages/ChatPage'
import DashboardPage from './pages/DashboardPage'
import BottomNav from './components/BottomNav'

// Your personal user ID — set VITE_USER_ID in .env.local (local)
// and in Vercel Environment Variables (production)
const CHAT_ID = import.meta.env.VITE_USER_ID || 'default_user'

export default function App() {
  const [tab, setTab] = useState('chat')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: tab === 'chat' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ChatPage chatId={CHAT_ID} />
        </div>
        <div style={{ display: tab === 'dashboard' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
          <DashboardPage chatId={CHAT_ID} />
        </div>
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}