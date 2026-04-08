// DESTINATION: src/app/admin/cohorts/page.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  RiAddLine, RiGroupLine, RiBookOpenLine,
  RiEditLine, RiDeleteBinLine, RiSearchLine,
  RiArrowLeftLine, RiUserAddLine, RiLinkM,
  RiCloseLine, RiCalendarLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Drawer from '@/components/ui/Drawer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/lib/ToastContext'
import {
  getCohorts, getCohort, createCohort, updateCohort, deleteCohort,
  enrollStudent, unenrollStudent, addCourseToCohort, removeCourseFromCohort,
} from '@/lib/api/cohorts'
import { getStudents } from '@/lib/api/users'
import { getCourses } from '@/lib/api/courses'
import { getLecturers } from '@/lib/api/users'
import styles from './cohorts.module.css'

const EMPTY_FORM = {
  name: '', code: '', description: '', academicYear: '',
  semester: '', maxStudents: '50', startDate: '', endDate: '', coordinatorId: '',
}

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusOf(cohort) {
  const now = new Date()
  const start = new Date(cohort.startDate)
  const end   = new Date(cohort.endDate)
  if (start > now)    return 'upcoming'
  if (end   < now)    return 'completed'
  return 'active'
}

const STATUS_LABEL = { active: 'Active', upcoming: 'Upcoming', completed: 'Completed' }
const STATUS_COLOR = { active: 'success', upcoming: 'info', completed: 'gray' }

