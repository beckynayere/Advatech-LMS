// DESTINATION: src/app/admin/semesters/page.js
'use client'

import { useState, useEffect } from 'react'
import { RiAddLine, RiCalendarLine, RiEditLine, RiDeleteBinLine } from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { apiGet, apiPost, apiPut } from '@/lib/api/client'
import styles from './semesters.module.css'
import modalStyles from '@/components/ui/Modal.module.css'

function normalizeSemester(s) {
  const now = new Date()
  const start = new Date(s.startDate)
  const end   = new Date(s.endDate)
  let status = s.status || 'upcoming'
  if (!s.status) {
    if (start <= now && end >= now) status = 'active'
    else if (end < now) status = 'completed'
  }
  return {
    id:           s.id,
    name:         s.name || s.title || '',
    code:         s.code || '',
    startDate:    s.startDate || s.start_date || '',
    endDate:      s.endDate   || s.end_date   || '',
    status,
    totalCourses: s._count?.courses ?? s.totalCourses ?? 0,
    totalStudents:s.totalStudents ?? s._count?.enrollments ?? 0,
    academicYear: s.academicYear || '',
  }
}

const EMPTY_FORM = { name: '', startDate: '', endDate: '' }

export default function SemestersPage() {
  const toast = useToast()
  const [semesters, setSemesters] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null=create, obj=edit
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)

  useEffect(() => {
    apiGet('/api/v1/semesters')
      .then(data => setSemesters((data.data || []).map(normalizeSemester)))
      .catch(() => toast.error('Failed to load semesters.'))
      .finally(() => setLoading(false))
  }, [])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (sem) => {
    setEditTarget(sem)
    setForm({
      name:      sem.name,
      startDate: sem.startDate ? sem.startDate.split('T')[0] : '',
      endDate:   sem.endDate   ? sem.endDate.split('T')[0]   : '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      toast.warning('Please fill in all fields.')
      return
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.warning('End date must be after start date.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name:      form.name,
        startDate: new Date(form.startDate + 'T00:00:00').toISOString(),
        endDate:   new Date(form.endDate   + 'T23:59:59').toISOString(),
      }
      if (editTarget) {
        const data = await apiPut(`/api/v1/semesters/${editTarget.id}`, payload)
        const updated = normalizeSemester(data.semester || data.data)
        setSemesters(prev => prev.map(s => s.id === editTarget.id ? updated : s))
        toast.success('Semester updated.')
      } else {
        const data = await apiPost('/api/v1/semesters', payload)
        setSemesters(prev => [...prev, normalizeSemester(data.semester || data.data)])
        toast.success('Semester created successfully.')
      }
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setEditTarget(null)
    } catch (e) {
      toast.error(e.message || 'Failed to save semester.')
    } finally {
      setSaving(false)
    }
  }

  const fmtDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const statusColor = (s) => ({ active: 'success', completed: 'gray', upcoming: 'info' }[s] || 'gray')
  const statusLabel = (s) => ({ active: 'Active', completed: 'Completed', upcoming: 'Upcoming' }[s] || s)

  return (
    <DashboardShell title="Semesters" subtitle="Academic semester management" requiredRole="admin">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.pageTitle}>
            <span>{semesters.length}</span> semesters on record
          </div>
          <button className={styles.addBtn} onClick={openCreate}>
            <RiAddLine size={16} /> Create Semester
          </button>
        </div>

        {loading ? (
          <SkeletonCard count={3} />
        ) : semesters.length === 0 ? (
          <EmptyState
            icon={RiCalendarLine}
            title="No semesters yet"
            desc="Create your first semester to start scheduling courses and managing academic periods."
            actionLabel="Create Semester"
            onAction={openCreate}
          />
        ) : (
          <div className={styles.grid}>
            {semesters.map(sem => (
              <div
                key={sem.id}
                className={`${styles.card} ${sem.status === 'active' ? styles.active : ''}`}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>{sem.name}</div>
                    <div className={styles.cardDates}>
                      {fmtDate(sem.startDate)} → {fmtDate(sem.endDate)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge label={statusLabel(sem.status)} color={statusColor(sem.status)} dot />
                    <button
                      onClick={() => openEdit(sem)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                      title="Edit"
                    >
                      <RiEditLine size={14} />
                    </button>
                  </div>
                </div>
                <div className={styles.cardStats}>
                  <div className={styles.stat}>
                    <div className={styles.statValue}>{sem.totalCourses}</div>
                    <div className={styles.statLabel}>Courses</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statValue}>{sem.totalStudents}</div>
                    <div className={styles.statLabel}>Students</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        title={editTarget ? 'Edit Semester' : 'Create Semester'}
        desc="Define the name and date range for this academic semester."
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => { setModalOpen(false); setEditTarget(null) }}>
              Cancel
            </button>
            <button className={modalStyles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : (editTarget ? 'Save Changes' : 'Create')}
            </button>
          </>
        }
      >
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Semester Name *</label>
          <input
            className={modalStyles.input}
            placeholder="e.g. Semester 1 – 2025/2026"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className={modalStyles.row}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Start Date *</label>
            <input
              className={modalStyles.input}
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>End Date *</label>
            <input
              className={modalStyles.input}
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </DashboardShell>
  )
}