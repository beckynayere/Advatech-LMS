// DESTINATION: src/app/lecturer/attendance/page.js
'use client'

import { useState, useEffect } from 'react'
import { RiAddLine, RiCheckboxLine } from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getCourses } from '@/lib/api/courses'
import { getAttendance, createSession } from '@/lib/api/attendance'
import styles from './attendance.module.css'
import modalStyles from '@/components/ui/Modal.module.css'

export default function LecturerAttendancePage() {
  const toast = useToast()
  const { user } = useAuthContext()
  const [courses, setCourses]       = useState([])
  const [activeTab, setActiveTab]   = useState(null)
  const [attendance, setAttendance] = useState([])
  const [modalOpen, setModalOpen]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const [tabLoading, setTabLoading] = useState(false)
  const [form, setForm] = useState({ topic: '', date: new Date().toISOString().split('T')[0] })

  useEffect(() => {
    if (!user) return
    getCourses()
      .then(all => {
        setCourses(all)
        if (all.length > 0) setActiveTab(all[0].id)
      })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!activeTab) return
    setTabLoading(true)
    setAttendance([])
    getAttendance(activeTab)
      .then(data => setAttendance(data[0]?.sessions || []))
      .finally(() => setTabLoading(false))
  }, [activeTab])

  const totalSessions = attendance.length
  const overallRate = totalSessions > 0
    ? Math.round(
        attendance.reduce((sum, s) => {
          const p = s.records.filter(r => r.status === 'present').length
          return sum + (s.records.length > 0 ? p / s.records.length : 0)
        }, 0) / totalSessions * 100
      )
    : 0

  const handleAddSession = async () => {
    if (!form.topic || !form.date) {
      toast.warning('Please fill in the topic and date.')
      return
    }
    setSaving(true)
    try {
      const newSession = await createSession(activeTab, { ...form, userId: user?.id })
      setAttendance(prev => [...prev, newSession])
      setModalOpen(false)
      setForm({ topic: '', date: new Date().toISOString().split('T')[0] })
      toast.success('Session recorded successfully.')
    } catch (e) {
      toast.error(e.message || 'Failed to record session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell title="Attendance" subtitle="Record and track class attendance" requiredRole="lecturer">
      <div className={styles.page}>

        {loading ? (
          <Skeleton height={40} style={{ borderRadius: 8, marginBottom: 16 }} />
        ) : courses.length === 0 ? (
          <EmptyState icon={RiCheckboxLine} title="No courses" desc="You have no courses assigned this semester." />
        ) : (
          <>
            <div className={styles.tabs}>
              {courses.map(c => (
                <button
                  key={c.id}
                  className={`${styles.tab} ${activeTab === c.id ? styles.active : ''}`}
                  onClick={() => setActiveTab(c.id)}
                >
                  <RiCheckboxLine size={13} /> {c.code}
                </button>
              ))}
            </div>

            <div className={styles.toolbar}>
              <div className={styles.rateChip}>
                Overall attendance: <span>{overallRate}%</span> across <span>{totalSessions}</span> sessions
              </div>
              <button className={styles.addBtn} onClick={() => setModalOpen(true)}>
                <RiAddLine size={15} /> Record Session
              </button>
            </div>

            {tabLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2,3].map(i => <Skeleton key={i} variant="row" />)}
              </div>
            ) : attendance.length === 0 ? (
              <EmptyState
                icon={RiCheckboxLine}
                title="No sessions yet"
                desc="Record your first attendance session for this course."
                actionLabel="Record Session"
                onAction={() => setModalOpen(true)}
              />
            ) : attendance.map(session => (
              <div key={session.id} className={styles.sessionCard}>
                <div className={styles.sessionHeader}>
                  <div className={styles.sessionTopic}>{session.topic || session.id}</div>
                  <div className={styles.sessionDate}>{session.date}</div>
                  <Badge
                    label={`${session.records.filter(r => r.status === 'present').length}/${session.records.length} present`}
                    color="teal"
                    size="sm"
                  />
                </div>
                {session.records.length > 0 && (
                  <div className={styles.recordList}>
                    {session.records.map(r => (
                      <div key={r.studentId} className={`${styles.recordChip} ${styles[r.status]}`}>
                        {r.studentName} · {r.status}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Session"
        desc="Create a new attendance session for today's class."
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => setModalOpen(false)}>Cancel</button>
            <button className={modalStyles.btnPrimary} onClick={handleAddSession} disabled={saving}>
              {saving ? 'Recording…' : 'Record'}
            </button>
          </>
        }
      >
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Topic</label>
          <input
            className={modalStyles.input}
            placeholder="e.g. Introduction to Trees"
            value={form.topic}
            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
          />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Date</label>
          <input
            className={modalStyles.input}
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </div>
      </Modal>
    </DashboardShell>
  )
}