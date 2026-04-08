'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  RiGroupLine, RiShieldUserLine, RiBookOpenLine,
  RiBarChartLine, RiArrowRightUpLine, RiArrowRightLine,
  RiExternalLinkLine, RiSettings4Line, RiHistoryLine
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { SkeletonStatGrid, SkeletonCard } from '@/components/ui/Skeleton'
import { getCourses } from '@/lib/api/courses'
import { getAnalyticsOverview } from '@/lib/api/analytics'
import styles from './dashboard.module.css'

const quickActions = [
  { label: 'Student Directory', href: '/admin/students',  icon: RiGroupLine },
  { label: 'Faculty Roster',   href: '/admin/lecturers', icon: RiShieldUserLine },
  { label: 'Academic Calendar', href: '/admin/timetable', icon: RiBookOpenLine },
  { label: 'System Settings',  href: '/admin/settings',  icon: RiSettings4Line },
]

export default function AdminDashboard() {
  const [courses, setCourses]     = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const syncDashboard = useCallback(async () => {
    try {
      const [cRes, aRes] = await Promise.allSettled([getCourses(), getAnalyticsOverview()])
      if (cRes.status === 'fulfilled') setCourses(cRes.value)
      if (aRes.status === 'fulfilled') setAnalytics(aRes.value)
      if (cRes.status === 'rejected' && aRes.status === 'rejected') setError('Data sync failed')
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    syncDashboard()
    const poll = setInterval(syncDashboard, 30000)
    return () => clearInterval(poll)
  }, [syncDashboard])

  const ov = analytics?.overview || {}

  return (
    <DashboardShell title="Executive Oversight" subtitle="Institutional Administration Portal" requiredRole="admin">
      <div className={styles.wrapper}>
        
        {/* WORK AREA: Left Column */}
        <div className={styles.mainContent}>
          
          {/* STATS STRIP */}
          {loading ? <SkeletonStatGrid count={4} /> : (
            <div className={styles.statsGrid}>
              <StatCard label="Enrollment" value={ov.totalStudents} icon={RiGroupLine} color="blue" />
              <StatCard label="Lecturers" value={ov.totalLecturers} icon={RiShieldUserLine} color="teal" />
              <StatCard label="Courses" value={courses.length} icon={RiBookOpenLine} color="purple" />
              <StatCard label="Avg. Grade" value={`${ov.passRate || 0}%`} icon={RiBarChartLine} color="dark" />
            </div>
          )}

          {/* ACTIVE REGISTRY (Real Database Mapping) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.title}>Academic Registry</h3>
              <Link href="/admin/courses" className={styles.textAction}>View All <RiArrowRightLine /></Link>
            </div>
            
            <div className={styles.card}>
              {loading ? <SkeletonCard count={4} /> : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Course Title</th>
                        <th>Department</th>
                        <th>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.slice(0, 8).map(c => (
                        <tr key={c.id}>
                          <td className={styles.mono}>{c.code}</td>
                          <td className={styles.bold}>{c.title}</td>
                          <td>{c.department || 'General'}</td>
                          <td>
                            <Badge label={`${c.enrolledStudents || 0}`} color="gray" size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* UTILITY AREA: Right Column */}
        <aside className={styles.sidebar}>
          
          <div className={styles.utilityBlock}>
            <h4 className={styles.sidebarLabel}>Quick Access</h4>
            <div className={styles.actionList}>
              {quickActions.map(action => (
                <Link key={action.href} href={action.href} className={styles.actionItem}>
                  <action.icon />
                  <span>{action.label}</span>
                  <RiExternalLinkLine className={styles.extIcon} />
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.pulseContainer}>
            <div className={styles.pulseHeader}>
              <div className={styles.liveIndicator}>
                <div className={styles.ping} /> LIVE
              </div>
              <RiHistoryLine />
            </div>
            <p className={styles.pulseText}>
              System is operational. {courses.length} courses currently synced with the institutional database.
            </p>
          </div>

        </aside>
      </div>
    </DashboardShell>
  )
}