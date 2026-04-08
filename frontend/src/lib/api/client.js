// DESTINATION: src/lib/api/client.js

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:12345'

// ─── Token helpers ─────────────────────────────────────────────────────────────
function getToken() {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('lms_token')
}

function getRefreshToken() {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('lms_refresh_token')
}

function clearSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('lms_token')
  sessionStorage.removeItem('lms_refresh_token')
  sessionStorage.removeItem('lms_user')
}

function redirectToLogin() {
  clearSession()
  window.location.href = '/auth/login'
}

// ─── Silent refresh ────────────────────────────────────────────────────────────
// Returns the new accessToken on success, or null on failure.
// Uses a promise singleton so concurrent 401s don't cause multiple refresh calls.
let _refreshPromise = null

async function doTokenRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const { accessToken, refreshToken: newRefresh } = data

    if (!accessToken) return null

    sessionStorage.setItem('lms_token', accessToken)
    if (newRefresh) sessionStorage.setItem('lms_refresh_token', newRefresh)

    return accessToken
  } catch {
    return null
  }
}

function refreshTokenOnce() {
  if (!_refreshPromise) {
    _refreshPromise = doTokenRefresh().finally(() => {
      _refreshPromise = null
    })
  }
  return _refreshPromise
}

// ─── Core request ──────────────────────────────────────────────────────────────
// retry = true means we already attempted a refresh and re-ran; don't loop.
export async function apiRequest(endpoint, options = {}, retry = false) {
  const token = getToken()

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) headers['Authorization'] = 'Bearer ' + token

  // Let the browser set the multipart boundary for FormData
  if (options.body instanceof FormData) delete headers['Content-Type']

  const res = await fetch(API_URL + endpoint, { ...options, headers })

  // ── Silent refresh on 401 ─────────────────────────────────────────────────
  if (res.status === 401 && !retry) {
    const newToken = await refreshTokenOnce()

    if (newToken) {
      // Retry the original request once with the fresh token
      return apiRequest(endpoint, options, true)
    }

    // Refresh failed — session is dead, kick to login
    redirectToLogin()
    throw new Error('Session expired. Please log in again.')
  }

  if (res.status === 401 && retry) {
    redirectToLogin()
    throw new Error('Session expired. Please log in again.')
  }

  if (res.status === 403) {
    throw new Error('You do not have permission to perform this action.')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error?.message || data?.message || 'Request failed with status ' + res.status)
  }

  return res.json()
}

// ─── Convenience helpers ───────────────────────────────────────────────────────
export function apiGet(endpoint) {
  return apiRequest(endpoint, { method: 'GET' })
}

export function apiPost(endpoint, body, extraHeaders = {}) {
  const isFormData = body instanceof FormData
  return apiRequest(endpoint, {
    method: 'POST',
    headers: extraHeaders,
    body: isFormData ? body : JSON.stringify(body),
  })
}

export function apiPut(endpoint, body) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function apiPatch(endpoint, body) {
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function apiDelete(endpoint) {
  return apiRequest(endpoint, { method: 'DELETE' })
}

// Idempotent POST — sends a unique Idempotency-Key header so the server can
// safely deduplicate duplicate submissions (e.g. double-clicks).
export function apiPostIdempotent(endpoint, body) {
  const key = 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2)
  return apiRequest(endpoint, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(body),
  })
}