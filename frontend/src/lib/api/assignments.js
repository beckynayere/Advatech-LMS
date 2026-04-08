// DESTINATION: src/lib/api/assignments.js

import { apiGet, apiPost, apiPut, apiDelete, apiPostIdempotent } from './client'
 
// ─── Normalisers ──────────────────────────────────────────────────────────────
 
function normalizeAssignment(a) {
  return {
    id:          String(a.id),
    courseId:    String(a.courseId || a.course?.id || ''),
    title:       a.title || a.name || '',
    description: a.description || a.instructions || a.intro || '',
    dueDate:     a.dueDate
      ? new Date(a.dueDate).toISOString().split('T')[0]
      : (a.duedate ? new Date(a.duedate * 1000).toISOString().split('T')[0] : ''),
    totalMarks:  a.maxMarks ?? a.totalMarks ?? a.grade ?? 100,
    type:        'assignment',
    isPublished: a.isPublished ?? false,
    allowLateSubmit: a.allowLateSubmit ?? false,
    maxAttempts: a.maxAttempts ?? 1,
    submissions:  (a.submissions || []).map(normalizeSubmission),
    mySubmission: a.mySubmission ? normalizeSubmission(a.mySubmission) : null,
    _subsLoaded:  (a.submissions || []).length > 0 || a.mySubmission != null,
  }
}
 
export function normalizeSubmission(s) {
  return {
    id:           String(s.id),
    studentId:    String(s.studentId || s.userId || ''),
    studentName:  s.studentName || s.student?.name || `Student ${s.studentId || s.userId}`,
    studentEmail: s.student?.email || '',
    submittedAt:  s.submittedAt || s.createdAt || null,
    content:      s.textResponse || s.content || s.comment || '',
    fileKeys:     s.fileKeys || [],
    // FIX: normalise both field names — engine writes `marks`, frontend reads `grade`
    grade:        s.grade ?? s.marks ?? null,
    feedback:     s.feedback || '',
    status:       s.status || (s.marks != null || s.grade != null ? 'graded' : 'submitted'),
    gradedAt:     s.gradedAt || null,
    attempt:      s.attempt ?? 1,
  }
}
 
// ─── GET /api/v1/assignments?courseId=X ───────────────────────────────────────
export async function getAssignments(courseId) {
  try {
    const data = await apiGet(`/api/v1/assignments?courseId=${courseId}&limit=100`)
    return (data.data || []).map(normalizeAssignment)
  } catch {
    return []
  }
}
 
// ─── GET /api/v1/assignments/:id ──────────────────────────────────────────────
export async function getAssignment(courseId, assignmentId) {
  const data = await apiGet(`/api/v1/assignments/${assignmentId}`)
  return normalizeAssignment(data.assignment || data.data)
}
 
// ─── GET /api/v1/assignments/:id/submissions ──────────────────────────────────
export async function getSubmissionsForAssignment(assignmentId) {
  try {
    const data = await apiGet(`/api/v1/assignments/${assignmentId}/submissions?limit=200`)
    return (data.data || data.submissions || []).map(normalizeSubmission)
  } catch {
    return []
  }
}
 
// ─── GET /api/v1/assignments/:id/submissions/my ───────────────────────────────
export async function getMySubmissions(assignmentId) {
  try {
    const data = await apiGet(`/api/v1/assignments/${assignmentId}/submissions/my`)
    return (data.data || []).map(normalizeSubmission)
  } catch {
    return []
  }
}
 
// ─── POST /api/v1/assignments ─────────────────────────────────────────────────
export async function createAssignment(courseId, payload) {
  const data = await apiPost('/api/v1/assignments', {
    title:           payload.title,
    description:     payload.description || '',
    instructions:    payload.description || '',
    courseId:        Number(courseId),
    dueDate:         payload.dueDate
      ? new Date(payload.dueDate + 'T23:59:59').toISOString()
      : new Date(Date.now() + 7 * 86_400_000).toISOString(),
    maxMarks:        Number(payload.totalMarks) || 100,
    allowLateSubmit: payload.allowLateSubmit ?? false,
    latePenaltyPct:  payload.latePenaltyPct ?? 0,
    maxAttempts:     payload.maxAttempts ?? 1,
    isPublished:     payload.isPublished ?? true,
  })
  return normalizeAssignment(data.assignment || data.data)
}
 
// ─── PUT /api/v1/assignments/:id ──────────────────────────────────────────────
export async function updateAssignment(assignmentId, payload) {
  const body = {}
  if (payload.title       !== undefined) body.title           = payload.title
  if (payload.description !== undefined) body.description     = payload.description
  if (payload.description !== undefined) body.instructions    = payload.description
  if (payload.dueDate     !== undefined) body.dueDate         = payload.dueDate
    ? new Date(payload.dueDate + 'T23:59:59').toISOString()
    : undefined
  if (payload.totalMarks  !== undefined) body.maxMarks        = Number(payload.totalMarks)
  if (payload.isPublished !== undefined) body.isPublished     = payload.isPublished
  if (payload.allowLateSubmit !== undefined) body.allowLateSubmit = payload.allowLateSubmit
 
  const data = await apiPut(`/api/v1/assignments/${assignmentId}`, body)
  return normalizeAssignment(data.assignment || data.data)
}
 
// ─── DELETE /api/v1/assignments/:id ───────────────────────────────────────────
export async function deleteAssignment(assignmentId) {
  return apiDelete(`/api/v1/assignments/${assignmentId}`)
}
 
// ─── POST /api/v1/assignments/:id/submissions ─────────────────────────────────
export async function submitAssignment(assignmentId, payload) {
  if (payload.file) {
    const formData = new FormData()
    formData.append('files', payload.file)
    if (payload.comment) {
      formData.append('textResponse', payload.comment)
    }
    const data = await apiPost(`/api/v1/assignments/${assignmentId}/submissions`, formData)
    return normalizeSubmission(data.submission || data.data)
  }
 
  const data = await apiPostIdempotent(`/api/v1/assignments/${assignmentId}/submissions`, {
    textResponse: payload.comment || payload.text || '',
  })
  return normalizeSubmission(data.submission || data.data)
}
 
// ─── PUT /api/v1/assignments/:aId/submissions/:sId/grade ──────────────────────
// FIX: engine route reads body.grade (z.number()) — confirmed in assignments.routes.ts.
// normalizeSubmission reads s.grade ?? s.marks ?? null, so both field names are handled
// on read. On write, we send `grade` which matches the engine's gradeSchema exactly.
export async function gradeSubmission(assignmentId, submissionId, payload) {
  const data = await apiPut(
    `/api/v1/assignments/${assignmentId}/submissions/${submissionId}/grade`,
    {
      grade:    Number(payload.grade),
      feedback: payload.feedback || null,
    }
  )
  return normalizeSubmission(data.submission || data.data || {})
}
 
// ─── GET submission download URLs ─────────────────────────────────────────────
export async function getSubmissionDownloadUrls(assignmentId, submissionId) {
  try {
    const data = await apiGet(
      `/api/v1/assignments/${assignmentId}/submissions/${submissionId}/download-files`
    )
    return data.urls || data.data || []
  } catch {
    return []
  }
}