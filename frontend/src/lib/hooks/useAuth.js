// DESTINATION: src/lib/hooks/useAuth.js
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/lib/context/AuthContext'

// Canonical dashboard per role — every role maps to exactly one home
const ROLE_DASHBOARDS = {
  platform_admin:    '/platform/dashboard',
  institution_admin: '/admin/dashboard',
  lecturer:          '/lecturer/dashboard',
  student:           '/student/dashboard',
  // legacy mock alias kept during any remaining transition
  admin:             '/admin/dashboard',
}

// Normalise a raw role string to the access-control token used by DashboardShell.
// platform_admin → 'platform'   (platform control plane pages)
// institution_admin → 'admin'   (institution admin pages)
// lecturer → 'lecturer'
// student → 'student'
export function normalizeRole(role) {
  switch (role) {
    case 'platform_admin':    return 'platform'
    case 'institution_admin': return 'admin'
    case 'admin':             return 'admin'  // legacy alias
    default:                  return role     // 'lecturer' | 'student' pass through
  }
}

export function useAuth(requiredRole) {
  const { user, loading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace('/auth/login')
      return
    }

    if (requiredRole) {
      const userNorm = normalizeRole(user.role)

      if (userNorm !== requiredRole) {
        // Redirect to the correct home for this user's actual role
        const home = ROLE_DASHBOARDS[user.role] || '/auth/login'
        router.replace(home)
      }
    }
  }, [user, loading, requiredRole, router])

  return { user, loading }
}