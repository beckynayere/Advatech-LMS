const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:12345'

export async function loginUser(username, password) {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || data?.error?.message || 'Login failed')
  return data
}

export async function getMe(token) {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || 'Failed to get user')
  return data.user
}
