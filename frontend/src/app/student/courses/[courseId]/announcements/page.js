// DESTINATION: src/app/student/courses/[courseId]/announcements/page.js
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RiArrowLeftLine, RiMegaphoneLine } from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { getAnnouncements } from '@/lib/api/announcements'
import styles from './announcements.module.css'

export default function StudentAnnouncementsPage() {
  const { courseId } = useParams()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    getAnnouncements(courseId)
      .then(setAnnouncements)
      .finally(() => setLoading(false))
  }, [courseId])

  return (
    <DashboardShell title="Announcements" subtitle={`Course: ${courseId}`} requiredRole="student">
      <div className={styles.page}>
        <Link href={`/student/courses/${courseId}`} className={styles.backLink}>
          <RiArrowLeftLine size={14} /> Back to course
        </Link>

        {loading ? (
          <SkeletonCard count={3} />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={RiMegaphoneLine}
            title="No announcements"
            desc="Your lecturer hasn't posted any announcements for this course yet."
          />
        ) : announcements.map(an => (
          <div key={an.id} className={styles.card}>
            <div className={styles.header}>
              <div className={styles.subject}>{an.subject}</div>
              <div className={styles.date}>{an.createdAt?.split('T')[0]}</div>
            </div>
            <div className={styles.message}>{an.message}</div>
            <div className={styles.author}>Posted by {an.lecturerName}</div>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}