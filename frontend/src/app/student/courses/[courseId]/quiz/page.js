// DESTINATION: src/app/student/courses/[courseId]/quiz/page.js
'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine, RiTimeLine, RiQuestionLine,
  RiCheckboxCircleLine, RiCloseCircleLine, RiAlarmWarningLine,
  RiFileTextLine, RiEditLine,
  RiArrowLeftSLine, RiArrowRightSLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { getQuizzes, startQuizAttempt, submitQuizAttempt, getAttemptResult } from '@/lib/api/quizzes'
import { getModules, markProgress } from '@/lib/api/modules'
import { getNextAndPrevious } from '@/lib/courseNavigation'
import styles from './quiz.module.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

function fmtTime(seconds) {
  if (seconds == null || seconds < 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function QuizTypeBadge({ type }) {
  const map = { practice: 'gray', graded: 'blue', exam: 'red' }
  return <Badge label={type || 'practice'} color={map[type] || 'gray'} size="sm" />
}

// ── Quiz List ─────────────────────────────────────────────────────────────────
function QuizList({ quizzes, loading, onStart }) {
  if (loading) return <SkeletonCard count={3} />
  if (quizzes.length === 0) {
    return (
      <EmptyState
        icon={RiQuestionLine}
        title="No quizzes yet"
        desc="Your lecturer hasn't posted any quizzes for this course."
      />
    )
  }
  return (
    <div className={styles.quizList}>
      {quizzes.map(quiz => (
        <div key={quiz.id} className={styles.quizCard}>
          <div className={styles.quizCardLeft}>
            <div className={styles.quizTitle}>{quiz.title}</div>
            {quiz.description && <div className={styles.quizDesc}>{quiz.description}</div>}
            <div className={styles.quizMeta}>
              {quiz.timeLimitMins && (
                <span className={styles.metaChip}>
                  <RiTimeLine size={12} /> {quiz.timeLimitMins} min
                </span>
              )}
              <span className={styles.metaChip}>
                <RiQuestionLine size={12} /> {quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}
              </span>
              {quiz.passMark > 0 && (
                <span className={styles.metaChip}>Pass: {quiz.passMark}%</span>
              )}
              {quiz.maxAttempts > 1 && (
                <span className={styles.metaChip}>{quiz.maxAttempts} attempts allowed</span>
              )}
              {quiz.closeAt && (
                <span className={styles.metaChip}>
                  Closes: {new Date(quiz.closeAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
          <div className={styles.quizCardRight}>
            <QuizTypeBadge type={quiz.type} />
            <button
              className={styles.startBtn}
              onClick={() => onStart(quiz)}
              disabled={quiz.closeAt && new Date() > new Date(quiz.closeAt)}
            >
              Start Quiz
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Active Quiz ───────────────────────────────────────────────────────────────
function ActiveQuiz({ quizMeta, attemptMeta, questions, onDone }) {
  const toast = useToast()
  const [answers,     setAnswers]     = useState({})
  const [currentIdx,  setCurrentIdx]  = useState(0)
  const [submitting,  setSubmitting]  = useState(false)
  const [result,      setResult]      = useState(null)
  const [timeLeft,    setTimeLeft]    = useState(() => {
    if (!quizMeta.timeLimitMins) return null
    if (attemptMeta.endsAt) {
      const remaining = Math.floor((new Date(attemptMeta.endsAt) - Date.now()) / 1000)
      return remaining > 0 ? remaining : 0
    }
    return quizMeta.timeLimitMins * 60
  })
  const timerRef = useRef(null)

  // FIX: Use a ref to always access the latest answers inside the timer callback,
  // avoiding the stale closure bug where auto-submit fired with empty answers.
  const answersRef = useRef(answers)
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const submittingRef = useRef(false)

  const handleSubmit = useCallback(async (auto = false) => {
    if (submittingRef.current) return
    submittingRef.current = true
    clearInterval(timerRef.current)
    setSubmitting(true)
    // FIX: read from ref to get current answers, not stale closure value
    const currentAnswers = answersRef.current
    try {
      const res = await submitQuizAttempt(quizMeta.id, attemptMeta.id, currentAnswers)
      if (quizMeta.showResults) {
        try {
          const detail = await getAttemptResult(quizMeta.id, attemptMeta.id)
          setResult(detail)
        } catch {
          setResult({ score: res.score, passed: res.passed })
        }
      } else {
        onDone()
      }
    } catch (e) {
      toast.error(e.message || 'Submission failed.')
      setSubmitting(false)
      submittingRef.current = false
    }
  }, [quizMeta, attemptMeta, onDone, toast])

  // FIX: handleSubmit is stable via useCallback; timerRef closure is safe.
  useEffect(() => {
    if (timeLeft == null) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          handleSubmit(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [handleSubmit]) // depend on handleSubmit (stable ref via useCallback)

  const setMcqAnswer       = (qid, optId) => setAnswers(p => ({ ...p, [qid]: { type: 'mcq', value: String(optId) } }))
  const setTrueFalse       = (qid, optId) => setAnswers(p => ({ ...p, [qid]: { type: 'true_false', value: String(optId) } }))
  const toggleMultiSelect  = (qid, optId) => {
    setAnswers(p => {
      const cur = p[qid]?.value || []
      const strId = String(optId)
      const next  = cur.includes(strId) ? cur.filter(x => x !== strId) : [...cur, strId]
      return { ...p, [qid]: { type: 'multi_select', value: next } }
    })
  }
  const setTextAnswer = (qid, text, type) => setAnswers(p => ({ ...p, [qid]: { type, value: text } }))

  if (result) {
    return (
      <div className={styles.resultCard}>
        <div className={styles.resultIcon}>
          {result.passed
            ? <RiCheckboxCircleLine size={48} style={{ color: 'var(--success)' }} />
            : <RiCloseCircleLine   size={48} style={{ color: 'var(--danger)' }} />}
        </div>
        <div className={styles.resultTitle}>{result.passed ? 'Passed!' : 'Not passed'}</div>
        <div className={styles.resultScore}>
          {result.score != null ? `${Math.round(result.score)}%` : '—'}
        </div>
        {result.passMark != null && (
          <div className={styles.resultPassMark}>Pass mark: {result.passMark}%</div>
        )}
        <button className={styles.doneBtn} onClick={onDone}>Back to Quizzes</button>
      </div>
    )
  }

  const q             = questions[currentIdx]
  const answeredCount = Object.keys(answers).length
  const allAnswered   = answeredCount === questions.length

  const isAnswered = (qid) => {
    const a = answers[qid]
    if (!a) return false
    return Array.isArray(a.value) ? a.value.length > 0 : String(a.value || '').trim().length > 0
  }

  return (
    <div className={styles.activeWrap}>
      {/* Top bar */}
      <div className={styles.activeTopBar}>
        <div className={styles.activeTitle}>{quizMeta.title}</div>
        <div className={styles.activeTopRight}>
          <span className={styles.qCounter}>{currentIdx + 1} / {questions.length}</span>
          {timeLeft != null && (
            <span className={`${styles.timer} ${timeLeft < 300 ? styles.timerWarn : ''}`}>
              <RiTimeLine size={13} /> {fmtTime(timeLeft)}
            </span>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
      </div>
      {/* Dot nav */}
      <div className={styles.dotNav}>
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            className={`${styles.dot} ${i === currentIdx ? styles.dotActive : ''} ${isAnswered(qq.id) ? styles.dotDone : ''}`}
            onClick={() => setCurrentIdx(i)}
            title={`Question ${i + 1}`}
          />
        ))}
      </div>
      {/* Question card */}
      <div className={styles.questionCard}>
        <div className={styles.questionMeta}>
          <span className={styles.qTypeLabel}>
            {q.type === 'mcq'          ? 'Single choice'
            : q.type === 'multi_select' ? 'Multiple choice'
            : q.type === 'true_false'   ? 'True / False'
            : q.type === 'short_answer' ? 'Short answer'
            : 'Essay'}
          </span>
          <span className={styles.qMarks}>{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
        </div>
        <div className={styles.questionText}>{q.text}</div>

        {/* MCQ */}
        {q.type === 'mcq' && (
          <div className={styles.options}>
            {q.options.map((opt, oi) => {
              const selected = answers[q.id]?.value === String(opt.id)
              return (
                <div key={opt.id} className={`${styles.option} ${selected ? styles.optSelected : ''}`}
                  onClick={() => setMcqAnswer(q.id, opt.id)} role="radio" aria-checked={selected} tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setMcqAnswer(q.id, opt.id)}>
                  <span className={`${styles.optLetter} ${selected ? styles.optLetterSel : ''}`}>{LETTERS[oi]}</span>
                  <span className={styles.optBody}>{opt.body}</span>
                  {selected && <RiCheckboxCircleLine size={16} className={styles.optCheck} />}
                </div>
              )
            })}
          </div>
        )}

        {/* True/False */}
        {q.type === 'true_false' && (
          <div className={styles.options}>
            {q.options.map((opt, oi) => {
              const selected = answers[q.id]?.value === String(opt.id)
              return (
                <div key={opt.id} className={`${styles.option} ${selected ? styles.optSelected : ''}`}
                  onClick={() => setTrueFalse(q.id, opt.id)} role="radio" aria-checked={selected} tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setTrueFalse(q.id, opt.id)}>
                  <span className={`${styles.optLetter} ${selected ? styles.optLetterSel : ''}`}>{LETTERS[oi]}</span>
                  <span className={styles.optBody}>{opt.body}</span>
                  {selected && <RiCheckboxCircleLine size={16} className={styles.optCheck} />}
                </div>
              )
            })}
          </div>
        )}

        {/* Multi-select */}
        {q.type === 'multi_select' && (
          <>
            <div className={styles.multiHint}>Select all that apply</div>
            <div className={styles.options}>
              {q.options.map((opt, oi) => {
                const selected = (answers[q.id]?.value || []).includes(String(opt.id))
                return (
                  <div key={opt.id} className={`${styles.option} ${selected ? styles.optSelected : ''}`}
                    onClick={() => toggleMultiSelect(q.id, opt.id)} role="checkbox" aria-checked={selected} tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && toggleMultiSelect(q.id, opt.id)}>
                    <span className={`${styles.optLetter} ${selected ? styles.optLetterSel : ''}`}>{LETTERS[oi]}</span>
                    <span className={styles.optBody}>{opt.body}</span>
                    {selected && <RiCheckboxCircleLine size={16} className={styles.optCheck} />}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Short answer */}
        {q.type === 'short_answer' && (
          <textarea
            className={styles.textAnswer}
            rows={3}
            placeholder="Type your answer…"
            value={answers[q.id]?.value || ''}
            onChange={e => setTextAnswer(q.id, e.target.value, 'short_answer')}
          />
        )}

        {/* Essay */}
        {q.type === 'essay' && (
          <textarea
            className={styles.textAnswer}
            rows={6}
            placeholder="Type your essay response…"
            value={answers[q.id]?.value || ''}
            onChange={e => setTextAnswer(q.id, e.target.value, 'essay')}
          />
        )}
      </div>

      {/* Navigation */}
      <div className={styles.navBar}>
        <button className={styles.navBtn} onClick={() => setCurrentIdx(p => p - 1)} disabled={currentIdx === 0}>
          ← Previous
        </button>
        <div className={styles.navCenter}>
          <span className={styles.answeredCount}>{answeredCount}/{questions.length} answered</span>
        </div>
        {currentIdx < questions.length - 1 ? (
          <button className={styles.navBtn} onClick={() => setCurrentIdx(p => p + 1)}>Next →</button>
        ) : (
          <button className={styles.submitBtn} disabled={submitting} onClick={() => handleSubmit(false)}>
            {submitting ? 'Submitting…' : `Submit Quiz${!allAnswered ? ` (${questions.length - answeredCount} unanswered)` : ''}`}
          </button>
        )}
      </div>
      {currentIdx === questions.length - 1 && !allAnswered && (
        <div className={styles.unansweredWarn}>
          <RiAlarmWarningLine size={14} />
          {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} unanswered — you can still submit or go back.
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
function QuizInner() {
  const { courseId } = useParams()
  const searchParams = useSearchParams()
  const toast        = useToast()

  const [quizzes,       setQuizzes]       = useState([])
  const [modules,       setModules]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [starting,      setStarting]      = useState(false)
  const [activeSession, setSession]       = useState(null)
  const [activeQuizId,  setActiveQuizId]  = useState(null)

  useEffect(() => {
    Promise.all([getQuizzes(courseId), getModules(courseId)])
      .then(([qzs, mods]) => {
        setQuizzes(qzs)
        setModules(mods)

        const startId = searchParams.get('start')
        if (startId) {
          const target = qzs.find(q => String(q.id) === String(startId))
          if (target) handleStart(target)
        }
      })
      .finally(() => setLoading(false))
  }, [courseId])

  const handleStart = async (quiz) => {
    if (starting) return
    setStarting(true)
    setActiveQuizId(quiz.id)
    markProgress(courseId, 'quiz', quiz.id, 'viewed').catch(() => {})
    try {
      const { attempt, quiz: quizDetail, questions } = await startQuizAttempt(quiz.id)
      if (!questions?.length) {
        toast.error('This quiz has no questions yet.')
        setStarting(false)
        return
      }
      setSession({
        quizMeta:    { ...quiz, timeLimitMins: quizDetail?.timeLimitMins ?? quiz.timeLimitMins, showResults: quizDetail?.showResults ?? quiz.showResults },
        attemptMeta: attempt,
        questions,
      })
    } catch (e) {
      toast.error(e.message || 'Could not start quiz.')
    } finally {
      setStarting(false)
    }
  }

  const handleDone = () => {
    if (activeQuizId) {
      markProgress(courseId, 'quiz', activeQuizId, 'completed').catch(() => {})
    }
    setSession(null)
    getQuizzes(courseId).then(setQuizzes)
  }

  const { prev, next } = activeQuizId && !activeSession
    ? getNextAndPrevious(modules, activeQuizId, 'quiz', courseId)
    : { prev: null, next: null }

  return (
    <DashboardShell title="Quizzes" requiredRole="student">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/student/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to course
          </Link>
        </div>

        {starting && (
          <div className={styles.startingOverlay}>
            <div className={styles.startingSpinner} />
            <span>Preparing your quiz…</span>
          </div>
        )}

        {activeSession ? (
          <ActiveQuiz
            quizMeta={activeSession.quizMeta}
            attemptMeta={activeSession.attemptMeta}
            questions={activeSession.questions}
            onDone={handleDone}
          />
        ) : (
          <>
            <QuizList quizzes={quizzes} loading={loading} onStart={handleStart} />

            {activeQuizId && (prev || next) && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 24, padding: '16px 20px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', gap: 12,
              }}>
                {prev ? (
                  <Link href={prev.href} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                    <RiArrowLeftSLine size={18} />
                    <div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Previous</div>
                      <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prev.title}</div>
                    </div>
                  </Link>
                ) : <div />}
                {next ? (
                  <Link href={next.href} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Next</div>
                      <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.title}</div>
                    </div>
                    <RiArrowRightSLine size={18} />
                  </Link>
                ) : <div />}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  )
}

export default function StudentQuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizInner />
    </Suspense>
  )
}