// DESTINATION: src/app/student/attendance/page.js
'use client'

import { useState, useEffect } from 'react'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonStatGrid, SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getAttendance } from '@/lib/api/attendance'
import { RiCheckboxLine } from 'react-icons/ri'
import styles from './attendance.module.css'

export default function StudentAttendancePage() {
  const { user } = useAuthContext()
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    getAttendance()
      .then(setAttendance)
      .finally(() => setLoading(false))
  }, [])

  const getMyRate = (courseData) => {
    const total = courseData.sessions?.length || 0
    if (total === 0) return 0
    const present = (courseData.sessions || []).filter(s =>
      s.records?.some(r => String(r.studentId) === String(user?.id) && r.status === 'present')
    ).length
    return Math.round((present / total) * 100)
  }

  const allRates = attendance.map(getMyRate)
  const overallRate = allRates.length > 0
    ? Math.round(allRates.reduce((a, b) => a + b, 0) / allRates.length)
    : 0
  const totalSessions = attendance.reduce((s, a) => s + (a.sessions?.length || 0), 0)
  const standing      = overallRate >= 75 ? 'Good' : overallRate >= 50 ? 'At Risk' : 'Poor'
  const rateClass     = (r) => r >= 75 ? 'high' : r >= 50 ? 'mid' : 'low'

  return (
    <DashboardShell title="Attendance" subtitle="Your attendance across all courses" requiredRole="student">
      <div className={styles.page}>

        {loading ? (
          <>
            <SkeletonStatGrid count={3} />
            <SkeletonCard count={2} />
          </>
        ) : attendance.length === 0 ? (
          <EmptyState
            icon={RiCheckboxLine}
            title="No attendance records"
            desc="Your attendance will appear here once your lecturer starts recording sessions."
          />
        ) : (
          <>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryValue}>{overallRate}%</div>
                <div className={styles.summaryLabel}>Overall rate</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryValue}>{totalSessions}</div>
                <div className={styles.summaryLabel}>Total sessions</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryValue}>{standing}</div>
                <div className={styles.summaryLabel}>Standing</div>
              </div>
            </div>

            {attendance.map(courseData => {
              const rate = getMyRate(courseData)
              const mySessions = (courseData.sessions || []).map(s => ({
                ...s,
                myStatus: s.records?.find(r => String(r.studentId) === String(user?.id))?.status || 'not recorded',
              }))
              return (
                <div key={courseData.courseId} className={styles.courseCard}>
                  <div className={styles.courseHeader}>
                    <div className={styles.courseName}>{courseData.courseTitle}</div>
                    <div className={styles.rateWrap}>
                      <div className={styles.rateBar}>
                        <div
                          className={`${styles.rateFill} ${styles[rateClass(rate)]}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <div className={styles.rateText}>{rate}%</div>
                      <Badge
                        label={rate >= 75 ? 'Good' : rate >= 50 ? 'At Risk' : 'Poor'}
                        color={rate >= 75 ? 'success' : rate >= 50 ? 'warning' : 'danger'}
                        size="sm"
                      />
                    </div>
                  </div>
                  {mySessions.length === 0 ? (
                    <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                      No sessions recorded yet.
                    </div>
                  ) : mySessions.map(session => (
                    <div key={session.id} className={styles.sessionRow}>
                      <div className={styles.sessionTopic}>{session.topic || session.date}</div>
                      <div className={styles.sessionDate}>{session.date}</div>
                      <Badge
                        label={session.myStatus}
                        color={
                          session.myStatus === 'present' ? 'success'
                          : session.myStatus === 'absent' ? 'danger'
                          : 'gray'
                        }
                        dot
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>
    </DashboardShell>
  )
}