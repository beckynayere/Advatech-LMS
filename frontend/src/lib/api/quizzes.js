// DESTINATION: src/lib/api/quizzes.js
// CHANGES FROM ORIGINAL:
//   FIX 1: startQuizAttempt now posts to /attempts/start (backend accepts both /attempts and /attempts/start)
//           — URL was already correct, backend now also listens on /attempts/start
//   FIX 1: submitQuizAttempt sends { answers } with response field (not answersMap shape)
//   FIX 4: markProgress calls are handled at the page level (quiz/page.js), not here
import { apiGet, apiPost, apiPut, apiDelete } from './client'

// ─── Normalisers ──────────────────────────────────────────────────────────────

function normalizeQuiz(q) {
  return {
    id:            String(q.id),
    courseId:      String(q.courseId || q.course?.id || ''),
    title:         q.title || '',
    description:   q.description || '',
    timeLimitMins: q.timeLimitMins ?? q.timeLimitMinutes ?? q.duration ?? null,
    maxAttempts:   q.maxAttempts ?? 1,
    passMark:      q.passMark ?? 50,
    randomizeQ:    q.randomizeQ ?? false,
    randomizeA:    q.randomizeA ?? false,
    showResults:   q.showResults ?? true,
    openAt:        q.openAt || null,
    closeAt:       q.closeAt || null,
    isPublished:   q.isPublished ?? false,
    type:          q.type || 'practice',
    questionCount: q._count?.questions ?? q.questions?.length ?? q.questionCount ?? 0,
    questions:     (q.questions || []).map(normalizeQuestion),
    createdAt:     q.createdAt || null,
  }
}

function normalizeQuestion(q) {
  const options = (q.options || []).map(o => ({
    id:        String(o.id),
    body:      o.body || '',
    isCorrect: o.isCorrect ?? false,
    sortOrder: o.sortOrder ?? 0,
  }))
  return {
    id:          String(q.id),
    type:        q.type || 'mcq',
    text:        q.body || q.text || q.questionText || '',
    options,
    marks:       q.marks ?? q.points ?? 1,
    sortOrder:   q.sortOrder ?? 0,
    explanation: q.explanation || '',
    imageKey:    q.imageKey || null,
  }
}

function normalizeAttempt(a) {
  return {
    id:          String(a.id),
    quizId:      String(a.quizId || ''),
    studentId:   String(a.studentId || a.userId || ''),
    attempt:     a.attempt ?? 1,
    startedAt:   a.startedAt || null,
    submittedAt: a.submittedAt || null,
    endsAt:      a.endsAt || null,
    status:      a.status || 'in_progress',
    score:       a.score != null ? Number(a.score) : null,
    passed:      a.passed ?? null,
  }
}

function normalizeResult(r) {
  return {
    attemptId:  r.attemptId || r.attempt?.id,
    score:      r.score != null ? Number(r.score) : null,
    passed:     r.passed ?? null,
    totalMarks: r.totalMarks ?? null,
    maxMarks:   r.maxMarks ?? null,
    passMark:   r.passMark ?? null,
    message:    r.message || '',
    breakdown:  (r.breakdown || []).map(b => ({
      questionId:     b.questionId,
      questionBody:   b.questionBody || b.questionText || '',
      questionType:   b.questionType || 'mcq',
      explanation:    b.explanation || '',
      marks:          b.marks ?? 1,
      marksAwarded:   b.marksAwarded != null ? Number(b.marksAwarded) : null,
      isCorrect:      b.isCorrect ?? null,
      response:       b.response || null,
      correctOptions: (b.correctOptions || []).map(o => ({ id: String(o.id), body: o.body || '' })),
    })),
  }
}

// ─── Quiz CRUD ────────────────────────────────────────────────────────────────

export async function getQuizzes(courseId) {
  try {
    const data = await apiGet(`/api/v1/quizzes?courseId=${courseId}`)
    return (data.data || data.quizzes || []).map(normalizeQuiz)
  } catch {
    return []
  }
}

export async function getQuiz(id) {
  const data = await apiGet(`/api/v1/quizzes/${id}`)
  return normalizeQuiz(data.quiz || data.data || data)
}

export async function createQuiz(payload) {
  const body = {
    courseId:      Number(payload.courseId),
    title:         payload.title,
    description:   payload.description || null,
    type:          payload.type || 'practice',
    timeLimitMins: payload.timeLimitMins ? Number(payload.timeLimitMins) : null,
    maxAttempts:   Number(payload.maxAttempts) || 1,
    passMark:      Number(payload.passMark) || 50,
    randomizeQ:    payload.randomizeQ ?? false,
    randomizeA:    payload.randomizeA ?? false,
    showResults:   payload.showResults ?? true,
    openAt:        payload.openAt  ? new Date(payload.openAt).toISOString()  : null,
    closeAt:       payload.closeAt ? new Date(payload.closeAt).toISOString() : null,
    isPublished:   payload.isPublished ?? false,
  }
  const data = await apiPost('/api/v1/quizzes', body)
  return normalizeQuiz(data.quiz || data.data || data)
}

