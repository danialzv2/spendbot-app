const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Auth token ────────────────────────────────────────────────────────────────
let _token = localStorage.getItem('spendbot_token') || ''

export function setToken(pin)  { _token = pin; localStorage.setItem('spendbot_token', pin) }
export function clearToken()   { _token = ''; localStorage.removeItem('spendbot_token') }
export function hasToken()     { return !!_token }

function authHeaders() {
  return { 'Authorization': `Bearer ${_token}` }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function verifyPin(pin) {
  const res = await fetch(`${API_URL}/auth`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${pin}` },
  })
  return res.ok
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export async function sendChat(message, chatId) {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ message, chat_id: chatId }),
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return (await res.json()).reply
}

// ── Receipt ───────────────────────────────────────────────────────────────────
export async function uploadReceipt(file, chatId) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/receipt?chat_id=${chatId}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function fetchDashboard(chatId) {
  const res = await fetch(`${API_URL}/dashboard?chat_id=${chatId}`, {
    headers: authHeaders(),
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Config ────────────────────────────────────────────────────────────────────
export async function getConfig(chatId) {
  const res = await fetch(`${API_URL}/config?chat_id=${chatId}`, {
    headers: authHeaders(),
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()  // { salary: number, commitments: [{label, amount}] }
}

export async function saveConfig(chatId, salary, commitments) {
  const res = await fetch(`${API_URL}/config?chat_id=${chatId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ salary, commitments }),
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}