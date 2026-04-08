// DESTINATION: src/app/lecturer/courses/[courseId]/quiz/page.js
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiAddLine, RiArrowLeftLine, RiArrowDownSLine,
  RiTimeLine, RiQuestionLine, RiDeleteBinLine,
  RiCheckboxCircleLine, RiEyeLine, RiEyeOffLine, RiEditLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import {
  getQuizzes, getQuestions, createQuiz, updateQuiz,
  addQuestion, updateQuestion, deleteQuestion, deleteQuiz,
} from '@/lib/api/quizzes'
import styles from './quiz.module.css'
import modalStyles from '@/components/ui/Modal.module.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const QUESTION_TYPES = [
  { value: 'mcq',          label: 'Single Choice (MCQ)' },
  { value: 'multi_select', label: 'Multiple Choice (select all)' },
  { value: 'true_false',   label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer (manual grading)' },
  { value: 'essay',        label: 'Essay (manual grading)' },
]

const EMPTY_QUIZ_FORM = {
  title: '', description: '', type: 'graded',
  timeLimitMins: '', maxAttempts: '1', passMark: '50',
  randomizeQ: false, randomizeA: false, showResults: true,
  isPublished: false,
}

function makeEmptyQForm() {
  return {
    type: 'mcq',
    text: '',
    options: [
      { body: '', isCorrect: false },
      { body: '', isCorrect: false },
      { body: '', isCorrect: false },
      { body: '', isCorrect: false },
    ],
    correctIndex: 0,
    marks: '1',
    explanation: '',
  }
}

