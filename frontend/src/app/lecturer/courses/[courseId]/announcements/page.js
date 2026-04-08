// DESTINATION: src/app/lecturer/courses/[courseId]/announcements/page.js
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RiAddLine, RiArrowLeftLine, RiMegaphoneLine } from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getAnnouncements, createAnnouncement } from '@/lib/api/announcements'
import styles from './announcements.module.css'
import modalStyles from '@/components/ui/Modal.module.css'

export default function LecturerAnnouncementsPage() {
  const { courseId } = useParams()
  const { user } = useAuthContext()
  const toast = useToast()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading]             = useState(true)
  const [modalOpen, setModalOpen]         = useState(false)
  const [saving, setSaving]               = useState(false)
  const [form, setForm] = useState({ subject: '', message: '' })

  useEffect(() => {
    getAnnouncements(courseId)
      .then(setAnnouncements)
      .finally(() => setLoading(false))
  }, [courseId])

  const handlePost = async () => {
    if (!form.subject || !form.message) {
      toast.warning('Subject and message are required.')
      return
    }
    setSaving(true)
    try {
      const newAn = await createAnnouncement({
        ...form,
        courseId,
        lecturerName: user?.name,
      })
      setAnnouncements(prev => [newAn, ...prev])
      setModalOpen(false)
      setForm({ subject: '', message: '' })
      toast.success('Announcement posted.')
    } catch (e) {
      toast.error(e.message || 'Failed to post announcement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell title="Announcements" subtitle={`Course: ${courseId}`} requiredRole="lecturer">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/lecturer/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to course
          </Link>
          <button className={styles.addBtn} onClick={() => setModalOpen(true)}>
            <RiAddLine size={15} /> Post Announcement
          </button>
        </div>

        {loading ? (
          <SkeletonCard count={3} />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={RiMegaphoneLine}
            title="No announcements"
            desc="Post an announcement to keep your students informed."
            actionLabel="Post Announcement"
            onAction={() => setModalOpen(true)}
          />
        ) : announcements.map(an => (
          <div key={an.id} className={styles.announcementCard}>
            <div className={styles.anHeader}>
              <div className={styles.anSubject}>{an.subject}</div>
              <div className={styles.anDate}>{an.createdAt?.split('T')[0]}</div>
            </div>
            <div className={styles.anMessage}>{an.message}</div>
            <div className={styles.anAuthor}>Posted by {an.lecturerName}</div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Post Announcement"
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => setModalOpen(false)}>Cancel</button>
            <button className={modalStyles.btnPrimary} onClick={handlePost} disabled={saving}>
              {saving ? 'Posting…' : 'Post'}
            </button>
          </>
        }
      >
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Subject</label>
          <input
            className={modalStyles.input}
            placeholder="e.g. Assignment deadline extended"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Message</label>
          <textarea
            className={modalStyles.textarea}
            rows={5}
            placeholder="Write your announcement…"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          />
        </div>
      </Modal>
    </DashboardShell>
  )
}