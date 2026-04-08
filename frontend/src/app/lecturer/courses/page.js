// DESTINATION: src/app/lecturer/courses/page.js
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  RiSearchLine, RiGroupLine,
  RiCalendarLine, RiArrowRightLine, RiBookOpenLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getCourses } from '@/lib/api/courses'
import styles from './courses.module.css'

export default function LecturerCoursesPage() {
  const { user } = useAuthContext()
  const [courses, setCourses] = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getCourses()
      .then(setCourses)
      .finally(() => setLoading(false))
  }, [user])

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardShell title="My Courses" subtitle="Manage your courses" requiredRole="lecturer">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><RiSearchLine size={15} /></span>
            <input
              className={styles.searchInput}
              placeholder="Search courses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className={styles.grid}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-light)', padding: 20, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ height: 14, background: 'var(--gray-100)', borderRadius: 6, width: '60%', animation: 'skeletonPulse 1.6s ease-in-out infinite' }} />
                <div style={{ height: 11, background: 'var(--gray-100)', borderRadius: 6, width: '40%', animation: 'skeletonPulse 1.6s ease-in-out infinite' }} />
              </div>
            ))}
            <style>{`@keyframes skeletonPulse{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RiBookOpenLine}
            title={search ? 'No courses match your search' : 'No courses assigned'}
            desc={search ? 'Try a different search term.' : 'You have no courses assigned this semester. Contact the administrator.'}
          />
        ) : (
          <div className={styles.grid}>
            {filtered.map(course => (
              <div key={course.id} className={styles.card}>
                <div className={`${styles.cardAccent} ${styles[course.color] || styles.blue}`} />
                <div className={styles.cardBody}>
                  <div className={styles.codeRow}>
                    <span className={styles.code}>{course.code}</span>
                    <Badge label={`${course.credits} cr`} color="gray" size="sm" />
                  </div>
                  <div className={styles.title}>{course.title}</div>
                  {course.description && (
                    <div className={styles.desc}>{course.description}</div>
                  )}
                  <div className={styles.meta}>
                    <div className={styles.metaRow}>
                      <RiGroupLine size={12} />
                      {course.enrolledStudents} students
                    </div>
                    {course.department && (
                      <div className={styles.metaRow}>
                        <RiCalendarLine size={12} />
                        {course.department}
                      </div>
                    )}
                  </div>
                </div>
                <Link href={`/lecturer/courses/${course.id}`} className={styles.cardFooter}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{course.modules?.length || 0} modules</span>
                  <span className={styles.openLabel}>Open <RiArrowRightLine size={13} /></span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}