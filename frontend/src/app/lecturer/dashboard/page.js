// DESTINATION: src/app/lecturer/dashboard/page.js
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  RiBookOpenLine, RiGroupLine,
  RiEditLine, RiAwardLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { SkeletonStatGrid, SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getCourses } from '@/lib/api/courses'
import { getAssignments } from '@/lib/api/assignments'
import styles from './dashboard.module.css'

export default function LecturerDashboard() {
  const { user } = useAuthContext()
  const [courses, setCourses]       = useState([])
  const [pendingItems, setPending]  = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!user) return
    getCourses()
      .then(async (all) => {
        setCourses(all)
        // Fetch assignments for each course, collect pending submissions
        const results = await Promise.allSettled(
          all.map(c => getAssignments(c.id).then(assignments =>
            assignments.flatMap(a =>
              (a.submissions || [])
                .filter(s => s.status === 'submitted')
                .map(s => ({ ...s, assignmentTitle: a.title, courseCode: c.code, courseId: c.id, assignmentId: a.id }))
            )
          ))
        )
        const all_pending = results
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => r.value)
        setPending(all_pending)
      })
      .finally(() => setLoading(false))
  }, [user])

  const totalStudents = courses.reduce((s, c) => s + (c.enrolledStudents || 0), 0)
  const totalCredits  = courses.reduce((s, c) => s + (c.credits || 0), 0)
  const firstName = user?.name?.split(' ').slice(-1)[0] || 'Lecturer'

  return (
    <DashboardShell title="Dashboard" subtitle="Your teaching overview" requiredRole="lecturer">
      <div className={styles.page}>

        {/* Banner */}
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <div className={styles.bannerGreeting}>Welcome back,</div>
            <div className={styles.bannerTitle}>
              <span>{firstName}</span>
            </div>
            <div className={styles.bannerSub}>
              {user?.department && `${user.department} · `}
              {loading ? '…' : `${courses.length} course${courses.length !== 1 ? 's' : ''} this semester`}
            </div>
          </div>
          <div className={styles.bannerRight}>
            <div className={styles.bannerTag}>
              <div className={styles.bannerTagLabel}>Pending Review</div>
              <div className={styles.bannerTagValue}>
                {loading ? '…' : `${pendingItems.length} submission${pendingItems.length !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonStatGrid count={4} />
        ) : (
          <div className={styles.statsGrid}>
            <StatCard label="My Courses"      value={courses.length}      icon={RiBookOpenLine} color="blue" />
            <StatCard label="Active Students" value={totalStudents}        icon={RiGroupLine}    color="teal" />
            <StatCard label="Pending Grading" value={pendingItems.length}  icon={RiEditLine}     color="amber" />
            <StatCard label="Total Credits"   value={totalCredits}         icon={RiAwardLine}    color="purple" />
          </div>
        )}

        <div className={styles.grid}>
          {/* My Courses */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <div className={styles.cardTitleIcon}><RiBookOpenLine size={14} /></div>
                My Courses
              </div>
              <Link href="/lecturer/courses" className={styles.cardAction}>View all →</Link>
            </div>
            {loading ? (
              <div style={{ padding: 20 }}><SkeletonCard count={3} /></div>
            ) : courses.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No courses assigned this semester.
              </div>
            ) : courses.map(c => (
              <Link key={c.id} href={`/lecturer/courses/${c.id}`} className={styles.courseRow}>
                <div className={`${styles.courseColorDot} ${styles[c.color] || styles.blue}`} />
                <div className={styles.courseInfo}>
                  <div className={styles.courseName}>{c.title}</div>
                  <div className={styles.courseMeta}>{c.department} · {c.enrolledStudents} students</div>
                </div>
                <Badge label={c.code} color="gray" size="sm" />
              </Link>
            ))}
          </div>

          {/* Pending submissions */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <div className={styles.cardTitleIcon}><RiEditLine size={14} /></div>
                Needs Grading
              </div>
            </div>
            {loading ? (
              <div style={{ padding: 20 }}><SkeletonCard count={3} /></div>
            ) : pendingItems.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nothing to grade right now ✓
              </div>
            ) : pendingItems.slice(0, 6).map((item, i) => (
              <Link key={i} href={`/lecturer/courses/${item.courseId}/assignments`} className={styles.pendingRow}>
                <div>
                  <div className={styles.pendingName}>{item.studentName}</div>
                  <div className={styles.pendingMeta}>{item.courseCode} · {item.assignmentTitle}</div>
                </div>
                <Badge label="Pending" color="warning" size="sm" dot />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}