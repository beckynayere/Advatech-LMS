'use client'
 
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiAddLine, RiArrowLeftLine, RiArrowDownSLine,
  RiCalendarLine, RiFileListLine, RiDownloadLine,
  RiEditLine, RiDeleteBinLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import {
  getAssignments,
  getSubmissionsForAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  gradeSubmission,
  getSubmissionDownloadUrls,
} from '@/lib/api/assignments'
import styles from './assignments.module.css'
import modalStyles from '@/components/ui/Modal.module.css'
 
export default function LecturerAssignmentsPage() {
  const { courseId } = useParams()
  const toast = useToast()
 
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState({})
  const [loadingSubs, setLoadingSubs] = useState({})
 
  // ── Create modal ────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [newForm, setNewForm]       = useState({
    title: '', description: '', dueDate: '', totalMarks: '100', isPublished: true,
  })
  const [saving, setSaving] = useState(false)
 
  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen]     = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm]     = useState({
    title: '', description: '', dueDate: '', totalMarks: '100', isPublished: true,
  })
  const [editSaving, setEditSaving] = useState(false)
 
  // ── Grade modal ─────────────────────────────────────────────────────────────
  const [gradeOpen, setGradeOpen]     = useState(false)
  const [activeSub, setActiveSub]     = useState(null)
  const [gradeForm, setGradeForm]     = useState({ grade: '', feedback: '' })
  const [gradeSaving, setGradeSaving] = useState(false)
 
  // ── Download loading ────────────────────────────────────────────────────────
  const [downloadingSubId, setDownloadingSubId] = useState(null)
 
  useEffect(() => {
    getAssignments(courseId)
      .then(setAssignments)
      .finally(() => setLoading(false))
  }, [courseId])
 
  // ── Expand accordion + lazy-load submissions ────────────────────────────────
  const toggleExpand = async (assignment) => {
    const id   = assignment.id
    const open = !expanded[id]
    setExpanded(prev => ({ ...prev, [id]: open }))
 
    if (open && !assignment._subsLoaded) {
      setLoadingSubs(prev => ({ ...prev, [id]: true }))
      try {
        const subs = await getSubmissionsForAssignment(id)
        setAssignments(prev => prev.map(a =>
          String(a.id) === String(id)
            ? { ...a, submissions: subs, _subsLoaded: true }
            : a
        ))
      } catch {
        toast.error('Could not load submissions for this assignment.')
      } finally {
        setLoadingSubs(prev => ({ ...prev, [id]: false }))
      }
    }
  }
 
  // ── Create assignment ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newForm.title.trim())                          { toast.warning('Title is required.');                    return }
    if (!newForm.dueDate)                               { toast.warning('Due date is required.');                 return }
    if (!newForm.totalMarks || Number(newForm.totalMarks) <= 0) { toast.warning('Total marks must be positive.'); return }
    setSaving(true)
    try {
      const created = await createAssignment(courseId, newForm)
      setAssignments(prev => [...prev, { ...created, submissions: [], _subsLoaded: true }])
      setCreateOpen(false)
      setNewForm({ title: '', description: '', dueDate: '', totalMarks: '100', isPublished: true })
      toast.success(`Assignment "${created.title}" created.`)
    } catch (e) {
      toast.error(e.message || 'Failed to create assignment.')
    } finally {
      setSaving(false)
    }
  }
 
  // ── Open edit modal ─────────────────────────────────────────────────────────
  // FIX 7: was missing entirely
  const openEdit = (e, a) => {
    e.stopPropagation()
    setEditTarget(a)
    setEditForm({
      title:       a.title,
      description: a.description,
      dueDate:     a.dueDate,
      totalMarks:  String(a.totalMarks),
      isPublished: a.isPublished,
    })
    setEditOpen(true)
  }
 
  // ── Save edit ───────────────────────────────────────────────────────────────
  // FIX 7: was missing entirely
  const handleEdit = async () => {
    if (!editForm.title.trim())                                { toast.warning('Title is required.');      return }
    if (!editForm.totalMarks || Number(editForm.totalMarks) <= 0) { toast.warning('Marks must be positive.'); return }
    setEditSaving(true)
    try {
      const updated = await updateAssignment(editTarget.id, editForm)
      setAssignments(prev => prev.map(a =>
        String(a.id) === String(editTarget.id) ? { ...a, ...updated } : a
      ))
      setEditOpen(false)
      toast.success('Assignment updated.')
    } catch (e) {
      toast.error(e.message || 'Failed to update assignment.')
    } finally {
      setEditSaving(false)
    }
  }
 
  // ── Delete assignment ───────────────────────────────────────────────────────
  // FIX 7: was missing entirely
  const handleDelete = async (e, assignmentId, title) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${title}"? This cannot be undone and will remove all submissions.`)) return
    try {
      await deleteAssignment(assignmentId)
      setAssignments(prev => prev.filter(a => String(a.id) !== String(assignmentId)))
      toast.success('Assignment deleted.')
    } catch (e) {
      toast.error(e.message || 'Failed to delete assignment.')
    }
  }
 
  // ── Open grade modal ────────────────────────────────────────────────────────
  const openGrade = (assignment, sub) => {
    setActiveSub({ ...sub, assignmentId: assignment.id, totalMarks: assignment.totalMarks })
    setGradeForm({ grade: sub.grade ?? '', feedback: sub.feedback || '' })
    setGradeOpen(true)
  }
 
  // ── Submit grade ────────────────────────────────────────────────────────────
  const handleGrade = async () => {
    if (!activeSub) return
    if (gradeForm.grade === '' || gradeForm.grade === null) { toast.warning('Please enter a score.'); return }
    const score = Number(gradeForm.grade)
    if (isNaN(score) || score < 0)           { toast.warning('Score must be a non-negative number.'); return }
    if (score > activeSub.totalMarks)        { toast.warning(`Score cannot exceed ${activeSub.totalMarks}.`); return }
    setGradeSaving(true)
    try {
      await gradeSubmission(activeSub.assignmentId, activeSub.id, {
        grade: score, feedback: gradeForm.feedback || null,
      })
      setAssignments(prev => prev.map(a => ({
        ...a,
        submissions: (a.submissions || []).map(s =>
          String(s.id) === String(activeSub.id)
            ? { ...s, grade: score, feedback: gradeForm.feedback, status: 'graded' }
            : s
        ),
      })))
      setGradeOpen(false)
      toast.success('Grade saved and student notified.')
    } catch (e) {
      toast.error(e.message || 'Failed to save grade.')
    } finally {
      setGradeSaving(false)
    }
  }
 
  // ── Download submission files ───────────────────────────────────────────────
  // FIX 8: was missing entirely
  const handleDownload = async (assignmentId, sub) => {
    setDownloadingSubId(sub.id)
    try {
      const urls = await getSubmissionDownloadUrls(assignmentId, sub.id)
      if (!urls || urls.length === 0) {
        toast.warning('No downloadable files found for this submission.')
        return
      }
      urls.forEach(item => {
        const url = typeof item === 'string' ? item : item.url || item.signedUrl
        if (url) window.open(url, '_blank')
      })
    } catch (e) {
      toast.error(e.message || 'Could not get download links.')
    } finally {
      setDownloadingSubId(null)
    }
  }
 
  return (
    <DashboardShell title="Assignments" subtitle={`Course: ${courseId}`} requiredRole="lecturer">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/lecturer/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to course
          </Link>
          <button className={styles.addBtn} onClick={() => setCreateOpen(true)}>
            <RiAddLine size={15} /> New Assignment
          </button>
        </div>
 
        {loading ? (
          <SkeletonCard count={3} />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={RiFileListLine}
            title="No assignments yet"
            desc="Create your first assignment for this course."
            actionLabel="New Assignment"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          assignments.map(a => {
            const subs    = a.submissions || []
            const pending = subs.filter(s => s.status === 'submitted' || s.status === 'late').length
            const graded  = subs.filter(s => s.status === 'graded').length
 
            return (
              <div key={a.id} className={styles.assignCard}>
                <div className={styles.assignHeader} onClick={() => toggleExpand(a)}>
                  <div className={styles.assignInfo}>
                    <div className={styles.assignTitle}>{a.title}</div>
                    <div className={styles.assignMeta}>
                      {a.dueDate && (
                        <span><RiCalendarLine size={11} /> Due: {a.dueDate}</span>
                      )}
                      <span><RiFileListLine size={11} /> {a.totalMarks} marks</span>
                      <Badge
                        label={a.isPublished ? 'Published' : 'Draft'}
                        color={a.isPublished ? 'success' : 'gray'}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge label={`${pending} pending`} color={pending > 0 ? 'warning' : 'gray'} size="sm" />
                    <Badge label={`${graded} graded`} color="success" size="sm" />
 
                    {/* FIX 7: Edit button — was missing */}
                    <button
                      className={styles.iconBtn}
                      title="Edit assignment"
                      onClick={e => openEdit(e, a)}
                      style={{ color: 'var(--primary)' }}
                    >
                      <RiEditLine size={14} />
                    </button>
 
                    {/* FIX 7: Delete button — was missing */}
                    <button
                      className={styles.iconBtn}
                      title="Delete assignment"
                      onClick={e => handleDelete(e, a.id, a.title)}
                      style={{ color: 'var(--danger)' }}
                    >
                      <RiDeleteBinLine size={14} />
                    </button>
 
                    <RiArrowDownSLine
                      size={16}
                      className={`${styles.chevron} ${expanded[a.id] ? styles.open : ''}`}
                    />
                  </div>
                </div>
 
                {expanded[a.id] && (
                  <div className={styles.submissions}>
                    {loadingSubs[a.id] ? (
                      <div className={styles.subsLoading}>Loading submissions…</div>
                    ) : subs.length === 0 ? (
                      <div className={styles.emptySubmissions}>No submissions yet</div>
                    ) : (
                      subs.map(sub => (
                        <div key={sub.id} className={styles.subRow}>
                          <div className={styles.subName}>{sub.studentName}</div>
                          <div className={styles.subDate}>
                            {sub.submittedAt ? sub.submittedAt.split('T')[0] : '—'}
                          </div>
                          <Badge
                            label={sub.status}
                            color={
                              sub.status === 'graded' ? 'success'
                              : sub.status === 'late'  ? 'danger'
                              : 'warning'
                            }
                            dot
                            size="sm"
                          />
 
                          {/* FIX 8: Download files button — was missing */}
                          {sub.fileKeys && sub.fileKeys.length > 0 && (
                            <button
                              className={styles.dlBtn || styles.gradeBtn}
                              title="Download submission files"
                              disabled={downloadingSubId === sub.id}
                              onClick={() => handleDownload(a.id, sub)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <RiDownloadLine size={13} />
                              {downloadingSubId === sub.id ? '…' : 'Files'}
                            </button>
                          )}
 
                          {sub.status === 'graded' ? (
                            <div className={styles.gradeDisplay}>
                              {sub.grade}/{a.totalMarks}
                              <button
                                className={styles.reGradeBtn}
                                onClick={() => openGrade(a, sub)}
                                title="Revise grade"
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <button
                              className={styles.gradeBtn}
                              onClick={() => openGrade(a, sub)}
                            >
                              Grade
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
 
      {/* ── Create Assignment Modal ──────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Assignment"
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className={modalStyles.btnPrimary} onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Title *</label>
          <input
            className={modalStyles.input}
            placeholder="Assignment title"
            value={newForm.title}
            onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Description / Instructions</label>
          <textarea
            className={modalStyles.textarea}
            placeholder="Describe the assignment and any instructions for students…"
            rows={4}
            value={newForm.description}
            onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className={modalStyles.row}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Due Date *</label>
            <input
              className={modalStyles.input}
              type="date"
              value={newForm.dueDate}
              onChange={e => setNewForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Total Marks *</label>
            <input
              className={modalStyles.input}
              type="number"
              min="1"
              placeholder="100"
              value={newForm.totalMarks}
              onChange={e => setNewForm(f => ({ ...f, totalMarks: e.target.value }))}
            />
          </div>
        </div>
        <div className={modalStyles.checkRow}>
          <label className={modalStyles.checkLabel}>
            <input
              type="checkbox"
              checked={newForm.isPublished}
              onChange={e => setNewForm(f => ({ ...f, isPublished: e.target.checked }))}
            />
            Publish immediately (students can see and submit)
          </label>
        </div>
      </Modal>
 
      {/* ── Edit Assignment Modal ────────────────────────────────────────────── */}
      {/* FIX 7: was missing entirely */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Assignment"
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button className={modalStyles.btnPrimary} onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Title *</label>
          <input
            className={modalStyles.input}
            placeholder="Assignment title"
            value={editForm.title}
            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Description / Instructions</label>
          <textarea
            className={modalStyles.textarea}
            placeholder="Describe the assignment and any instructions for students…"
            rows={4}
            value={editForm.description}
            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className={modalStyles.row}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Due Date</label>
            <input
              className={modalStyles.input}
              type="date"
              value={editForm.dueDate}
              onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Total Marks *</label>
            <input
              className={modalStyles.input}
              type="number"
              min="1"
              value={editForm.totalMarks}
              onChange={e => setEditForm(f => ({ ...f, totalMarks: e.target.value }))}
            />
          </div>
        </div>
        <div className={modalStyles.checkRow}>
          <label className={modalStyles.checkLabel}>
            <input
              type="checkbox"
              checked={editForm.isPublished}
              onChange={e => setEditForm(f => ({ ...f, isPublished: e.target.checked }))}
            />
            Published (visible to students)
          </label>
        </div>
      </Modal>
 
      {/* ── Grade Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={gradeOpen}
        onClose={() => setGradeOpen(false)}
        title={`Grade: ${activeSub?.studentName}`}
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => setGradeOpen(false)}>
              Cancel
            </button>
            <button className={modalStyles.btnPrimary} onClick={handleGrade} disabled={gradeSaving}>
              {gradeSaving ? 'Saving…' : 'Save Grade'}
            </button>
          </>
        }
      >
        {activeSub?.content && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Student Submission</label>
            <textarea
              className={modalStyles.textarea}
              value={activeSub.content}
              readOnly
              rows={4}
              style={{ background: 'var(--gray-50)', color: 'var(--text-secondary)' }}
            />
          </div>
        )}
        {!activeSub?.content && (
          <div className={modalStyles.field}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              This submission has a file attachment. Use the Download Files button in the submission list to access it.
            </p>
          </div>
        )}
        <div className={modalStyles.row}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>
              Score * (out of {activeSub?.totalMarks})
            </label>
            <input
              className={modalStyles.input}
              type="number"
              min="0"
              max={activeSub?.totalMarks}
              value={gradeForm.grade}
              onChange={e => setGradeForm(f => ({ ...f, grade: e.target.value }))}
            />
          </div>
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Feedback (shown to student)</label>
          <textarea
            className={modalStyles.textarea}
            placeholder="Optional feedback…"
            rows={3}
            value={gradeForm.feedback}
            onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
          />
        </div>
      </Modal>
    </DashboardShell>
  )
}
