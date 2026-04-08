// DESTINATION: src/app/student/courses/page.js
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RiBookOpenLine, RiUserLine, RiCalendarLine, RiArrowRightLine } from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getCourses } from '@/lib/api/courses'
import styles from './courses.module.css'

export default function StudentCoursesPage() {
  const { user } = useAuthContext()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getCourses()
      .then(setCourses)
      .finally(() => setLoading(false))
  }, [user])

  return (
    <DashboardShell title="My Courses" subtitle="Courses you are enrolled in" requiredRole="student">
      <div className={styles.page}>
        {loading ? (
          <div className={styles.grid}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                <div style={{ height: 4, background: 'var(--gray-100)' }} />
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ height: 14, background: 'var(--gray-100)', borderRadius: 6, width: '50%', animation: 'skeletonPulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: 18, background: 'var(--gray-100)', borderRadius: 6, width: '75%', animation: 'skeletonPulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: 11, background: 'var(--gray-100)', borderRadius: 6, width: '90%', animation: 'skeletonPulse 1.6s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes skeletonPulse{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}`}</style>
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={RiBookOpenLine}
            title="No enrolled courses"
            desc="You are not enrolled in any courses this semester. Contact your administrator."
          />
        ) : (
          <div className={styles.grid}>
            {courses.map(c => (
              <Link key={c.id} href={`/student/courses/${c.id}`} className={styles.card}>
                <div className={`${styles.cardAccent} ${styles[c.color] || styles.teal}`} />
                <div className={styles.cardBody}>
                  <div className={styles.codeRow}>
                    <span className={styles.code}>{c.code}</span>
                    <Badge label={`${c.credits} cr`} color="gray" size="sm" />
                  </div>
                  <div className={styles.title}>{c.title}</div>
                  {c.description && <div className={styles.desc}>{c.description}</div>}
                  <div className={styles.meta}>
                    {c.lecturerName && (
                      <div className={styles.metaRow}><RiUserLine size={12} />{c.lecturerName}</div>
                    )}
                    {c.department && (
                      <div className={styles.metaRow}><RiCalendarLine size={12} />{c.department}</div>
                    )}
                  </div>
                </div>
                <div className={styles.cardFooter}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {c.modules?.length || 0} modules
                  </span>
                  <span className={styles.openLabel}>Open <RiArrowRightLine size={13} /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}