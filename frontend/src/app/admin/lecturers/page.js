// DESTINATION: src/app/admin/lecturers/page.js
'use client'
import { useState, useEffect } from 'react'
import {
  RiSearchLine, RiAddLine,
  RiEditLine, RiDeleteBinLine,
  RiShieldUserLine, RiBookOpenLine, RiLinkM,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Drawer from '@/components/ui/Drawer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { getLecturers, createLecturer, updateUser, deactivateUser } from '@/lib/api/users'
import { getCourses, assignLecturerToCourse } from '@/lib/api/courses'
import styles from './lecturers.module.css'

const EMPTY_FORM = { name: '', email: '', phone: '', department: '' }

export default function LecturersPage() {
  const toast = useToast()
  const [lecturers, setLecturers]   = useState([])
  const [courses, setCourses]       = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)

  // Add/Edit drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  // Assign to course drawer
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [assignTarget, setAssignTarget]         = useState(null) // lecturer
  const [selectedCourse, setSelectedCourse]     = useState('')
  const [assigning, setAssigning]               = useState(false)

  // Confirm deactivate
  const [confirmOpen, setConfirmOpen]     = useState(false)
  const [deactivating, setDeactivating]   = useState(false)
  const [targetLecturer, setTargetLecturer] = useState(null)

  useEffect(() => {
    Promise.allSettled([getLecturers(), getCourses()])
      .then(([lr, cr]) => {
        if (lr.status === 'fulfilled') setLecturers(lr.value || [])
        if (cr.status === 'fulfilled') setCourses(cr.value || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = lecturers.filter(l => {
    const q = search.toLowerCase()
    return !q
      || l.name.toLowerCase().includes(q)
      || l.email.toLowerCase().includes(q)
      || (l.department || '').toLowerCase().includes(q)
  })

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  const openEdit = (lecturer) => {
    setEditTarget(lecturer)
    setForm({ name: lecturer.name, email: lecturer.email, phone: lecturer.phone, department: lecturer.department })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.warning('Name and email are required.')
      return
    }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateUser(editTarget.id, { name: form.name, phone: form.phone })
        setLecturers(prev => prev.map(l => l.id === editTarget.id ? { ...l, ...updated } : l))
        toast.success(`${form.name} updated.`)
      } else {
        const newLecturer = await createLecturer(form)
        setLecturers(prev => [...prev, newLecturer])
        toast.success(`${form.name} added as lecturer.`)
      }
      setDrawerOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      toast.error(e.message || 'Operation failed.')
    } finally {
      setSaving(false)
    }
  }

  const openAssign = (lecturer) => {
    setAssignTarget(lecturer)
    setSelectedCourse('')
    setAssignDrawerOpen(true)
  }

  const handleAssign = async () => {
    if (!selectedCourse) {
      toast.warning('Please select a course.')
      return
    }
    setAssigning(true)
    try {
      await assignLecturerToCourse(selectedCourse, assignTarget.id)
      toast.success(`${assignTarget.name} assigned to course.`)
      setAssignDrawerOpen(false)
    } catch (e) {
      toast.error(e.message || 'Failed to assign lecturer.')
    } finally {
      setAssigning(false)
    }
  }

  const confirmDeactivate = (lecturer) => {
    setTargetLecturer(lecturer)
    setConfirmOpen(true)
  }

  const handleDeactivate = async () => {
    if (!targetLecturer) return
    setDeactivating(true)
    try {
      await deactivateUser(targetLecturer.id)
      setLecturers(prev => prev.filter(l => l.id !== targetLecturer.id))
      toast.success(`${targetLecturer.name} has been deactivated.`)
      setConfirmOpen(false)
    } catch (e) {
      toast.error(e.message || 'Failed to deactivate.')
    } finally {
      setDeactivating(false)
    }
  }

  const getInitials = name => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <DashboardShell title="Lecturers" subtitle="Manage teaching staff" requiredRole="admin">
      <div className={styles.page}>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <RiSearchLine className={styles.searchIcon} size={15} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, email or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className={styles.addBtn} onClick={openCreate}>
            <RiAddLine size={16} /> Add Lecturer
          </button>
        </div>

        {!loading && (
          <div className={styles.meta}>
            <span>{filtered.length}</span> of <span>{lecturers.length}</span> lecturers
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RiShieldUserLine}
            title={search ? 'No lecturers found' : 'No lecturers yet'}
            desc={search ? 'Try a different search.' : 'Add your first lecturer to get started.'}
            actionLabel="Add Lecturer"
            onAction={openCreate}
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Lecturer</th>
                  <th>Department</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lecturer => (
                  <tr key={lecturer.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar}>{getInitials(lecturer.name)}</div>
                        <div>
                          <div className={styles.lecturerName}>{lecturer.name}</div>
                          <div className={styles.lecturerEmail}>{lecturer.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{lecturer.department || '—'}</td>
                    <td><span className={styles.phone}>{lecturer.phone || '—'}</span></td>
                    <td>
                      <span className={`${styles.statusBadge} ${lecturer.isActive ? styles.active : styles.inactive}`}>
                        {lecturer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} title="Assign to course" onClick={() => openAssign(lecturer)}>
                          <RiLinkM size={14} />
                        </button>
                        <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(lecturer)}>
                          <RiEditLine size={14} />
                        </button>
                        <button className={`${styles.actionBtn} ${styles.dangerAction}`} title="Deactivate" onClick={() => confirmDeactivate(lecturer)}>
                          <RiDeleteBinLine size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Lecturer' : 'Add New Lecturer'}
        subtitle={editTarget ? `Editing ${editTarget.name}` : 'The lecturer will receive login credentials via email.'}
      >
        <div className={styles.drawerForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Full Name *</label>
              <input
                className={styles.input}
                placeholder="e.g. Dr. Jane Mwangi"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email Address *</label>
              <input
                className={styles.input}
                type="email"
                placeholder="lecturer@tuk.ac.ke"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={!!editTarget}
              />
              {editTarget && <div className={styles.fieldNote}>Email cannot be changed.</div>}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Department</label>
              <input
                className={styles.input}
                placeholder="Computer Science"
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                disabled={!!editTarget}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Phone Number</label>
              <input
                className={styles.input}
                placeholder="+254 700 000 000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>

          {!editTarget && (
            <div className={styles.infoNote}>
              Default password is <strong>ChangeMe@2025!</strong> — lecturer will be prompted to change it on first login.
            </div>
          )}

          <div className={styles.drawerActions}>
            <button className={styles.cancelBtn} onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Lecturer'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Assign to course drawer */}
      <Drawer
        open={assignDrawerOpen}
        onClose={() => setAssignDrawerOpen(false)}
        title="Assign to Course"
        subtitle={assignTarget ? `Assigning ${assignTarget.name} to a course` : ''}
        width={440}
      >
        <div className={styles.drawerForm}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Select Course</label>
            <select
              className={styles.input}
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
            >
              <option value="">Choose a course…</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          {courses.length === 0 && (
            <div className={styles.fieldNote}>No courses found. Create courses first.</div>
          )}

          <div className={styles.drawerActions}>
            <button className={styles.cancelBtn} onClick={() => setAssignDrawerOpen(false)} disabled={assigning}>
              Cancel
            </button>
            <button className={styles.saveBtn} onClick={handleAssign} disabled={assigning || !selectedCourse}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDeactivate}
        loading={deactivating}
        title="Deactivate Lecturer"
        message={`Are you sure you want to deactivate ${targetLecturer?.name}? They will lose access to the platform.`}
        confirmLabel="Deactivate"
        danger
      />
    </DashboardShell>
  )
}