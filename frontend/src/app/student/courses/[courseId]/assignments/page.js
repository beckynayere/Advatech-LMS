// DESTINATION: src/app/student/courses/[courseId]/assignments/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine, RiCalendarLine, RiFileListLine,
  RiSendPlane2Line, RiCheckboxCircleLine, RiTimeLine,
  RiArrowLeftSLine, RiArrowRightSLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { getAssignments, submitAssignment } from '@/lib/api/assignments'
import { getModules, markProgress } from '@/lib/api/modules'
import { getNextAndPrevious } from '@/lib/courseNavigation'
import styles from './assignments.module.css'
import modalStyles from '@/components/ui/Modal.module.css'

// Inner component — needs useSearchParams so must be wrapped in Suspense
function AssignmentsInner() {
  const { courseId }   = useParams()
  const searchParams   = useSearchParams()
  const toast          = useToast()

  const [assignments,  setAssignments]  = useState([])
  const [modules,      setModules]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [activeAssign, setActiveAssign] = useState(null)
  const [content,      setContent]      = useState('')
  const [file,         setFile]         = useState(null)
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => {
    Promise.all([getAssignments(courseId), getModules(courseId)])
      .then(([asgns, mods]) => {
        setAssignments(asgns)
        setModules(mods)

        // Auto-open the assignment specified by ?open=ID (from module deep-link)
        const openId = searchParams.get('open')
        if (openId) {
          const target = asgns.find(a => String(a.id) === String(openId))
          if (target) openSubmit(target)
        }
      })
      .finally(() => setLoading(false))
  }, [courseId]) // searchParams intentionally omitted — only auto-open on first load

  const openSubmit = (assign) => {
    setActiveAssign(assign)
    setContent('')
    setFile(null)
    setModalOpen(true)
    // Mark viewed when student opens the assignment detail
    markProgress(courseId, 'assignment', assign.id, 'viewed').catch(() => {})
  }

  const handleSubmit = async () => {
    if (!content.trim() && !file) {
      toast.warning('Please add your work before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const sub = await submitAssignment(activeAssign.id, {
        comment: content,
        file:    file || undefined,
      })
      setAssignments(prev => prev.map(a =>
        String(a.id) === String(activeAssign.id) ? { ...a, mySubmission: sub } : a
      ))
      setModalOpen(false)
      toast.success('Assignment submitted successfully!')
      // Mark completed on successful submission
      markProgress(courseId, 'assignment', activeAssign.id, 'completed').catch(() => {})
    } catch (e) {
      toast.error(e.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const isOverdue = (dueDate) => dueDate && new Date(dueDate) < new Date()

  // Prev / Next — based on module item order for the active assignment
  const activeId = activeAssign?.id
  const { prev, next } = activeId
    ? getNextAndPrevious(modules, activeId, 'assignment', courseId)
    : { prev: null, next: null }

  return (
    <DashboardShell title="Assignments" subtitle={`Course: ${courseId}`} requiredRole="student">
      <div className={styles.page}>
        <Link href={`/student/courses/${courseId}`} className={styles.backLink}>
          <RiArrowLeftLine size={14} /> Back to course
        </Link>

        {loading ? (
          <SkeletonCard count={3} />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={RiFileListLine}
            title="No assignments"
            desc="No assignments have been posted for this course yet."
          />
        ) : (
          assignments.map(a => {
            const mySub    = a.mySubmission
            const overdue  = isOverdue(a.dueDate)
            const canSubmit = !mySub && (!overdue || a.allowLateSubmit)
            return (
              <div key={a.id} className={styles.assignCard}>
                <div className={styles.assignTop}>
                  <div className={styles.assignInfo}>
                    <div className={styles.assignTitle}>{a.title}</div>
                    {a.description && (
                      <div className={styles.assignDesc}>{a.description}</div>
                    )}
                    <div className={styles.assignMeta}>
                      {a.dueDate && (
                        <div className={`${styles.assignMetaItem} ${overdue && !mySub ? styles.overdue : ''}`}>
                          <RiCalendarLine size={12} />
                          Due: {a.dueDate}
                          {overdue && !mySub && ' (Overdue)'}
                        </div>
                      )}
                      <div className={styles.assignMetaItem}>
                        <RiFileListLine size={12} /> {a.totalMarks} marks
                      </div>
                      {a.maxAttempts > 1 && (
                        <div className={styles.assignMetaItem}>
                          <RiTimeLine size={12} /> {a.maxAttempts} attempts allowed
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge
                    label={
                      mySub
                        ? mySub.status === 'graded' ? 'Graded'
                        : mySub.status === 'late'   ? 'Submitted (late)'
                        : 'Submitted'
                      : overdue ? 'Overdue'
                      : 'Pending'
                    }
                    color={
                      mySub?.status === 'graded' ? 'success'
                      : mySub                    ? 'warning'
                      : overdue                  ? 'danger'
                      : 'gray'
                    }
                    dot
                  />
                </div>

                {/* Graded result */}
                {mySub?.status === 'graded' && mySub.grade != null && (
                  <div className={styles.gradedBox}>
                    <div className={styles.gradedScore}>
                      <RiCheckboxCircleLine size={16} style={{ color: 'var(--success)' }} />
                      {mySub.grade} / {a.totalMarks}
                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        ({Math.round((Number(mySub.grade) / a.totalMarks) * 100)}%)
                      </span>
                    </div>
                    <div className={styles.gradeBarWrap}>
                      <div className={styles.gradeBar}>
                        <div
                          className={styles.gradeBarFill}
                          style={{ width: `${Math.min(100, Math.round((Number(mySub.grade) / a.totalMarks) * 100))}%` }}
                        />
                      </div>
                    </div>
                    {mySub.feedback && (
                      <div className={styles.gradedFeedback}>
                        <strong>Feedback:</strong> {mySub.feedback}
                      </div>
                    )}
                  </div>
                )}

                {/* Submitted not graded */}
                {mySub && mySub.status !== 'graded' && (
                  <div style={{ padding: '10px 20px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                    Submitted {mySub.submittedAt ? mySub.submittedAt.split('T')[0] : ''}
                    {mySub.status === 'late' ? ' (late)' : ''} — awaiting grading.
                  </div>
                )}

                {/* Submit button */}
                {!mySub && canSubmit && (
                  <button className={styles.submitBtn} onClick={() => openSubmit(a)}>
                    <RiSendPlane2Line size={14} /> Submit Assignment
                  </button>
                )}

                {/* Overdue, no late submit */}
                {!mySub && overdue && !a.allowLateSubmit && (
                  <div style={{ padding: '10px 20px 16px', fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
                    Deadline passed — submissions are no longer accepted.
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Submit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={activeAssign?.title || 'Submit Assignment'}
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button
              className={modalStyles.btnPrimary}
              onClick={handleSubmit}
              disabled={submitting || (!content.trim() && !file)}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </>
        }
      >
        {activeAssign?.description && (
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {activeAssign.description}
          </div>
        )}
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Your Answer / Notes</label>
          <textarea
            className={modalStyles.textarea}
            rows={6}
            placeholder="Type your answer or describe your submission…"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Attach File (optional)</label>
          <input
            type="file"
            className={modalStyles.input}
            style={{ padding: '8px 12px' }}
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          {file && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>

        {/* Prev / Next — inside modal so student can move without closing */}
        {(prev || next) && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)',
            gap: 8,
          }}>
            {prev ? (
              <Link
                href={prev.href}
                onClick={() => setModalOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                <RiArrowLeftSLine size={16} />
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prev.title}
                </span>
              </Link>
            ) : <div />}
            {next ? (
              <Link
                href={next.href}
                onClick={() => setModalOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
                  fontWeight: 600, textAlign: 'right',
                }}
              >
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {next.title}
                </span>
                <RiArrowRightSLine size={16} />
              </Link>
            ) : <div />}
          </div>
        )}
      </Modal>
    </DashboardShell>
  )
}

export default function StudentAssignmentsPage() {
  return (
    <Suspense fallback={null}>
      <AssignmentsInner />
    </Suspense>
  )
}