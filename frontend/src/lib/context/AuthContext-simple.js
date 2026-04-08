'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:12345'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const savedUser = sessionStorage.getItem('lms_user')
    const savedToken = sessionStorage.getItem('lms_token')
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data?.message || 'Login failed')

    sessionStorage.setItem('lms_user', JSON.stringify(data.user))
    sessionStorage.setItem('lms_token', data.accessToken)
    if (data.refreshToken) sessionStorage.setItem('lms_refresh_token', data.refreshToken)

    setUser(data.user)
    
    // Redirect based on role
    const role = data.user.role
    if (role === 'PLATFORM_ADMIN') router.push('/admin/dashboard')
    else if (role === 'INSTITUTION_ADMIN') router.push('/institution/dashboard')
    else router.push('/dashboard')
    
    return data.user
  }

  const logout = () => {
    sessionStorage.clear()
    setUser(null)
    router.push('/auth/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
