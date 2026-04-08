// DESTINATION: src/app/admin/analytics/page.js
'use client'

import { useState, useEffect } from 'react'
import {
  RiGroupLine, RiShieldUserLine,
  RiBookOpenLine, RiBarChartLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import StatCard from '@/components/ui/StatCard'
import { SkeletonStatGrid } from '@/components/ui/Skeleton'
import { getAnalyticsOverview } from '@/lib/api/analytics'
import styles from './analytics.module.css'

const DEPT_COLORS = ['teal', 'blue', 'purple', 'amber', 'green', 'red']

export default function AnalyticsPage() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    getAnalyticsOverview()
      .then(setData)
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <DashboardShell title="Analytics" subtitle="Academic performance and platform insights" requiredRole="admin">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SkeletonStatGrid count={4} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-light)', height: 200 }} />
            ))}
          </div>
        </div>
      </DashboardShell>
    )
  }

  if (error || !data) {
    return (
      <DashboardShell title="Analytics" subtitle="Academic performance and platform insights" requiredRole="admin">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          {error || 'No analytics data available yet.'}
        </div>
      </DashboardShell>
    )
  }

  const enroll = data.enrollmentByDepartment || []
  const grades = data.gradeDistribution || []
  const trend  = data.enrollmentTrend || []
  const maxEnroll = enroll.length > 0 ? Math.max(...enroll.map(d => d.count), 1) : 1
  const maxGrade  = grades.length > 0  ? Math.max(...grades.map(d => d.count), 1)  : 1
  const maxTrend  = trend.length > 0   ? Math.max(...trend.map(d => d.count), 1)   : 1

  return (
    <DashboardShell
      title="Analytics"
      subtitle="Academic performance and platform insights"
      requiredRole="admin"
    >
      <div className={styles.page}>
        <div className={styles.statsGrid}>
          <StatCard label="Total Students"  value={data.overview.totalStudents}  icon={RiGroupLine}      color="teal" />
          <StatCard label="Lecturers"        value={data.overview.totalLecturers} icon={RiShieldUserLine} color="blue" />
          <StatCard label="Active Courses"   value={data.overview.activeCourses}  icon={RiBookOpenLine}   color="purple" />
          <StatCard label="Pass Rate"        value={`${data.overview.passRate}%`} icon={RiBarChartLine}   color="green" />
        </div>

        <div className={styles.grid}>
          {/* Enrollment by Department */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Enrollment by Department</div>
            <div className={styles.cardBody}>
              {enroll.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No enrollment data yet.</div>
              ) : enroll.map((d, i) => (
                <div key={d.department || i} className={styles.barRow}>
                  <div className={styles.barLabel}>{d.department}</div>
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${styles[DEPT_COLORS[i % DEPT_COLORS.length]]}`}
                      style={{ width: `${Math.round((d.count / maxEnroll) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.barValue}>{d.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Grade Distribution */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Grade Distribution</div>
            <div className={styles.cardBody}>
              {grades.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No grade data yet.</div>
              ) : (
                <div className={styles.gradeGrid}>
                  {grades.map(d => (
                    <div key={d.grade} className={styles.gradeCol}>
                      <div className={styles.gradeCount}>{d.count}</div>
                      <div
                        className={`${styles.gradeBar} ${styles[d.grade]}`}
                        style={{ height: `${Math.max(4, Math.round((d.count / maxGrade) * 100))}%` }}
                      />
                      <div className={styles.gradeLabel}>{d.grade}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Enrollment Trend */}
          {trend.length > 0 && (
            <div className={`${styles.card} ${styles.gridFull}`}>
              <div className={styles.cardHeader}>Enrollment Trend</div>
              <div className={styles.cardBody}>
                <div className={styles.trendGrid}>
                  {trend.map((d, i) => (
                    <div key={i} className={styles.trendCol}>
                      <div
                        className={styles.trendBar}
                        style={{ height: `${Math.max(4, Math.round((d.count / maxTrend) * 100))}%` }}
                      />
                      <div className={styles.trendLabel}>{d.label || d.month || d.period || i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}