export async function updateQuiz(quizId, payload) {
  const data = await apiPut(`/api/v1/quizzes/${quizId}`, payload)
  return normalizeQuiz(data.quiz || data.data || data)
}

export async function deleteQuiz(quizId) {
  return apiDelete(`/api/v1/quizzes/${quizId}`)
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function getQuestions(quizId) {
  try {
    const data = await apiGet(`/api/v1/quizzes/${quizId}/questions`)
    return (data.data || data.questions || []).map(normalizeQuestion)
  } catch {
    return []
  }
}

export async function addQuestion(quizId, payload) {
  const body = {
    type:        payload.type || 'mcq',
    body:        payload.text || payload.body,
    explanation: payload.explanation || null,
    marks:       Number(payload.marks) || 1,
    sortOrder:   payload.sortOrder ?? 0,
    options:     (payload.options || []).map((o, i) => ({
      body:      typeof o === 'string' ? o : o.body,
      isCorrect: typeof o === 'string' ? (i === payload.correctIndex) : (o.isCorrect ?? false),
      sortOrder: i,
    })),
  }
  const data = await apiPost(`/api/v1/quizzes/${quizId}/questions`, body)
  return normalizeQuestion(data.question || data.data || data)
}

export async function updateQuestion(quizId, questionId, payload) {
  const body = {
    type:        payload.type,
    body:        payload.text || payload.body,
    explanation: payload.explanation || null,
    marks:       Number(payload.marks) || 1,
    options:     payload.options ? payload.options.map((o, i) => ({
      body:      typeof o === 'string' ? o : o.body,
      isCorrect: typeof o === 'string' ? (i === payload.correctIndex) : (o.isCorrect ?? false),
      sortOrder: i,
    })) : undefined,
  }
  const data = await apiPut(`/api/v1/quizzes/${quizId}/questions/${questionId}`, body)
  return normalizeQuestion(data.question || data.data || data)
}

export async function deleteQuestion(quizId, questionId) {
  return apiDelete(`/api/v1/quizzes/${quizId}/questions/${questionId}`)
}

// ─── Attempt lifecycle ────────────────────────────────────────────────────────

/**
 * Start a new quiz attempt.
 * Backend accepts POST /quizzes/:id/attempts  AND  POST /quizzes/:id/attempts/start
 * We use /attempts/start (backend updated to handle both).
 */
export async function startQuizAttempt(quizId) {
  const data = await apiPost(`/api/v1/quizzes/${quizId}/attempts/start`, {})
  return {
    attempt:   normalizeAttempt({ ...data.attempt, endsAt: data.attempt?.endsAt }),
    quiz:      data.quiz ? normalizeQuiz({ ...data.quiz }) : null,
    questions: (data.questions || []).map(normalizeQuestion),
    resumed:   data.resumed ?? false,
  }
}

/**
 * Submit a quiz attempt with all answers.
 *
 * answersMap shape (from ActiveQuiz component):
 *   { [questionId]: { type: 'mcq'|'multi_select'|'true_false'|'short_answer'|'essay', value: string | string[] } }
 *
 * Engine expects:
 *   { answers: [{ questionId: number, response: string | null }] }
 *     where response is:
 *       mcq / true_false  → String(selectedOptionId)
 *       multi_select      → "id1,id2,id3"  (comma-separated, sorted ascending)
 *       short_answer/essay → user's typed text
 */
export async function submitQuizAttempt(quizId, attemptId, answersMap) {
  const answers = Object.entries(answersMap).map(([questionId, ans]) => {
    let response = null
    if (ans.type === 'multi_select' && Array.isArray(ans.value)) {
      // Sort numerically so backend comparison is deterministic
      response = [...ans.value]
        .map(Number)
        .sort((a, b) => a - b)
        .join(',')
    } else if (ans.value != null) {
      response = String(ans.value)
    }
    return { questionId: Number(questionId), response }
  })

  const data = await apiPost(
    `/api/v1/quizzes/${quizId}/attempts/${attemptId}/submit`,
    { answers }
  )
  return normalizeResult(data.result || data)
}

/**
 * Fetch the result of a submitted attempt (called after submit when showResults=true).
 */
export async function getAttemptResult(quizId, attemptId) {
  const data = await apiGet(`/api/v1/quizzes/${quizId}/attempts/${attemptId}/result`)
  return normalizeResult(data.result || data)
}

export async function getQuizAttempts(quizId) {
  try {
    const data = await apiGet(`/api/v1/quizzes/${quizId}/attempts`)
    return (data.data || []).map(normalizeAttempt)
  } catch {
    return []
  }
}