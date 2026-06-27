const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Send a text message to SpendBot and get a reply.
 */
export async function sendChat(message, chatId) {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, chat_id: chatId }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = await res.json()
  return data.reply
}

/**
 * Upload a receipt image file and get a parsed + logged reply.
 */
export async function uploadReceipt(file, chatId) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_URL}/receipt?chat_id=${chatId}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()  // { success, reply, data? }
}

/**
 * Fetch all dashboard data for a given chat ID.
 */
export async function fetchDashboard(chatId) {
  const res = await fetch(`${API_URL}/dashboard?chat_id=${chatId}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}