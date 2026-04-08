// DESTINATION: src/app/student/dashboard/page.js
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  RiBookOpenLine, RiFileListLine, RiAwardLine, RiCheckboxLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getCourses } from '@/lib/api/courses'
import { getAssignments } from '@/lib/api/assignments'
import { getGradesForStudent } from '@/lib/api/grades'
import { getAttendance } from '@/lib/api/attendance'
import styles from './dashboard.module.css'

export default function StudentDashboard() {
  const { user } = useAuthContext()
  const [courses, setCourses] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [grades, setGrades] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)

  useEffect(() => {
    if (!user) return

    // Parallel top-level fetches
    Promise.allSettled([
      getCourses(),
      getGradesForStudent(user.id),
      getAttendance(),
    ]).then(([coursesRes, gradesRes, attendanceRes]) => {
      const fetchedCourses = coursesRes.status === 'fulfilled' ? coursesRes.value : []
      setCourses(fetchedCourses)
      setGrades(gradesRes.status === 'fulfilled' ? gradesRes.value : [])
      setAttendance(attendanceRes.status === 'fulfilled' ? attendanceRes.value : [])

      // Now fetch assignments for each enrolled course, find pending ones
      // (assignments that are published and the student hasn't submitted)
      if (fetchedCourses.length === 0) {
        setLoadingTasks(false)
        return
      }

      Promise.allSettled(
        fetchedCourses.map(c =>
          getAssignments(c.id).then(assignments =>
            assignments
              .filter(a => a.isPublished && !a.mySubmission)
              .map(a => ({ ...a, courseCode: c.code || c.id, courseId: c.id }))
          )
        )
      ).then(results => {
        const allPending = results
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => r.value)
        setPendingTasks(allPending)
        setLoadingTasks(false)
      })
    })
  }, [user])

  // Attendance calculation
  const totalSessions = attendance.reduce((s, a) => s + (a.sessions?.length || 0), 0)
  const presentSessions = attendance.reduce((s, a) =>
    s + (a.sessions || []).filter(sess =>
      sess.records?.some(r => r.studentId === String(user?.id) && r.status === 'present')
    ).length, 0
  )
  const attendRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0

  return (
    <DashboardShell title="Dashboard" subtitle="Your academic overview" requiredRole="student">
      <div className={styles.page}>
        {/* Welcome banner */}
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <div className={styles.bannerGreeting}>Hello,</div>
            <div className={styles.bannerTitle}>
              <span>{user?.name?.split(' ')[0]}</span>
            </div>
            <div className={styles.bannerSub}>
              {[user?.cohort, user?.department].filter(Boolean).join(' · ')}
            </div>
          </div>
          {user?.regNo && (
            <div className={styles.bannerRight}>
              <div className={styles.regBadge}>
                <div className={styles.regLabel}>Reg. Number</div>
                <div className={styles.regValue}>{user.regNo}</div>
              </div>
            </div>
          )}
        </div>

        {/* KPI stats */}
        <div className={styles.statsGrid}>
          <StatCard label="Enrolled Courses"  value={courses.length}           icon={RiBookOpenLine} color="purple" />
          <StatCard label="Pending Tasks"     value={loadingTasks ? '…' : pendingTasks.length} icon={RiFileListLine} color="amber" />
          <StatCard label="Grades Received"   value={grades.length}            icon={RiAwardLine}    color="teal" />
          <StatCard label="Attendance Rate"   value={`${attendRate}%`}         icon={RiCheckboxLine} color="blue" />
        </div>

        <div className={styles.grid}>
          {/* Courses */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <div className={styles.cardTitleIcon}><RiBookOpenLine size={14} /></div>
                My Courses
              </div>
              <Link href="/student/courses" className={styles.cardAction}>View all →</Link>
            </div>
            {courses.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No enrolled courses yet.
              </div>
            ) : courses.map(c => (
              <Link key={c.id} href={`/student/courses/${c.id}`} className={styles.courseRow}>
                <div className={`${styles.courseColorDot} ${styles[c.color]}`} />
                <div className={styles.courseInfo}>
                  <div className={styles.courseName}>{c.title}</div>
                  <div className={styles.courseMeta}>
                    {[c.lecturerName, c.schedule?.day && `${c.schedule.day} ${c.schedule.time}`]
                      .filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Badge label={c.code} color="gray" size="sm" />
              </Link>
            ))}
          </div>

          {/* Pending tasks */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <div className={styles.cardTitleIcon}><RiFileListLine size={14} /></div>
                Pending Tasks
              </div>
            </div>
            {loadingTasks ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading…
              </div>
            ) : pendingTasks.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                All caught up! ✓
              </div>
            ) : pendingTasks.slice(0, 5).map((task, i) => (
              <div key={i} className={styles.taskItem}>
                <div className={styles.taskTitle}>{task.title}</div>
                <div className={styles.taskMeta}>
                  <span>{task.courseCode}</span>
                  {task.dueDate && <span>Due: {task.dueDate}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}