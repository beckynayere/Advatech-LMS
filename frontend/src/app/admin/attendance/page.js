// DESTINATION: src/app/admin/attendance/page.js
'use client'

import { useState, useEffect } from 'react'
import { RiCheckboxLine } from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { getAttendance } from '@/lib/api/attendance'
import styles from './attendance.module.css'

export default function AdminAttendancePage() {
  const [attendance, setAttendance] = useState([])
  const [activeTab, setActiveTab]   = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    getAttendance()
      .then(data => {
        setAttendance(data)
        if (data.length > 0) setActiveTab(data[0].courseId)
      })
      .finally(() => setLoading(false))
  }, [])

  const current = attendance.find(a => a.courseId === activeTab)

  const getStudentRate = (studentId) => {
    if (!current) return 0
    const total = current.sessions.length
    if (total === 0) return 0
    const present = current.sessions.filter(s =>
      s.records.find(r => r.studentId === studentId && r.status === 'present')
    ).length
    return Math.round((present / total) * 100)
  }

  const allStudents = current
    ? [...new Map(
        current.sessions.flatMap(s => s.records).map(r => [r.studentId, r])
      ).values()]
    : []

  const overallRate = current && current.sessions.length > 0
    ? Math.round(
        current.sessions.reduce((sum, s) => {
          const present = s.records.filter(r => r.status === 'present').length
          const total = s.records.length
          return sum + (total > 0 ? present / total : 0)
        }, 0) / current.sessions.length * 100
      )
    : 0

  const getRateColor = (rate) =>
    rate >= 75 ? 'success' : rate >= 50 ? 'warning' : 'danger'

  return (
    <DashboardShell
      title="Attendance"
      subtitle="Monitor student attendance across courses"
      requiredRole="admin"
    >
      <div className={styles.page}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton height={44} style={{ borderRadius: 10 }} />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ) : attendance.length === 0 ? (
          <EmptyState
            icon={RiCheckboxLine}
            title="No attendance data"
            desc="Attendance records will appear here once lecturers start recording sessions."
          />
        ) : (
          <>
            {/* Course Tabs */}
            <div className={styles.tabs}>
              {attendance.map(a => (
                <button
                  key={a.courseId}
                  className={`${styles.tab} ${activeTab === a.courseId ? styles.active : ''}`}
                  onClick={() => setActiveTab(a.courseId)}
                >
                  <RiCheckboxLine size={13} />
                  {a.courseCode}
                </button>
              ))}
            </div>

            {current && (
              <>
                {/* Summary */}
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryValue}>{current.sessions.length}</div>
                    <div className={styles.summaryLabel}>Total Sessions</div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryValue}>{overallRate}%</div>
                    <div className={styles.summaryLabel}>Overall Rate</div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryValue}>{allStudents.length}</div>
                    <div className={styles.summaryLabel}>Students Tracked</div>
                  </div>
                </div>

                {/* Per-student table */}
                {allStudents.length === 0 ? (
                  <EmptyState
                    icon={RiCheckboxLine}
                    title="No attendance records"
                    desc="No attendance has been recorded for this course yet."
                  />
                ) : (
                  <div className={styles.tableCard}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Student</th>
                          {current.sessions.map(s => (
                            <th key={s.id}>{s.date}</th>
                          ))}
                          <th>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allStudents.map(student => {
                          const rate = getStudentRate(student.studentId)
                          return (
                            <tr key={student.studentId}>
                              <td className={styles.studentName}>{student.studentName}</td>
                              {current.sessions.map(s => {
                                const rec = s.records.find(r => r.studentId === student.studentId)
                                const status = rec?.status || 'not recorded'
                                return (
                                  <td key={s.id} style={{ textAlign: 'center' }}>
                                    <Badge
                                      label={status === 'present' ? 'P' : status === 'absent' ? 'A' : '—'}
                                      color={status === 'present' ? 'success' : status === 'absent' ? 'danger' : 'gray'}
                                      size="sm"
                                    />
                                  </td>
                                )
                              })}
                              <td>
                                <Badge label={`${rate}%`} color={getRateColor(rate)} size="sm" />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  )
}