export default function LecturerQuizPage() {
  const { courseId } = useParams()
  const toast = useToast()

  const [quizzes, setQuizzes]           = useState([])
  const [expanded, setExpanded]         = useState({})
  const [loading, setLoading]           = useState(true)

  // Quiz create modal
  const [quizModalOpen, setQuizModal]   = useState(false)
  const [savingQuiz, setSavingQuiz]     = useState(false)
  const [quizForm, setQuizForm]         = useState(EMPTY_QUIZ_FORM)

  // Question add/edit modal
  const [qModalOpen, setQModal]         = useState(false)
  const [savingQ, setSavingQ]           = useState(false)
  const [qForm, setQForm]               = useState(makeEmptyQForm())
  const [activeQuizId, setActiveQuizId] = useState(null)
  const [editingQ, setEditingQ]         = useState(null) // null=add, obj=edit

  // Delete quiz confirm
  const [deletingQuiz, setDeletingQuiz] = useState(null)

  // Publish toggle loading
  const [toggling, setToggling]         = useState({})

  useEffect(() => {
    getQuizzes(courseId)
      .then(setQuizzes)
      .finally(() => setLoading(false))
  }, [courseId])

  // ── Expand: lazy-load questions ────────────────────────────────────────────
  const toggleExpand = async (quiz) => {
    const open = !expanded[quiz.id]
    setExpanded(prev => ({ ...prev, [quiz.id]: open }))
    if (open && (!quiz.questions || quiz.questions.length === 0) && (quiz.questionCount || 0) > 0) {
      try {
        const qs = await getQuestions(quiz.id)
        setQuizzes(prev => prev.map(q =>
          String(q.id) === String(quiz.id) ? { ...q, questions: qs } : q
        ))
      } catch { /* silent */ }
    }
  }

  // ── Create quiz ─────────────────────────────────────────────────────────────
  const handleCreateQuiz = async () => {
    if (!quizForm.title.trim()) { toast.warning('Quiz title is required.'); return }
    setSavingQuiz(true)
    try {
      const newQuiz = await createQuiz({
        courseId,
        title:         quizForm.title,
        description:   quizForm.description || null,
        type:          quizForm.type,
        timeLimitMins: quizForm.timeLimitMins ? Number(quizForm.timeLimitMins) : null,
        maxAttempts:   Number(quizForm.maxAttempts) || 1,
        passMark:      Number(quizForm.passMark) || 50,
        randomizeQ:    quizForm.randomizeQ,
        randomizeA:    quizForm.randomizeA,
        showResults:   quizForm.showResults,
        isPublished:   false,
      })
      setQuizzes(prev => [...prev, { ...newQuiz, questions: [] }])
      setQuizModal(false)
      setQuizForm(EMPTY_QUIZ_FORM)
      toast.success(`Quiz "${newQuiz.title}" created as draft.`)
    } catch (e) {
      toast.error(e.message || 'Failed to create quiz.')
    } finally {
      setSavingQuiz(false)
    }
  }

  // ── Toggle publish ──────────────────────────────────────────────────────────
  const handleTogglePublish = async (quiz) => {
    if (toggling[quiz.id]) return
    const next = !quiz.isPublished
    if (next) {
      const qCount = quiz.questions?.length ?? quiz.questionCount ?? 0
      if (qCount === 0) {
        toast.warning('Add at least one question before publishing.')
        return
      }
    }
    setToggling(prev => ({ ...prev, [quiz.id]: true }))
    try {
      await updateQuiz(quiz.id, { isPublished: next })
      setQuizzes(prev => prev.map(q =>
        String(q.id) === String(quiz.id) ? { ...q, isPublished: next } : q
      ))
      toast.success(next ? 'Quiz published — students can now see it.' : 'Quiz moved to draft.')
    } catch (e) {
      toast.error(e.message || 'Failed to update quiz.')
    } finally {
      setToggling(prev => ({ ...prev, [quiz.id]: false }))
    }
  }

  // ── Delete quiz ─────────────────────────────────────────────────────────────
  const handleDeleteQuiz = async (quiz) => {
    try {
      await deleteQuiz(quiz.id)
      setQuizzes(prev => prev.filter(q => String(q.id) !== String(quiz.id)))
      setDeletingQuiz(null)
      toast.success('Quiz deleted.')
    } catch (e) {
      toast.error(e.message || 'Failed to delete quiz.')
    }
  }

  // ── Open ADD question modal ─────────────────────────────────────────────────
  const openAddQuestion = (quizId) => {
    setActiveQuizId(quizId)
    setEditingQ(null)
    setQForm(makeEmptyQForm())
    setQModal(true)
  }

  // ── Open EDIT question modal — pre-fill from existing question ───────────────
  const openEditQuestion = (quizId, question) => {
    setActiveQuizId(quizId)
    setEditingQ(question)

    // Build options array from the normalised question
    let opts = (question.options || []).map(o => ({ body: o.body, isCorrect: o.isCorrect }))
    if (opts.length === 0) {
      opts = makeEmptyQForm().options.map(o => ({ ...o }))
    }
    const correctIdx = opts.findIndex(o => o.isCorrect)

    setQForm({
      type:         question.type || 'mcq',
      text:         question.text || '',
      options:      opts,
      correctIndex: correctIdx >= 0 ? correctIdx : 0,
      marks:        String(question.marks ?? 1),
      explanation:  question.explanation || '',
    })
    setQModal(true)
  }

  // ── qForm helpers ───────────────────────────────────────────────────────────
  const setOptionBody = (i, val) =>
    setQForm(f => ({ ...f, options: f.options.map((o, idx) => idx === i ? { ...o, body: val } : o) }))

  const setCorrectIndex = (i) =>
    setQForm(f => ({
      ...f,
      correctIndex: i,
      options: f.options.map((o, idx) => ({ ...o, isCorrect: idx === i })),
    }))

  const toggleMultiCorrect = (i) =>
    setQForm(f => ({
      ...f,
      options: f.options.map((o, idx) => idx === i ? { ...o, isCorrect: !o.isCorrect } : o),
    }))

  const handleQTypeChange = (type) => {
    setQForm(f => {
      let opts = f.options
      if (type === 'true_false') {
        opts = [{ body: 'True', isCorrect: true }, { body: 'False', isCorrect: false }]
      } else if (f.type === 'true_false') {
        opts = makeEmptyQForm().options.map(o => ({ ...o }))
      }
      return { ...f, type, options: opts, correctIndex: 0 }
    })
  }

  // ── Validate + build payload ─────────────────────────────────────────────────
  const validateAndBuildPayload = () => {
    if (!qForm.text.trim()) { toast.warning('Question text is required.'); return null }
    const needsOptions = ['mcq', 'multi_select', 'true_false'].includes(qForm.type)
    if (needsOptions) {
      const filled = qForm.options.filter(o => o.body.trim())
      if (filled.length < 2) { toast.warning('At least 2 options are required.'); return null }
      const hasCorrect = qForm.options.some(o => o.isCorrect && o.body.trim())
      if (!hasCorrect) { toast.warning('Mark at least one correct answer.'); return null }
    }
    return {
      type:         qForm.type,
      text:         qForm.text,
      marks:        Number(qForm.marks) || 1,
      explanation:  qForm.explanation || null,
      correctIndex: qForm.correctIndex,
      options:      needsOptions
        ? qForm.options
            .filter(o => o.body.trim())
            .map((o, i) => ({ body: o.body.trim(), isCorrect: o.isCorrect, sortOrder: i }))
        : [],
    }
  }

  // ── Save question (add OR edit) ─────────────────────────────────────────────
  const handleSaveQuestion = async () => {
    const payload = validateAndBuildPayload()
    if (!payload) return
    setSavingQ(true)
    try {
      if (editingQ) {
        // EDIT existing question
        const updated = await updateQuestion(activeQuizId, editingQ.id, payload)
        setQuizzes(prev => prev.map(q =>
          String(q.id) === String(activeQuizId)
            ? { ...q, questions: (q.questions || []).map(qq => String(qq.id) === String(editingQ.id) ? updated : qq) }
            : q
        ))
        toast.success('Question updated.')
      } else {
        // ADD new question
        const newQ = await addQuestion(activeQuizId, payload)
        setQuizzes(prev => prev.map(q =>
          String(q.id) === String(activeQuizId)
            ? { ...q, questions: [...(q.questions || []), newQ], questionCount: (q.questionCount || 0) + 1 }
            : q
        ))
        toast.success('Question added.')
      }
      setQModal(false)
      setEditingQ(null)
    } catch (e) {
      toast.error(e.message || 'Failed to save question.')
    } finally {
      setSavingQ(false)
    }
  }

  // ── Delete question ─────────────────────────────────────────────────────────
  const handleDeleteQuestion = async (quizId, questionId) => {
    try {
      await deleteQuestion(quizId, questionId)
      setQuizzes(prev => prev.map(q =>
        String(q.id) === String(quizId)
          ? {
              ...q,
              questions:     (q.questions || []).filter(qq => String(qq.id) !== String(questionId)),
              questionCount: Math.max(0, (q.questionCount || 1) - 1),
            }
          : q
      ))
      toast.success('Question deleted.')
    } catch (e) {
      toast.error(e.message || 'Could not delete question.')
    }
  }

  const closeQModal = () => { setQModal(false); setEditingQ(null); setQForm(makeEmptyQForm()) }

  return (
    <DashboardShell title="Quizzes" requiredRole="lecturer">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/lecturer/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to course
          </Link>
          <button className={styles.addBtn} onClick={() => { setQuizForm(EMPTY_QUIZ_FORM); setQuizModal(true) }}>
            <RiAddLine size={15} /> New Quiz
          </button>
        </div>

        {loading ? (
          <SkeletonCard count={3} />
        ) : quizzes.length === 0 ? (
          <EmptyState
            icon={RiQuestionLine}
            title="No quizzes yet"
            desc="Create your first quiz to assess your students."
            actionLabel="New Quiz"
            onAction={() => { setQuizForm(EMPTY_QUIZ_FORM); setQuizModal(true) }}
          />
        ) : (
          <div className={styles.quizList}>
            {quizzes.map(quiz => {
              const qCount = quiz.questions?.length ?? quiz.questionCount ?? 0
              return (
                <div key={quiz.id} className={styles.quizCard}>
                  {/* Header */}
                  <div className={styles.quizHeader} onClick={() => toggleExpand(quiz)}>
                    <div className={styles.quizInfo}>
                      <div className={styles.quizTitle}>{quiz.title}</div>
                      <div className={styles.quizMeta}>
                        {quiz.timeLimitMins && (
                          <span className={styles.metaChip}><RiTimeLine size={11} /> {quiz.timeLimitMins} min</span>
                        )}
                        <span className={styles.metaChip}>{qCount} Q</span>
                        <span className={styles.metaChip}>Pass: {quiz.passMark}%</span>
                        <span className={styles.metaChip}>{quiz.maxAttempts} attempt{quiz.maxAttempts !== 1 ? 's' : ''}</span>
                        <span className={styles.metaChip}>{quiz.type}</span>
                      </div>
                    </div>

                    <div className={styles.quizActions} onClick={e => e.stopPropagation()}>
                      <button
                        className={`${styles.publishBtn} ${quiz.isPublished ? styles.publishedBtn : ''}`}
                        onClick={() => handleTogglePublish(quiz)}
                        disabled={toggling[quiz.id]}
                        title={quiz.isPublished ? 'Click to unpublish' : 'Click to publish'}
                      >
                        {quiz.isPublished ? <RiEyeLine size={13} /> : <RiEyeOffLine size={13} />}
                        {toggling[quiz.id] ? '…' : quiz.isPublished ? 'Published' : 'Draft'}
                      </button>
                      <button
                        className={styles.iconBtn}
                        onClick={() => setDeletingQuiz(quiz)}
                        title="Delete quiz"
                      >
                        <RiDeleteBinLine size={14} />
                      </button>
                    </div>

                    <RiArrowDownSLine
                      size={18}
                      className={`${styles.chevron} ${expanded[quiz.id] ? styles.chevronOpen : ''}`}
                    />
                  </div>

                  {/* Expanded body with questions */}
                  {expanded[quiz.id] && (
                    <div className={styles.expandedBody}>
                      <div className={styles.expandedToolbar}>
                        <span className={styles.sectionLabel}>Questions ({qCount})</span>
                        <button className={styles.addQBtn} onClick={() => openAddQuestion(quiz.id)}>
                          <RiAddLine size={13} /> Add Question
                        </button>
                      </div>

                      {!quiz.questions?.length ? (
                        <div className={styles.noQuestions}>
                          No questions yet — click "Add Question" to get started.
                        </div>
                      ) : (
                        quiz.questions.map((q, qi) => (
                          <div key={q.id || qi} className={styles.questionItem}>
                            <div className={styles.questionItemHeader}>
                              <span className={styles.qNum}>{qi + 1}</span>
                              <span className={styles.qText}>{q.text}</span>
                              <span className={styles.qTypePill}>{q.type}</span>
                              <span className={styles.qMark}>{q.marks} mk</span>
                              {/* EDIT BUTTON */}
                              <button
                                className={styles.editQBtn || styles.iconBtn}
                                onClick={() => openEditQuestion(quiz.id, q)}
                                title="Edit question"
                                style={{ color: 'var(--primary)', marginRight: 4 }}
                              >
                                <RiEditLine size={13} />
                              </button>
                              <button
                                className={styles.delQBtn}
                                onClick={() => handleDeleteQuestion(quiz.id, q.id)}
                                title="Delete question"
                              >
                                <RiDeleteBinLine size={13} />
                              </button>
                            </div>
                            {q.options?.length > 0 && (
                              <div className={styles.optPreview}>
                                {q.options.map((opt, oi) => (
                                  <span
                                    key={opt.id || oi}
                                    className={`${styles.optPreviewItem} ${opt.isCorrect ? styles.optPreviewCorrect : ''}`}
                                  >
                                    {opt.isCorrect && <RiCheckboxCircleLine size={11} />}
                                    {opt.body}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(q.type === 'short_answer' || q.type === 'essay') && (
                              <div className={styles.optPreview}>
                                <span className={styles.optPreviewItem} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                  {q.type === 'essay' ? 'Manual grading (essay)' : 'Text response (short answer)'}
                                </span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create Quiz Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={quizModalOpen}
        onClose={() => { setQuizModal(false); setQuizForm(EMPTY_QUIZ_FORM) }}
        title="Create New Quiz"
      >
        <div className={modalStyles.body}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Title *</label>
            <input
              className={modalStyles.input}
              placeholder="e.g. Week 3 Assessment"
              value={quizForm.title}
              onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Description</label>
            <textarea
              className={modalStyles.textarea}
              placeholder="Instructions for students…"
              rows={2}
              value={quizForm.description}
              onChange={e => setQuizForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Quiz Type</label>
              <select className={modalStyles.select} value={quizForm.type} onChange={e => setQuizForm(f => ({ ...f, type: e.target.value }))}>
                <option value="practice">Practice (ungraded)</option>
                <option value="graded">Graded</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Time Limit (minutes)</label>
              <input className={modalStyles.input} type="number" min="1" placeholder="No limit" value={quizForm.timeLimitMins} onChange={e => setQuizForm(f => ({ ...f, timeLimitMins: e.target.value }))} />
            </div>
          </div>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Attempts Allowed</label>
              <input className={modalStyles.input} type="number" min="1" value={quizForm.maxAttempts} onChange={e => setQuizForm(f => ({ ...f, maxAttempts: e.target.value }))} />
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Pass Mark (%)</label>
              <input className={modalStyles.input} type="number" min="0" max="100" value={quizForm.passMark} onChange={e => setQuizForm(f => ({ ...f, passMark: e.target.value }))} />
            </div>
          </div>
          <div className={modalStyles.checkRow}>
            <label className={modalStyles.checkLabel}>
              <input type="checkbox" checked={quizForm.randomizeQ} onChange={e => setQuizForm(f => ({ ...f, randomizeQ: e.target.checked }))} />
              Randomise question order
            </label>
            <label className={modalStyles.checkLabel}>
              <input type="checkbox" checked={quizForm.randomizeA} onChange={e => setQuizForm(f => ({ ...f, randomizeA: e.target.checked }))} />
              Randomise answer options
            </label>
            <label className={modalStyles.checkLabel}>
              <input type="checkbox" checked={quizForm.showResults} onChange={e => setQuizForm(f => ({ ...f, showResults: e.target.checked }))} />
              Show results to students after submission
            </label>
          </div>
        </div>
        <div className={modalStyles.footer}>
          <button className={modalStyles.cancelBtn} onClick={() => setQuizModal(false)}>Cancel</button>
          <button className={modalStyles.saveBtn} onClick={handleCreateQuiz} disabled={savingQuiz}>
            {savingQuiz ? 'Creating…' : 'Create Quiz'}
          </button>
        </div>
      </Modal>

      {/* ── Add / Edit Question Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={qModalOpen}
        onClose={closeQModal}
        title={editingQ ? 'Edit Question' : 'Add Question'}
      >
        <div className={modalStyles.body}>
          <div className={modalStyles.row}>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Question Type</label>
              <select className={modalStyles.select} value={qForm.type} onChange={e => handleQTypeChange(e.target.value)}>
                {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Marks</label>
              <input className={modalStyles.input} type="number" min="1" value={qForm.marks} onChange={e => setQForm(f => ({ ...f, marks: e.target.value }))} />
            </div>
          </div>

          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Question Text *</label>
            <textarea
              className={modalStyles.textarea}
              placeholder="Enter your question here…"
              rows={3}
              value={qForm.text}
              onChange={e => setQForm(f => ({ ...f, text: e.target.value }))}
            />
          </div>

          {/* Options for MCQ / multi_select / true_false */}
          {['mcq', 'multi_select', 'true_false'].includes(qForm.type) && (
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>
                {qForm.type === 'multi_select'
                  ? 'Options — click to toggle correct answers'
                  : 'Options — click the letter to mark correct answer'}
              </label>
              {qForm.options.map((opt, i) => (
                <div key={i} className={styles.optionRow}>
                  <button
                    type="button"
                    className={`${styles.optionLetterBtn} ${
                      qForm.type === 'multi_select'
                        ? (opt.isCorrect ? styles.optionLetterCorrect : '')
                        : (qForm.correctIndex === i ? styles.optionLetterCorrect : '')
                    }`}
                    onClick={() => qForm.type === 'multi_select' ? toggleMultiCorrect(i) : setCorrectIndex(i)}
                  >
                    {qForm.type === 'multi_select' ? (opt.isCorrect ? '✓' : LETTERS[i]) : LETTERS[i]}
                  </button>
                  <input
                    className={`${modalStyles.input} ${styles.optionInput}`}
                    placeholder={`Option ${LETTERS[i]}`}
                    value={opt.body}
                    onChange={e => setOptionBody(i, e.target.value)}
                    disabled={qForm.type === 'true_false'}
                  />
                </div>
              ))}
              {qForm.type !== 'true_false' && qForm.options.length < 6 && (
                <button
                  type="button"
                  className={styles.addOptionBtn}
                  onClick={() => setQForm(f => ({ ...f, options: [...f.options, { body: '', isCorrect: false }] }))}
                >
                  + Add option
                </button>
              )}
            </div>
          )}

          {(qForm.type === 'short_answer' || qForm.type === 'essay') && (
            <div className={modalStyles.notice}>
              {qForm.type === 'essay'
                ? '📝 Essay questions are manually graded by you after students submit.'
                : '✏️ Short answer questions are manually graded — students type a text response.'}
            </div>
          )}

          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Explanation (shown after submission if results are visible)</label>
            <input
              className={modalStyles.input}
              placeholder="Why is this the correct answer? (optional)"
              value={qForm.explanation}
              onChange={e => setQForm(f => ({ ...f, explanation: e.target.value }))}
            />
          </div>
        </div>
        <div className={modalStyles.footer}>
          <button className={modalStyles.cancelBtn} onClick={closeQModal}>Cancel</button>
          <button className={modalStyles.saveBtn} onClick={handleSaveQuestion} disabled={savingQ}>
            {savingQ
              ? (editingQ ? 'Saving…' : 'Adding…')
              : (editingQ ? 'Save Changes' : 'Add Question')}
          </button>
        </div>
      </Modal>

      {/* ── Delete Quiz Confirm ──────────────────────────────────────────────── */}
      <Modal
        isOpen={!!deletingQuiz}
        onClose={() => setDeletingQuiz(null)}
        title="Delete Quiz"
      >
        <div className={modalStyles.body}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Are you sure you want to delete <strong>"{deletingQuiz?.title}"</strong>?
            This will permanently remove all questions and student attempt records.
          </p>
        </div>
        <div className={modalStyles.footer}>
          <button className={modalStyles.cancelBtn} onClick={() => setDeletingQuiz(null)}>Cancel</button>
          <button className={modalStyles.deleteBtn} onClick={() => handleDeleteQuiz(deletingQuiz)}>
            Yes, Delete Quiz
          </button>
        </div>
      </Modal>
    </DashboardShell>
  )
}