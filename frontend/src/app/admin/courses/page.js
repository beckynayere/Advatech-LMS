// DESTINATION: src/app/admin/courses/page.js
'use client'
import { useState, useEffect } from 'react'
import {
  RiAddLine, RiSearchLine, RiBookOpenLine,
  RiGroupLine, RiEditLine, RiLinkM,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Drawer from '@/components/ui/Drawer'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { getCourses, createCourse, assignLecturerToCourse } from '@/lib/api/courses'
import { getLecturers } from '@/lib/api/users'
import styles from './courses.module.css'

const COLORS = ['teal', 'blue', 'purple', 'amber']
const EMPTY_FORM = { name: '', code: '', description: '', credits: '3', lecturerId: '', color: 'teal' }

export default function AdminCoursesPage() {
  const toast = useToast()
  const [courses, setCourses]     = useState([])
  const [lecturers, setLecturers] = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)

  // Create drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  // Assign lecturer drawer
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [assignCourse, setAssignCourse]         = useState(null)
  const [selectedLecturer, setSelectedLecturer] = useState('')
  const [assigning, setAssigning]               = useState(false)

  useEffect(() => {
    Promise.allSettled([getCourses(), getLecturers()])
      .then(([cr, lr]) => {
        if (cr.status === 'fulfilled') setCourses(cr.value)
        if (lr.status === 'fulfilled') setLecturers(lr.value)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = courses.filter(c => {
    const q = search.toLowerCase()
    return !q
      || c.title.toLowerCase().includes(q)
      || c.code.toLowerCase().includes(q)
      || (c.department || '').toLowerCase().includes(q)
      || (c.lecturerName || '').toLowerCase().includes(q)
  })

  const handleCreate = async () => {
    if (!form.name || !form.code) {
      toast.warning('Course name and code are required.')
      return
    }
    setSaving(true)
    try {
      const created = await createCourse({
        name:        form.name,
        code:        form.code.toUpperCase(),
        description: form.description,
        credits:     Number(form.credits) || 3,
        lecturerId:  form.lecturerId ? Number(form.lecturerId) : undefined,
        color:       form.color,
      })
      setCourses(prev => [created, ...prev])
      setDrawerOpen(false)
      setForm(EMPTY_FORM)
      toast.success(`Course ${form.code.toUpperCase()} created.`)
    } catch (e) {
      toast.error(e.message || 'Failed to create course.')
    } finally {
      setSaving(false)
    }
  }

  const openAssign = (course) => {
    setAssignCourse(course)
    setSelectedLecturer('')
    setAssignDrawerOpen(true)
  }

  const handleAssign = async () => {
    if (!selectedLecturer) {
      toast.warning('Please select a lecturer.')
      return
    }
    setAssigning(true)
    try {
      await assignLecturerToCourse(assignCourse.id, selectedLecturer)
      const lecturer = lecturers.find(l => l.id === selectedLecturer)
      setCourses(prev => prev.map(c =>
        c.id === assignCourse.id
          ? { ...c, lecturerId: selectedLecturer, lecturerName: lecturer?.name || '' }
          : c
      ))
      toast.success(`Lecturer assigned to ${assignCourse.code}.`)
      setAssignDrawerOpen(false)
    } catch (e) {
      toast.error(e.message || 'Failed to assign lecturer.')
    } finally {
      setAssigning(false)
    }
  }

  const colorDot = (color) => {
    const map = { teal: '#0d9488', blue: '#2563eb', purple: '#7c3aed', amber: '#d97706' }
    return map[color] || map.teal
  }

  return (
    <DashboardShell title="Courses" subtitle="Manage institution courses" requiredRole="admin">
      <div className={styles.page}>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <RiSearchLine className={styles.searchIcon} size={15} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, code or lecturer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className={styles.addBtn} onClick={() => setDrawerOpen(true)}>
            <RiAddLine size={16} /> New Course
          </button>
        </div>

        {!loading && (
          <div className={styles.meta}>
            <span>{filtered.length}</span> course{filtered.length !== 1 ? 's' : ''}
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RiBookOpenLine}
            title={search ? 'No courses match your search' : 'No courses yet'}
            desc={search ? 'Try a different term.' : 'Create your first course to get started.'}
            actionLabel="New Course"
            onAction={() => setDrawerOpen(true)}
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Code</th>
                  <th>Lecturer</th>
                  <th>Credits</th>
                  <th>Enrolled</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(course => (
                  <tr key={course.id}>
                    <td>
                      <div className={styles.courseCell}>
                        <span
                          className={styles.colorBar}
                          style={{ background: colorDot(course.color) }}
                        />
                        <div>
                          <div className={styles.courseName}>{course.title}</div>
                          {course.department && (
                            <div className={styles.courseDept}>{course.department}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.codeTag}>{course.code}</span>
                    </td>
                    <td>
                      {course.lecturerName
                        ? <span className={styles.lecturerName}>{course.lecturerName}</span>
                        : <span className={styles.unassigned}>Unassigned</span>}
                    </td>
                    <td>
                      <span className={styles.credits}>{course.credits} cr</span>
                    </td>
                    <td>
                      <div className={styles.enrolledCell}>
                        <RiGroupLine size={12} />
                        {course.enrolledStudents}
                      </div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          title="Assign lecturer"
                          onClick={() => openAssign(course)}
                        >
                          <RiLinkM size={14} />
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

      {/* Create Course Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create Course"
        subtitle="Add a new course to the institution."
      >
        <div className={styles.drawerForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Course Name *</label>
              <input
                className={styles.input}
                placeholder="e.g. Data Structures & Algorithms"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Course Code *</label>
              <input
                className={styles.input}
                placeholder="e.g. CS301"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Credits</label>
              <input
                className={styles.input}
                type="number"
                min="1"
                max="10"
                value={form.credits}
                onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Assign Lecturer</label>
              <select
                className={styles.input}
                value={form.lecturerId}
                onChange={e => setForm(f => ({ ...f, lecturerId: e.target.value }))}
              >
                <option value="">Select lecturer (optional)</option>
                {lecturers.map(l => (
                  <option key={l.id} value={l.id}>{l.name}{l.department ? ` — ${l.department}` : ''}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Description</label>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                placeholder="Brief course overview…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Colour</label>
              <div className={styles.colorPicker}>
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.colorDot} ${form.color === c ? styles.colorDotActive : ''}`}
                    style={{ background: colorDot(c) }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={styles.drawerActions}>
            <button className={styles.cancelBtn} onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className={styles.saveBtn} onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create Course'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Assign Lecturer Drawer */}
      <Drawer
        open={assignDrawerOpen}
        onClose={() => setAssignDrawerOpen(false)}
        title="Assign Lecturer"
        subtitle={assignCourse ? `Assigning a lecturer to ${assignCourse.code} — ${assignCourse.title}` : ''}
        width={440}
      >
        <div className={styles.drawerForm}>
          {assignCourse?.lecturerName && (
            <div className={styles.currentLecturer}>
              Currently assigned: <strong>{assignCourse.lecturerName}</strong>
            </div>
          )}
          <div className={styles.formGroup}>
            <label className={styles.label}>Select Lecturer</label>
            <select
              className={styles.input}
              value={selectedLecturer}
              onChange={e => setSelectedLecturer(e.target.value)}
            >
              <option value="">Choose a lecturer…</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.department ? ` — ${l.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.drawerActions}>
            <button className={styles.cancelBtn} onClick={() => setAssignDrawerOpen(false)} disabled={assigning}>
              Cancel
            </button>
            <button className={styles.saveBtn} onClick={handleAssign} disabled={assigning || !selectedLecturer}>
              {assigning ? 'Assigning…' : 'Assign Lecturer'}
            </button>
          </div>
        </div>
      </Drawer>
    </DashboardShell>
  )
}