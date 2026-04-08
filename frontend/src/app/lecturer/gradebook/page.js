// DESTINATION: src/app/lecturer/gradebook/page.js
'use client'

import { useState, useEffect } from 'react'
import DashboardShell from '@/components/layout/DashboardShell'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getCourses } from '@/lib/api/courses'
import { getGradesForCourse } from '@/lib/api/grades'
import { RiAwardLine } from 'react-icons/ri'
import styles from './gradebook.module.css'

const GRADE_CLASS = { A: 'gradeA', B: 'gradeB', C: 'gradeC', D: 'gradeD', F: 'gradeF' }

export default function GradebookPage() {
  const { user } = useAuthContext()
  const [courses, setCourses]       = useState([])
  const [activeTab, setActiveTab]   = useState(null)
  const [grades, setGrades]         = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingGrades, setLoadingGrades]   = useState(false)

  useEffect(() => {
    if (!user) return
    getCourses()
      .then(all => {
        setCourses(all)
        if (all.length > 0) setActiveTab(all[0].id)
      })
      .finally(() => setLoadingCourses(false))
  }, [user])

  useEffect(() => {
    if (!activeTab) return
    setLoadingGrades(true)
    setGrades([])
    getGradesForCourse(activeTab)
      .then(setGrades)
      .finally(() => setLoadingGrades(false))
  }, [activeTab])

  const activeCourse = courses.find(c => c.id === activeTab)

  return (
    <DashboardShell title="Gradebook" subtitle="Student grades per course" requiredRole="lecturer">
      <div className={styles.page}>

        {/* Course tabs */}
        {loadingCourses ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 36, width: 80, borderRadius: 8, background: 'var(--gray-100)', animation: 'skeletonPulse 1.6s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes skeletonPulse{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}`}</style>
          </div>
        ) : courses.length === 0 ? (
          <EmptyState icon={RiAwardLine} title="No courses" desc="You have no courses assigned this semester." />
        ) : (
          <div className={styles.tabs}>
            {courses.map(c => (
              <button
                key={c.id}
                className={`${styles.tab} ${activeTab === c.id ? styles.active : ''}`}
                onClick={() => setActiveTab(c.id)}
              >
                {c.code}
              </button>
            ))}
          </div>
        )}

        {/* Grade table */}
        {loadingGrades ? (
          <SkeletonTable rows={5} cols={4} />
        ) : grades.length === 0 ? (
          <EmptyState
            icon={RiAwardLine}
            title="No grades yet"
            desc={activeCourse ? `No submissions have been graded for ${activeCourse.code} yet.` : 'Select a course to view grades.'}
          />
        ) : (
          <div className={styles.card}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  {(grades[0]?.assignments || []).map((a, i) => (
                    <th key={i}>{a.title?.length > 20 ? a.title.substring(0, 20) + '…' : a.title}</th>
                  ))}
                  <th>Overall %</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {grades.map(g => (
                  <tr key={g.studentId}>
                    <td className={styles.studentName}>{g.studentName}</td>
                    {(g.assignments || []).map((a, i) => (
                      <td key={i}>
                        {a.grade != null ? (
                          <div className={styles.scoreCell}>
                            <span className={styles.scoreMini}>{a.grade}/{a.totalMarks}</span>
                            <div className={styles.miniBar}>
                              <div
                                className={styles.miniFill}
                                style={{ width: `${Math.round((a.grade / (a.totalMarks || 100)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    ))}
                    <td><span className={styles.pct}>{g.percentage}%</span></td>
                    <td>
                      <span className={`${styles.grade} ${styles[GRADE_CLASS[g.letterGrade]]}`}>
                        {g.letterGrade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}