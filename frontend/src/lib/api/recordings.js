// DESTINATION: src/lib/api/recordings.js
import { apiGet } from './client'

// ── Formatters ────────────────────────────────────────────────────────────────
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function enrich(r, session = null) {
  return {
    ...r,
    id:               String(r.id),
    sessionId:        String(r.sessionId || session?.id || ''),
    courseTitle:      r.courseTitle  || session?.courseTitle  || '',
    courseCode:       r.courseCode   || session?.courseCode   || '',
    courseId:         r.courseId     || session?.courseId     || '',
    recordedAt:       r.availableAt  || r.createdAt || r.recordedAt || null,
    durationFormatted: formatDuration(r.duration || 0),
    fileSizeFormatted: formatSize(r.fileSize || r.size || 0),
  }
}

// ── Get all recordings for a course ──────────────────────────────────────────
// Strategy:
//   1. GET /api/v1/schedule/online-classes?courseId=<id>  → sessions[]
//   2. For each session → GET /api/v1/schedule/online-classes/:sessionId/recordings
export async function getRecordings(courseId) {
  try {
    const url = courseId
      ? `/api/v1/schedule/online-classes?courseId=${courseId}`
      : `/api/v1/schedule/online-classes`
    const sessionsData = await apiGet(url)
    const sessions = sessionsData.data || []
    if (sessions.length === 0) return []

    const allRecordings = []
    await Promise.allSettled(
      sessions.map(async (session) => {
        try {
          const recData = await apiGet(
            `/api/v1/schedule/online-classes/${session.id}/recordings`
          )
          const recs = recData.data || []
          recs.forEach(r => allRecordings.push(enrich(r, session)))
        } catch {
          // Skip sessions where recording fetch fails
        }
      })
    )
    return allRecordings
  } catch {
    return []
  }
}

// ── Get recordings for a specific session ─────────────────────────────────────
// GET /api/v1/schedule/online-classes/:sessionId/recordings
export async function getRecordingsBySession(sessionId) {
  const data = await apiGet(
    `/api/v1/schedule/online-classes/${sessionId}/recordings`
  )
  return (data.data || []).map(r => enrich(r, { id: sessionId }))
}

// ── Get a single recording by ID ──────────────────────────────────────────────
// FIX: The engine has NO standalone GET /api/v1/recordings/:id endpoint.
// The correct approach is to fetch all recordings for the session and filter.
// Call getRecordingsBySession(sessionId) and filter by id on the client.
// This function is kept for backward compatibility but requires sessionId.
export async function getRecording(id, sessionId) {
  if (!sessionId) {
    console.warn('getRecording: sessionId is required. Returning null.')
    return null
  }
  const recs = await getRecordingsBySession(sessionId)
  return recs.find(r => String(r.id) === String(id)) || null
}