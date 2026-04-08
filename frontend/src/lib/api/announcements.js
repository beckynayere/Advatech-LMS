// DESTINATION: src/lib/api/announcements.js

import { apiGet, apiPostIdempotent } from './client'

// ─── Normaliser ───────────────────────────────────────────────────────────────
// Engine Announcement: { id, title, body, courseId, institutionId, createdBy, publishAt, createdAt }
function normalizeAnnouncement(a) {
  return {
    id:           String(a.id),
    courseId:     a.courseId ? String(a.courseId) : null,
    subject:      a.title || a.subject || 'Announcement',
    message:      a.body || a.message || '',
    lecturerName: a.createdBy?.name || a.lecturerName || '',
    createdAt:    a.createdAt || a.publishAt || new Date().toISOString(),
  }
}

// ─── GET /api/v1/announcements ────────────────────────────────────────────────
// If courseId is provided, filter to that course.
// The engine requires a courseId query param to return course announcements.
// Without it, only institution-wide (courseId=null) announcements are returned.
export async function getAnnouncements(courseId) {
  try {
    // Always pass courseId when we have one — this is required to get course announcements
    const endpoint = courseId && courseId !== 'null' && courseId !== '0'
      ? `/api/v1/announcements?courseId=${courseId}`
      : '/api/v1/announcements'
    const data = await apiGet(endpoint)
    return (data.data || []).map(normalizeAnnouncement)
  } catch {
    return []
  }
}

// ─── POST /api/v1/announcements ───────────────────────────────────────────────
// payload: { subject|title, message|body, courseId? }
export async function createAnnouncement(payload) {
  // courseId must be a valid positive integer or null — never 0 or empty string
  const rawCourseId = payload.courseId
  const courseIdNum = rawCourseId && String(rawCourseId) !== '0' && String(rawCourseId) !== ''
    ? Number(rawCourseId)
    : null

  const data = await apiPostIdempotent('/api/v1/announcements', {
    title:    payload.subject || payload.title || '',
    body:     payload.message || payload.body || '',
    courseId: courseIdNum,
  })
  return normalizeAnnouncement(data.announcement || data.data)
}