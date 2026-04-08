// DESTINATION: src/app/student/grades/page.js
'use client'

import { useState, useEffect } from 'react'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonStatGrid, SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getGradesForStudent } from '@/lib/api/grades'
import { RiAwardLine } from 'react-icons/ri'
import styles from './grades.module.css'

const letterFromPct = (p) => p >= 70 ? 'A' : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : 'F'

export default function StudentGradesPage() {
  const { user } = useAuthContext()
  const [grades, setGrades]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getGradesForStudent(user.id)
      .then(setGrades)
      .finally(() => setLoading(false))
  }, [user])

  const avgPct = grades.length > 0
    ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length)
    : 0

  return (
    <DashboardShell title="Grades" subtitle="Your academic performance" requiredRole="student">
      <div className={styles.page}>

        {loading ? (
          <>
            <SkeletonStatGrid count={3} />
            <SkeletonCard count={3} />
          </>
        ) : grades.length === 0 ? (
          <EmptyState
            icon={RiAwardLine}
            title="No grades yet"
            desc="Your grades will appear here once your lecturer grades your submissions."
          />
        ) : (
          <>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryValue}>{grades.length}</div>
                <div className={styles.summaryLabel}>Courses with grades</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryValue}>{avgPct}%</div>
                <div className={styles.summaryLabel}>Overall average</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryValue}>{letterFromPct(avgPct)}</div>
                <div className={styles.summaryLabel}>Overall grade</div>
              </div>
            </div>

            {grades.map(g => (
              <div key={g.courseId} className={styles.gradeCard}>
                <div className={styles.gradeCardHeader}>
                  <div>
                    <div className={styles.courseTitle}>{g.courseTitle}</div>
                    {g.courseCode && (
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {g.courseCode}
                      </div>
                    )}
                    {g.lecturer && <div className={styles.courseLecturer}>{g.lecturer}</div>}
                  </div>
                  <div className={styles.gradeRight}>
                    <div className={styles.pct}>{g.percentage}%</div>
                    <div className={`${styles.letterGrade} ${styles[g.letterGrade]}`}>
                      {g.letterGrade}
                    </div>
                  </div>
                </div>

                {g.breakdown?.length > 0 && g.breakdown.map((b, i) => (
                  <div key={i} className={styles.breakdownRow}>
                    <div>
                      <div className={styles.breakdownTitle}>{b.assignmentTitle}</div>
                      {b.feedback && (
                        <div className={styles.breakdownFeedback}>{b.feedback}</div>
                      )}
                    </div>
                    <div className={styles.miniBar}>
                      <div
                        className={styles.miniFill}
                        style={{ width: `${b.totalMarks > 0 ? Math.round((b.grade / b.totalMarks) * 100) : 0}%` }}
                      />
                    </div>
                    <div className={styles.breakdownScore}>{b.grade} / {b.totalMarks}</div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </DashboardShell>
  )
}