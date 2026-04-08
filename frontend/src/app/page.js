'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/lib/context/AuthContext'

export default function RootPage() {
  const { user, loading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth/login')
      return
    }
    const dashMap = {
      platform_admin:    '/platform/dashboard',
      institution_admin: '/admin/dashboard',
      admin:             '/admin/dashboard',
      lecturer:          '/lecturer/dashboard',
      student:           '/student/dashboard',
    }
    router.replace(dashMap[user.role] || '/auth/login')
  }, [user, loading, router])

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