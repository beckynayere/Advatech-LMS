// DESTINATION: src/app/admin/students/page.js
'use client'
import { useState, useEffect } from 'react'
import {
  RiSearchLine, RiAddLine,
  RiEditLine, RiDeleteBinLine, RiDownloadLine,
  RiUserLine, RiMailLine, RiBuildingLine, RiPhoneLine,
  RiHashtag, RiGroupLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Drawer from '@/components/ui/Drawer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { getStudents, createStudent, updateUser, deactivateUser, getCohorts } from '@/lib/api/users'
import styles from './students.module.css'

const EMPTY_FORM = { name: '', email: '', phone: '', regNo: '', department: '', cohort: '' }

export default function StudentsPage() {
  const toast = useToast()
  const [students, setStudents]     = useState([])
  const [cohorts, setCohorts]       = useState([])
  const [search, setSearch]         = useState('')
  const [activeCohort, setActive]   = useState('All')
  const [loading, setLoading]       = useState(true)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null = create, object = edit
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  // Confirm deactivate
  const [confirmOpen, setConfirmOpen]   = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [targetStudent, setTargetStudent] = useState(null)

  useEffect(() => {
    Promise.allSettled([getStudents(), getCohorts()])
      .then(([sr, cr]) => {
        if (sr.status === 'fulfilled') setStudents(sr.value || [])
        if (cr.status === 'fulfilled') setCohorts(cr.value || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || s.name.toLowerCase().includes(q)
      || s.email.toLowerCase().includes(q)
      || (s.regNo || '').toLowerCase().includes(q)
    const matchCohort = activeCohort === 'All' || s.cohort === activeCohort
    return matchSearch && matchCohort
  })

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  const openEdit = (student) => {
    setEditTarget(student)
    setForm({ name: student.name, email: student.email, phone: student.phone, regNo: student.regNo, department: student.department, cohort: student.cohort })
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
        setStudents(prev => prev.map(s => s.id === editTarget.id ? { ...s, ...updated } : s))
        toast.success(`${form.name} updated.`)
      } else {
        const newStudent = await createStudent(form)
        setStudents(prev => [...prev, newStudent])
        toast.success(`${form.name} added successfully.`)
      }
      setDrawerOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      toast.error(e.message || 'Operation failed.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeactivate = (student) => {
    setTargetStudent(student)
    setConfirmOpen(true)
  }

  const handleDeactivate = async () => {
    if (!targetStudent) return
    setDeactivating(true)
    try {
      await deactivateUser(targetStudent.id)
      setStudents(prev => prev.filter(s => s.id !== targetStudent.id))
      toast.success(`${targetStudent.name} has been deactivated.`)
      setConfirmOpen(false)
    } catch (e) {
      toast.error(e.message || 'Failed to deactivate.')
    } finally {
      setDeactivating(false)
    }
  }

  const getInitials = name => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <DashboardShell title="Students" subtitle="Manage enrolled students" requiredRole="admin">
      <div className={styles.page}>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <RiSearchLine className={styles.searchIcon} size={15} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, email or reg no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filterWrap}>
            {['All', ...cohorts.map(c => c.label)].map(c => (
              <button
                key={c}
                className={`${styles.filterBtn} ${activeCohort === c ? styles.active : ''}`}
                onClick={() => setActive(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button className={styles.addBtn} onClick={openCreate}>
            <RiAddLine size={16} /> Add Student
          </button>
        </div>

        {/* Count */}
        {!loading && (
          <div className={styles.meta}>
            Showing <span>{filtered.length}</span> of <span>{students.length}</span> students
          </div>
        )}

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RiGroupLine}
            title={search ? 'No students found' : 'No students enrolled'}
            desc={search ? 'Try adjusting your search.' : 'Add your first student to get started.'}
            actionLabel="Add Student"
            onAction={openCreate}
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Reg. No</th>
                  <th>Department</th>
                  <th>Cohort</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(student => (
                  <tr key={student.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar}>{getInitials(student.name)}</div>
                        <div>
                          <div className={styles.studentName}>{student.name}</div>
                          <div className={styles.studentEmail}>{student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.mono}>{student.regNo || '—'}</span>
                    </td>
                    <td>{student.department || '—'}</td>
                    <td>
                      {student.cohort
                        ? <span className={styles.cohortBadge}>{student.cohort}</span>
                        : '—'}
                    </td>
                    <td>
                      <span className={styles.phone}>{student.phone || '—'}</span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${student.isActive ? styles.active : styles.inactive}`}>
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(student)}>
                          <RiEditLine size={14} />
                        </button>
                        <button className={`${styles.actionBtn} ${styles.dangerAction}`} title="Deactivate" onClick={() => confirmDeactivate(student)}>
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
        title={editTarget ? 'Edit Student' : 'Add New Student'}
        subtitle={editTarget ? `Editing ${editTarget.name}` : 'The student will receive login credentials via email.'}
      >
        <div className={styles.drawerForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Full Name *</label>
              <input
                className={styles.input}
                placeholder="e.g. Alice Ochieng"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email Address *</label>
              <input
                className={styles.input}
                type="email"
                placeholder="student@tuk.ac.ke"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={!!editTarget}
              />
              {editTarget && <div className={styles.fieldNote}>Email cannot be changed.</div>}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Registration Number</label>
              <input
                className={styles.input}
                placeholder="TUK/CS/001/2025"
                value={form.regNo}
                onChange={e => setForm(f => ({ ...f, regNo: e.target.value }))}
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
              <label className={styles.label}>Cohort</label>
              {cohorts.length > 0 ? (
                <select
                  className={styles.input}
                  value={form.cohort}
                  onChange={e => setForm(f => ({ ...f, cohort: e.target.value }))}
                >
                  <option value="">Select cohort…</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.label}>{c.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={styles.input}
                  placeholder="CS Year 3"
                  value={form.cohort}
                  onChange={e => setForm(f => ({ ...f, cohort: e.target.value }))}
                />
              )}
            </div>
          </div>

          {!editTarget && (
            <div className={styles.infoNote}>
              <RiUserLine size={13} />
              Default password is <strong>ChangeMe@2025!</strong> — student will be prompted to change it on first login.
            </div>
          )}

          <div className={styles.drawerActions}>
            <button className={styles.cancelBtn} onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Student'}
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
        title="Deactivate Student"
        message={`Are you sure you want to deactivate ${targetStudent?.name}? They will lose access to the platform.`}
        confirmLabel="Deactivate"
        danger
      />
    </DashboardShell>
  )
}