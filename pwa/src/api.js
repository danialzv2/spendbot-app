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

// ── Add transaction (manual key in) ──────────────────────────────────────────
export async function addTransaction(chatId, { amount, category, place, note }) {
  const res = await fetch(`${API_URL}/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ chat_id: chatId, amount, category, place, note }),
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()  // { ok, transaction: { timestamp, amount, category, place, note } }
}

// ── Delete transaction ────────────────────────────────────────────────────────
export async function deleteTransaction(chatId, timestamp) {
  const params = new URLSearchParams({ chat_id: chatId, timestamp })
  const res = await fetch(`${API_URL}/transaction?${params}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (res.status === 404) throw new Error('NOT_FOUND')
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
  return res.json()
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