// ══════════════════════════════════════════════════════════════════════════════
export default function CohortsPage() {
  const toast = useToast()

  // ── list state ─────────────────────────────────────────────────────────────
  const [cohorts, setCohorts]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search,  setSearch]    = useState('')

  // ── create / edit drawer ───────────────────────────────────────────────────
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [editTarget,  setEditTarget]  = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [lecturers,   setLecturers]   = useState([])

  // ── detail panel ──────────────────────────────────────────────────────────
  const [detail,        setDetail]        = useState(null) // full cohort object
  const [detailLoading, setDetailLoading] = useState(false)
  const [allStudents,   setAllStudents]   = useState([])
  const [allCourses,    setAllCourses]    = useState([])

  // ── enroll student sub-drawer ──────────────────────────────────────────────
  const [enrollDrawerOpen,  setEnrollDrawerOpen]  = useState(false)
  const [studentSearch,     setStudentSearch]      = useState('')
  const [enrolling,         setEnrolling]          = useState(false)

  // ── attach course sub-drawer ───────────────────────────────────────────────
  const [courseDrawerOpen,  setCourseDrawerOpen]  = useState(false)
  const [selectedCourse,    setSelectedCourse]    = useState('')
  const [attaching,         setAttaching]         = useState(false)

  // ── confirm delete ─────────────────────────────────────────────────────────
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  // ── unenroll confirm ───────────────────────────────────────────────────────
  const [unenrollTarget,  setUnenrollTarget]  = useState(null)
  const [unenrolling,     setUnenrolling]     = useState(false)

  // ── detach course confirm ──────────────────────────────────────────────────
  const [detachTarget,  setDetachTarget]  = useState(null)
  const [detaching,     setDetaching]     = useState(false)

  // ── load list ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.allSettled([getCohorts(), getLecturers()])
      .then(([cr, lr]) => {
        if (cr.status === 'fulfilled') setCohorts(cr.value)
        if (lr.status === 'fulfilled') setLecturers(lr.value)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── open detail ────────────────────────────────────────────────────────────
  const openDetail = useCallback(async (cohortId) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const [cohort, students, courses] = await Promise.all([
        getCohort(cohortId),
        getStudents(),
        getCourses(),
      ])
      setDetail(cohort)
      setAllStudents(students)
      setAllCourses(courses)
    } catch (e) {
      toast.error('Failed to load cohort details.')
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  // ── create / edit ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  const openEdit = (cohort, e) => {
    e.stopPropagation()
    setEditTarget(cohort)
    setForm({
      name:          cohort.name,
      code:          cohort.code,
      description:   cohort.description || '',
      academicYear:  cohort.academicYear,
      semester:      cohort.semester,
      maxStudents:   String(cohort.maxStudents),
      startDate:     cohort.startDate ? cohort.startDate.split('T')[0] : '',
      endDate:       cohort.endDate   ? cohort.endDate.split('T')[0]   : '',
      coordinatorId: cohort.coordinatorId || '',
    })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    const required = ['name', 'code', 'academicYear', 'semester', 'startDate', 'endDate', 'coordinatorId']
    for (const f of required) {
      if (!form[f]) { toast.warning(`${f} is required.`); return }
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.warning('End date must be after start date.')
      return
    }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateCohort(editTarget.id, form)
        setCohorts(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...updated } : c))
        if (detail?.id === editTarget.id) setDetail(prev => ({ ...prev, ...updated }))
        toast.success('Cohort updated.')
      } else {
        const created = await createCohort(form)
        setCohorts(prev => [created, ...prev])
        toast.success(`Cohort "${created.name}" created.`)
      }
      setDrawerOpen(false)
    } catch (e) {
      toast.error(e.message || 'Failed to save cohort.')
    } finally {
      setSaving(false)
    }
  }

  // ── delete cohort ──────────────────────────────────────────────────────────
  const confirmDelete = (cohort, e) => {
    e.stopPropagation()
    setConfirmTarget(cohort)
    setConfirmOpen(true)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteCohort(confirmTarget.id)
      setCohorts(prev => prev.filter(c => c.id !== confirmTarget.id))
      if (detail?.id === confirmTarget.id) setDetail(null)
      toast.success(`${confirmTarget.name} deleted.`)
      setConfirmOpen(false)
    } catch (e) {
      toast.error(e.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  // ── enroll student ─────────────────────────────────────────────────────────
  const handleEnroll = async (studentId) => {
    setEnrolling(true)
    try {
      await enrollStudent(detail.id, studentId)
      // Refresh detail
      const updated = await getCohort(detail.id)
      setDetail(updated)
      toast.success('Student enrolled.')
    } catch (e) {
      toast.error(e.message || 'Failed to enroll student.')
    } finally {
      setEnrolling(false)
    }
  }

  const handleUnenroll = async () => {
    setUnenrolling(true)
    try {
      await unenrollStudent(detail.id, unenrollTarget.studentId)
      const updated = await getCohort(detail.id)
      setDetail(updated)
      toast.success('Student removed from cohort.')
      setUnenrollTarget(null)
    } catch (e) {
      toast.error(e.message || 'Failed to remove student.')
    } finally {
      setUnenrolling(false)
    }
  }

  // ── attach course ──────────────────────────────────────────────────────────
  const handleAttachCourse = async () => {
    if (!selectedCourse) { toast.warning('Select a course.'); return }
    setAttaching(true)
    try {
      await addCourseToCohort(detail.id, selectedCourse)
      const updated = await getCohort(detail.id)
      setDetail(updated)
      setCourseDrawerOpen(false)
      setSelectedCourse('')
      toast.success('Course added to cohort.')
    } catch (e) {
      toast.error(e.message || 'Failed to add course.')
    } finally {
      setAttaching(false)
    }
  }

  const handleDetachCourse = async () => {
    setDetaching(true)
    try {
      await removeCourseFromCohort(detail.id, detachTarget.id)
      const updated = await getCohort(detail.id)
      setDetail(updated)
      setDetachTarget(null)
      toast.success('Course removed from cohort.')
    } catch (e) {
      toast.error(e.message || 'Failed to remove course.')
    } finally {
      setDetaching(false)
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const filtered = cohorts.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.academicYear.includes(q)
  })

  const enrolledIds = new Set((detail?.enrollments || []).map(e => e.studentId))
  const attachedCourseIds = new Set((detail?.courses || []).map(c => c.id))

  const unenrolledStudents = allStudents.filter(s => !enrolledIds.has(s.id))
  const filteredUnenrolled = unenrolledStudents.filter(s => {
    const q = studentSearch.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  const unattachedCourses = allCourses.filter(c => !attachedCourseIds.has(c.id))

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <DashboardShell title="Cohorts" subtitle="Manage student groups and course enrolment" requiredRole="admin">
      <div className={styles.layout}>

        {/* ── LEFT: cohort list ─────────────────────────────────── */}
        <div className={`${styles.listPanel} ${detail ? styles.listPanelNarrow : ''}`}>

          <div className={styles.listToolbar}>
            <div className={styles.searchWrap}>
              <RiSearchLine className={styles.searchIcon} size={14} />
              <input
                className={styles.searchInput}
                placeholder="Search cohorts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className={styles.addBtn} onClick={openCreate}>
              <RiAddLine size={15} /> New Cohort
            </button>
          </div>

          {loading ? (
            <SkeletonTable rows={5} cols={3} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={RiGroupLine}
              title="No cohorts yet"
              desc="Create your first cohort to start enrolling students."
              actionLabel="New Cohort"
              onAction={openCreate}
            />
          ) : (
            <div className={styles.cohortList}>
              {filtered.map(cohort => {
                const status = statusOf(cohort)
                const isActive = detail?.id === cohort.id
                return (
                  <div
                    key={cohort.id}
                    className={`${styles.cohortRow} ${isActive ? styles.cohortRowActive : ''}`}
                    onClick={() => openDetail(cohort.id)}
                  >
                    <div className={styles.cohortRowMain}>
                      <div className={styles.cohortRowTop}>
                        <span className={styles.cohortCode}>{cohort.code}</span>
                        <span className={`${styles.statusDot} ${styles[status]}`} />
                        <span className={styles.statusLabel}>{STATUS_LABEL[status]}</span>
                      </div>
                      <div className={styles.cohortName}>{cohort.name}</div>
                      <div className={styles.cohortMeta}>
                        {cohort.academicYear} · {cohort.semester}
                      </div>
                    </div>
                    <div className={styles.cohortRowRight}>
                      <div className={styles.cohortStats}>
                        <span><RiGroupLine size={11} /> {cohort.enrollmentCount}/{cohort.maxStudents}</span>
                        <span><RiBookOpenLine size={11} /> {cohort.courseCount}</span>
                      </div>
                      <div className={styles.cohortActions}>
                        <button className={styles.iconBtn} title="Edit" onClick={e => openEdit(cohort, e)}>
                          <RiEditLine size={13} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.danger}`} title="Delete" onClick={e => confirmDelete(cohort, e)}>
                          <RiDeleteBinLine size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: detail panel ───────────────────────────────── */}
        {(detail || detailLoading) && (
          <div className={styles.detailPanel}>
            {detailLoading ? (
              <div className={styles.detailLoading}>
                <div className={styles.spinner} />
                Loading cohort details…
              </div>
            ) : detail && (
              <>
                {/* Header */}
                <div className={styles.detailHeader}>
                  <button className={styles.closeDetail} onClick={() => setDetail(null)}>
                    <RiCloseLine size={16} />
                  </button>
                  <div className={styles.detailTitleRow}>
                    <div>
                      <div className={styles.detailCode}>{detail.code}</div>
                      <div className={styles.detailName}>{detail.name}</div>
                      <div className={styles.detailSubtitle}>
                        {detail.academicYear} · {detail.semester}
                        {detail.coordinatorName && ` · Coordinator: ${detail.coordinatorName}`}
                      </div>
                    </div>
                    <div className={styles.detailHeaderStats}>
                      <div className={styles.headerStat}>
                        <div className={styles.headerStatValue}>{detail.enrollmentCount}</div>
                        <div className={styles.headerStatLabel}>Students</div>
                      </div>
                      <div className={styles.headerStat}>
                        <div className={styles.headerStatValue}>{detail.courseCount}</div>
                        <div className={styles.headerStatLabel}>Courses</div>
                      </div>
                      <div className={styles.headerStat}>
                        <div className={styles.headerStatValue}>{detail.maxStudents}</div>
                        <div className={styles.headerStatLabel}>Capacity</div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.dateRow}>
                    <RiCalendarLine size={12} />
                    {fmtDate(detail.startDate)} → {fmtDate(detail.endDate)}
                  </div>
                </div>

                {/* Courses section */}
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <RiBookOpenLine size={14} /> Courses ({detail.courses.length})
                    </div>
                    <button className={styles.sectionAddBtn} onClick={() => setCourseDrawerOpen(true)}>
                      <RiAddLine size={13} /> Add Course
                    </button>
                  </div>
                  {detail.courses.length === 0 ? (
                    <div className={styles.emptySection}>
                      No courses attached. Add courses so enrolled students can access them.
                    </div>
                  ) : (
                    <div className={styles.chipList}>
                      {detail.courses.map(c => (
                        <div key={c.id} className={styles.chip}>
                          <span className={styles.chipCode}>{c.code}</span>
                          <span className={styles.chipName}>{c.name}</span>
                          <button
                            className={styles.chipRemove}
                            onClick={() => setDetachTarget(c)}
                            title="Remove course"
                          >
                            <RiCloseLine size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Students section */}
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <RiGroupLine size={14} /> Enrolled Students ({detail.enrollments.length})
                    </div>
                    <button
                      className={styles.sectionAddBtn}
                      onClick={() => { setStudentSearch(''); setEnrollDrawerOpen(true) }}
                      disabled={detail.enrollmentCount >= detail.maxStudents}
                      title={detail.enrollmentCount >= detail.maxStudents ? 'Cohort is at capacity' : 'Enroll student'}
                    >
                      <RiUserAddLine size={13} /> Enroll Student
                    </button>
                  </div>

                  {detail.enrollments.length === 0 ? (
                    <div className={styles.emptySection}>
                      No students enrolled yet. Click "Enroll Student" to add students.
                    </div>
                  ) : (
                    <table className={styles.enrollTable}>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Email</th>
                          <th style={{ width: 52 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.enrollments.map(e => (
                          <tr key={e.studentId}>
                            <td className={styles.studentName}>{e.studentName}</td>
                            <td className={styles.studentEmail}>{e.studentEmail}</td>
                            <td>
                              <button
                                className={`${styles.iconBtn} ${styles.danger}`}
                                title="Remove from cohort"
                                onClick={() => setUnenrollTarget(e)}
                              >
                                <RiDeleteBinLine size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── CREATE / EDIT DRAWER ───────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Cohort' : 'Create Cohort'}
        subtitle={editTarget ? `Editing ${editTarget.name}` : 'A cohort groups students together for a set of courses over an academic period.'}
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Cohort Name *</label>
              <input className={styles.input} placeholder="e.g. Computer Science Year 2" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Code *</label>
              <input className={styles.input} placeholder="e.g. CS-Y2-2025" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} disabled={!!editTarget} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Max Students</label>
              <input className={styles.input} type="number" min="1" max="500" value={form.maxStudents} onChange={e => setForm(f => ({ ...f, maxStudents: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Academic Year *</label>
              <input className={styles.input} placeholder="e.g. 2024/2025" value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Semester *</label>
              <select className={styles.input} value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}>
                <option value="">Select…</option>
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Trimester 1">Trimester 1</option>
                <option value="Trimester 2">Trimester 2</option>
                <option value="Trimester 3">Trimester 3</option>
                <option value="Full Year">Full Year</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Start Date *</label>
              <input className={styles.input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>End Date *</label>
              <input className={styles.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Coordinator (Lecturer) *</label>
              <select className={styles.input} value={form.coordinatorId} onChange={e => setForm(f => ({ ...f, coordinatorId: e.target.value }))}>
                <option value="">Select coordinator…</option>
                {lecturers.map(l => (
                  <option key={l.id} value={l.id}>{l.name}{l.department ? ` — ${l.department}` : ''}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Description</label>
              <textarea className={`${styles.input} ${styles.textarea}`} placeholder="Optional description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          <div className={styles.drawerActions}>
            <button className={styles.cancelBtn} onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Cohort'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* ── ENROLL STUDENT DRAWER ──────────────────────────────── */}
      <Drawer
        open={enrollDrawerOpen}
        onClose={() => setEnrollDrawerOpen(false)}
        title="Enroll Student"
        subtitle={detail ? `Adding to ${detail.name} (${detail.enrollmentCount}/${detail.maxStudents} enrolled)` : ''}
        width={460}
      >
        <div className={styles.form}>
          <div className={styles.searchWrap} style={{ maxWidth: '100%' }}>
            <RiSearchLine className={styles.searchIcon} size={14} />
            <input
              className={styles.searchInput}
              placeholder="Search students…"
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
            />
          </div>

          {filteredUnenrolled.length === 0 ? (
            <div className={styles.emptySection} style={{ marginTop: 16 }}>
              {studentSearch ? 'No students match your search.' : 'All students are already enrolled.'}
            </div>
          ) : (
            <div className={styles.studentPickList}>
              {filteredUnenrolled.map(s => (
                <div key={s.id} className={styles.studentPickRow}>
                  <div className={styles.studentPickInfo}>
                    <div className={styles.pickName}>{s.name}</div>
                    <div className={styles.pickEmail}>{s.email}</div>
                  </div>
                  <button
                    className={styles.enrollBtn}
                    onClick={() => handleEnroll(s.id)}
                    disabled={enrolling}
                  >
                    {enrolling ? '…' : 'Enroll'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>

      {/* ── ATTACH COURSE DRAWER ──────────────────────────────── */}
      <Drawer
        open={courseDrawerOpen}
        onClose={() => setCourseDrawerOpen(false)}
        title="Add Course to Cohort"
        subtitle={detail ? `Students in ${detail.name} will gain access to this course.` : ''}
        width={440}
      >
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Select Course</label>
            <select className={styles.input} value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
              <option value="">Choose a course…</option>
              {unattachedCourses.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
            {unattachedCourses.length === 0 && (
              <div className={styles.fieldNote}>All courses are already attached to this cohort.</div>
            )}
          </div>
          <div className={styles.drawerActions}>
            <button className={styles.cancelBtn} onClick={() => setCourseDrawerOpen(false)} disabled={attaching}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleAttachCourse} disabled={attaching || !selectedCourse}>
              {attaching ? 'Adding…' : 'Add Course'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* ── CONFIRM DELETE COHORT ──────────────────────────────── */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Cohort"
        message={`Delete "${confirmTarget?.name}"? All enrolments will be deactivated. This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      {/* ── CONFIRM UNENROLL ──────────────────────────────────── */}
      <ConfirmDialog
        open={!!unenrollTarget}
        onClose={() => setUnenrollTarget(null)}
        onConfirm={handleUnenroll}
        loading={unenrolling}
        title="Remove Student"
        message={`Remove ${unenrollTarget?.studentName} from this cohort? They will lose access to all cohort courses.`}
        confirmLabel="Remove"
        danger
      />

      {/* ── CONFIRM DETACH COURSE ─────────────────────────────── */}
      <ConfirmDialog
        open={!!detachTarget}
        onClose={() => setDetachTarget(null)}
        onConfirm={handleDetachCourse}
        loading={detaching}
        title="Remove Course"
        message={`Remove ${detachTarget?.code} from this cohort? Enrolled students will lose access.`}
        confirmLabel="Remove"
        danger
      />
    </DashboardShell>
  )
}