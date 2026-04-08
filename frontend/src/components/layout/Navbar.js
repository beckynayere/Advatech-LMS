// DESTINATION: src/components/layout/Navbar.js
'use client'

import { useState, useEffect } from 'react'
import { RiMenuLine, RiSearchLine, RiMoonLine, RiSunLine } from 'react-icons/ri'
import { useAuthContext } from '@/lib/context/AuthContext'
import styles from './Navbar.module.css'
import NotificationDropdown from '@/components/ui/NotificationDropdown'

// Role config — color accent + label per role
const ROLE_CONFIG = {
  platform_admin:    { label: 'Platform Admin', accent: '#6366f1', bg: '#eef2ff' },
  institution_admin: { label: 'School Admin',   accent: '#0d9488', bg: '#f0fdfa' },
  admin:             { label: 'School Admin',   accent: '#0d9488', bg: '#f0fdfa' },
  lecturer:          { label: 'Lecturer',        accent: '#2563eb', bg: '#eff6ff' },
  student:           { label: 'Student',         accent: '#7c3aed', bg: '#f5f3ff' },
}

// Greeting based on time of day
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Navbar({ title, subtitle, onMenuClick }) {
  const { user } = useAuthContext()
  const [time, setTime] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    function tick() {
      setTime(new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit'
      }))
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [])

  if (!user) return null

  const role = ROLE_CONFIG[user.role] || ROLE_CONFIG.student
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const firstName = user.name?.split(' ')[0] || ''

  return (
    <header className={styles.navbar} style={{ '--role-accent': role.accent, '--role-bg': role.bg }}>

      {/* Role accent rule — the one memorable detail */}
      <div className={styles.accentRule} />

      {/* Mobile menu */}
      <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Open menu">
        <RiMenuLine size={17} />
      </button>

      {/* Page context */}
      <div className={styles.context}>
        <div className={styles.breadcrumb}>
          <span className={styles.roleLabel}>{role.label}</span>
          <span className={styles.sep}>/</span>
          <span className={styles.pageTitle}>{title}</span>
        </div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>

      {/* Right cluster */}
      <div className={styles.right}>

        {/* Live clock — subtle, purposeful */}
        {mounted && (
          <div className={styles.clock}>
            <span className={styles.clockDot} />
            {time}
          </div>
        )}

        {/* Notifications */}
        <NotificationDropdown />

        {/* Divider */}
        <div className={styles.divider} />

        {/* User identity chip */}
        <div className={styles.userChip}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar} style={{ background: role.accent }}>
              {initials}
            </div>
            <div className={styles.avatarRing} />
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{firstName}</span>
            <span className={styles.userRole} style={{ color: role.accent, background: role.bg }}>
              {role.label}
            </span>
          </div>
        </div>

      </div>
    </header>
  )
}