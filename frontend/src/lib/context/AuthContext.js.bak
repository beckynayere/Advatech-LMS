// DESTINATION: src/lib/context/AuthContext.js
'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:12345'

const AuthContext = createContext(null)

// ─── JWT decode (no library needed — just base64 payload) ────────────────────
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

// Returns ms until expiry, negative if already expired
function msUntilExpiry(token) {
  const decoded = decodeJwt(token)
  if (!decoded?.exp) return -1
  return decoded.exp * 1000 - Date.now()
}

// ─── Fetch fresh user from /me ─────────────────────────────────────────────────
// Re-syncs role/institutionId from the server after a refresh
async function fetchFreshUser(accessToken) {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer ' + accessToken },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.user || data.data || null
  } catch {
    return null
  }
}

// ─── Silent refresh ────────────────────────────────────────────────────────────
async function attemptRefresh() {
  const refreshToken = sessionStorage.getItem('lms_refresh_token')
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

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const refreshTimerRef = useRef(null)

  // Schedule a proactive token refresh 2 min before expiry
  const scheduleRefresh = useCallback((accessToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)

    const msLeft = msUntilExpiry(accessToken)
    const delay = Math.max(msLeft - 2 * 60 * 1000, 100)

    refreshTimerRef.current = setTimeout(async () => {
      const newToken = await attemptRefresh()
      if (newToken) {
        // FIX: Re-fetch user from /me after token refresh to pick up role/institutionId changes
        const freshUser = await fetchFreshUser(newToken)
        if (freshUser) {
          sessionStorage.setItem('lms_user', JSON.stringify(freshUser))
          setUser(freshUser)
        }
        setToken(newToken)
        scheduleRefresh(newToken)
      } else {
        // Refresh failed — session truly expired
        logout()
      }
    }, delay)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Boot: restore session, validate token ──────────────────────────────────
  useEffect(() => {
    async function boot() {
      try {
        const savedUser = sessionStorage.getItem('lms_user')
        const savedToken = sessionStorage.getItem('lms_token')

        if (!savedUser || !savedToken) {
          setLoading(false)
          return
        }

        const remaining = msUntilExpiry(savedToken)

        if (remaining > 5 * 60 * 1000) {
          // Token is fine — re-fetch user to catch any server-side role changes
          setUser(JSON.parse(savedUser))
          setToken(savedToken)
          scheduleRefresh(savedToken)
          // Async re-sync user in background (non-blocking)
          fetchFreshUser(savedToken).then(freshUser => {
            if (freshUser) {
              sessionStorage.setItem('lms_user', JSON.stringify(freshUser))
              setUser(freshUser)
            }
          })
        } else {
          // Token is expired or within 5 min of expiry — refresh immediately
          const newToken = await attemptRefresh()
          if (newToken) {
            // FIX: Re-fetch user from /me to get latest role/institutionId
            const freshUser = await fetchFreshUser(newToken)
            const userToStore = freshUser || JSON.parse(savedUser)
            sessionStorage.setItem('lms_user', JSON.stringify(userToStore))
            sessionStorage.setItem('lms_token', newToken)
            setUser(userToStore)
            setToken(newToken)
            scheduleRefresh(newToken)
          } else {
            // Can't refresh — clear everything
            sessionStorage.removeItem('lms_token')
            sessionStorage.removeItem('lms_refresh_token')
            sessionStorage.removeItem('lms_user')
          }
        }
      } catch {
        sessionStorage.removeItem('lms_token')
        sessionStorage.removeItem('lms_refresh_token')
        sessionStorage.removeItem('lms_user')
      } finally {
        setLoading(false)
      }
    }

    boot()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [scheduleRefresh])

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data?.message || data?.error?.message || 'Login failed')

    const { user: backendUser, accessToken, refreshToken } = data

    sessionStorage.setItem('lms_user', JSON.stringify(backendUser))
    sessionStorage.setItem('lms_token', accessToken)
    if (refreshToken) sessionStorage.setItem('lms_refresh_token', refreshToken)

    setUser(backendUser)
    setToken(accessToken)
    scheduleRefresh(accessToken)

    return backendUser
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)

    const refreshToken = sessionStorage.getItem('lms_refresh_token')
    const accessToken = sessionStorage.getItem('lms_token')

    if (refreshToken && accessToken) {
      fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {})
    }

    sessionStorage.removeItem('lms_token')
    sessionStorage.removeItem('lms_refresh_token')
    sessionStorage.removeItem('lms_user')

    setUser(null)
    setToken(null)

    router.push('/auth/login')
  }, [router])

  return (
    // FIX: expose setUser so profile page (and other consumers) can update user state
    <AuthContext.Provider value={{ user, setUser, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}