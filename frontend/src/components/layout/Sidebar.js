// DESTINATION: src/components/layout/Sidebar.js
'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  RiDashboardLine, RiBookOpenLine, RiCalendarLine,
  RiBarChartLine, RiCheckboxLine, RiLogoutBoxLine, RiTimeLine,
  RiAwardLine, RiGroupLine, RiShieldUserLine, RiBuildingLine,
  RiVideoLine, RiPlayCircleLine, RiLiveLine, RiUserLine,
  RiTeamLine,
} from 'react-icons/ri'
import { useAuthContext } from '@/lib/context/AuthContext'
import styles from './Sidebar.module.css'

const NAV = {
  // ── Platform admin ── control plane only
  platform_admin: [
    {
      section: 'Control Plane',
      items: [
        { label: 'Dashboard',    href: '/platform/dashboard',    icon: RiDashboardLine },
        { label: 'Institutions', href: '/platform/institutions', icon: RiBuildingLine },
      ],
    },
  ],

  // ── Institution admin ── school operations
  admin: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard',         href: '/admin/dashboard', icon: RiDashboardLine },
        { label: 'Sessions Overview', href: '/admin/sessions',  icon: RiLiveLine },
      ],
    },
    {
      section: 'Management',
      items: [
        { label: 'Courses',   href: '/admin/courses',   icon: RiBookOpenLine },
        { label: 'Cohorts',   href: '/admin/cohorts',   icon: RiTeamLine },
        { label: 'Students',  href: '/admin/students',  icon: RiGroupLine },
        { label: 'Lecturers', href: '/admin/lecturers', icon: RiShieldUserLine },
        { label: 'Timetable', href: '/admin/timetable', icon: RiCalendarLine },
        { label: 'Semesters', href: '/admin/semesters', icon: RiTimeLine },
      ],
    },
    {
      section: 'Insights',
      items: [
        { label: 'Attendance', href: '/admin/attendance', icon: RiCheckboxLine },
        { label: 'Analytics',  href: '/admin/analytics',  icon: RiBarChartLine },
      ],
    },
  ],

  // ── Lecturer ──
  lecturer: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', href: '/lecturer/dashboard', icon: RiDashboardLine },
      ],
    },
    {
      section: 'Teaching',
      items: [
        { label: 'My Courses',  href: '/lecturer/courses',    icon: RiBookOpenLine },
        { label: 'My Sessions', href: '/lecturer/sessions',   icon: RiVideoLine },
        { label: 'Gradebook',   href: '/lecturer/gradebook',  icon: RiAwardLine },
        { label: 'Attendance',  href: '/lecturer/attendance', icon: RiCheckboxLine },
      ],
    },
  ],

  // ── Student ──
  student: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', href: '/student/dashboard', icon: RiDashboardLine },
      ],
    },
    {
      section: 'Academics',
      items: [
        { label: 'My Courses', href: '/student/courses',    icon: RiBookOpenLine },
        { label: 'Grades',     href: '/student/grades',     icon: RiAwardLine },
        { label: 'Timetable',  href: '/student/timetable',  icon: RiCalendarLine },
        { label: 'Attendance', href: '/student/attendance', icon: RiCheckboxLine },
      ],
    },
    {
      section: 'Live Learning',
      items: [
        { label: 'Sessions',   href: '/student/sessions',   icon: RiLiveLine },
        { label: 'Recordings', href: '/student/recordings', icon: RiPlayCircleLine },
      ],
    },
  ],
}

const ROLE_LABELS = {
  platform_admin:    'Platform Admin',
  institution_admin: 'School Admin',
  admin:             'School Admin',
  lecturer:          'Lecturer',
  student:           'Student',
}

// Dashboards should NOT trigger active on child paths
const EXACT_MATCH_HREFS = [
  '/platform/dashboard',
  '/admin/dashboard',
  '/lecturer/dashboard',
  '/student/dashboard',
]

function navKey(role) {
  if (role === 'platform_admin') return 'platform_admin'
  if (role === 'institution_admin' || role === 'admin') return 'admin'
  return role || 'student'
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuthContext()
  const pathname = usePathname()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  if (!user) return null

  const key = navKey(user.role)
  const navSections = NAV[key] || NAV.student
  const avatarRole  = key === 'platform_admin' ? 'admin' : key

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('')
    : '?'

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false)
    logout()
  }

  return (
    <>
      {mobileOpen && <div className={styles.overlay} onClick={onClose} />}

      {/* ── Logout confirmation modal ── */}
      {showLogoutModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowLogoutModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <div className={styles.modalIcon}>
              <RiLogoutBoxLine size={22} />
            </div>
            <h2 className={styles.modalTitle} id="logout-title">Sign out?</h2>
            <p className={styles.modalBody}>
              You'll be returned to the login screen. Any unsaved work may be lost.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.modalConfirm}
                onClick={handleLogoutConfirm}
              >
                <RiLogoutBoxLine size={14} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>

        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoWrapper}>
            <Image
              src="/AdvaGroup-logo.jpeg"
              alt="AdvaTech Group Logo"
              width={40}
              height={40}
              priority
              className={styles.brandLogo}
            />
          </div>
          <div className={styles.brandText}>
            <div className={styles.brandName}>AdvaTech LMS</div>
            <div className={styles.brandInstitution}>
              {user.institutionName || 'Institution Portal'}
            </div>
          </div>
        </div>

        {/* Role badge */}
        <div className={`${styles.roleBadge} ${styles[avatarRole]}`}>
          <span className={styles.roleDot} />
          {ROLE_LABELS[user.role] || user.role}
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {navSections.map(section => (
            <div key={section.section} className={styles.section}>
              <div className={styles.sectionLabel}>{section.section}</div>
              {section.items.map(item => {
                const Icon = item.icon
                const active = pathname === item.href ||
                  (!EXACT_MATCH_HREFS.includes(item.href) && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navItem} ${active ? styles.active : ''}`}
                    onClick={onClose}
                  >
                    <span className={styles.navIcon}><Icon size={17} /></span>
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.badge && (
                      <span className={styles.navBadge}>{item.badge}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className={styles.footer}>
          <Link href="/profile" className={styles.userCard} onClick={onClose}>
            <div className={`${styles.avatar} ${styles[avatarRole]}`}>
              {initials}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </Link>
          <button
            className={styles.logoutBtn}
            onClick={() => setShowLogoutModal(true)}
            title="Sign out"
            aria-label="Sign out"
          >
            <RiLogoutBoxLine size={14} />
            <span className={styles.logoutLabel}>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}