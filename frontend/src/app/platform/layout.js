// src/app/platform/layout.js
// Layout guard for all /platform/* routes.
// Only platform_admin may access these pages — anyone else is redirected.

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/lib/context/AuthContext'

export default function PlatformLayout({ children }) {
  const { user, loading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth/login')
      return
    }
    if (user.role !== 'platform_admin') {
      // Redirect non-platform admins to their own dashboard
      const fallback = {
        institution_admin: '/admin/dashboard',
        admin:             '/admin/dashboard',
        lecturer:          '/lecturer/dashboard',
        student:           '/student/dashboard',
      }
      router.replace(fallback[user.role] || '/auth/login')
    }
  }, [user, loading, router])

  // Show nothing while resolving auth (avoids flash of platform UI)
  if (loading || !user || user.role !== 'platform_admin') {
    return (
      <div style={{
        height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid var(--primary-mid)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 0.7s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return <>{children}</>
}