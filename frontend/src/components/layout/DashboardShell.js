// DESTINATION: src/components/layout/DashboardShell.js
'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import styles from './DashboardShell.module.css'

export default function DashboardShell({ children, title, subtitle, requiredRole }) {
  const { user, loading } = useAuth(requiredRole)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading || !user) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <Navbar
        title={title}
        subtitle={subtitle}
        onMenuClick={() => setMobileOpen(v => !v)}
      />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}