// DESTINATION: src/lib/api/timetable.js

import { mockTimetable } from '@/lib/mock/timetable'
import { apiGet, apiPost, apiPut, apiDelete } from './client'

const USE_MOCK = false

// ─── Normaliser ────────────────────────────────────────────────────────────────
function normalizeSlot(s) {
  let day = s.day || ''
  let startTime = s.startTime || ''
  let endTime = s.endTime || ''

  if (s.startAt) {
    const d = new Date(s.startAt)
    day = day || d.toLocaleDateString('en-KE', { weekday: 'long' })
    startTime = startTime || d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (s.endAt) {
    const d = new Date(s.endAt)
    endTime = endTime || d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  if (!day && s.day_of_week) day = s.day_of_week
  if (!startTime && s.start_time) startTime = s.start_time.slice(0, 5)
  if (!endTime && s.end_time) endTime = s.end_time.slice(0, 5)

  return {
    id: String(s.id),
    courseCode: s.course?.code || s.courseCode || String(s.courseId || ''),
    courseTitle: s.course?.name || s.courseTitle || '',
    courseId: String(s.courseId || s.course?.id || ''),
    day,
    startTime,
    endTime,
    room: s.roomRef || s.room || '',
    cohort: s.cohort || '',
    color: s.color || 'teal',
    lecturerName: s.lecturer?.name || s.lecturerName || '',
    lecturerId: String(s.lecturerId || s.lecturer?.id || ''),
    published: s.published ?? true,
    type: s.type || 'lecture',
    recurring: s.recurring || false,
    startAt: s.startAt || null,
    endAt: s.endAt || null,
  }
}

// ─── Build backend payload from UI form ───────────────────────────────────────
// FIX: Previously, buildPayload used `new Date()` (today) as the base date, meaning
// a "Monday 08:00" slot created on Thursday stored a specific next-Monday timestamp.
// After that Monday passed, the slot appeared as a past event permanently.
//
// Fix: use a fixed reference epoch week (2001-01-01 was a Monday) so startAt/endAt
// encode day-of-week + time in a stable, non-stale way. The normalizeSlot function
// extracts day/time from these timestamps, so the timetable always displays correctly
// regardless of when the slot was created or which week the user is viewing.
function buildPayload(form) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const targetDay = dayNames.indexOf(form.day)

  // FIX: Use a stable reference week rather than the current week.
  // 2001-01-01 00:00:00 UTC = Monday. Offset to the correct day of that reference week.
  const REFERENCE_MONDAY = new Date('2001-01-01T00:00:00Z')
  const dayOffset = targetDay >= 0 ? (targetDay === 0 ? 6 : targetDay - 1) : 0
  const baseDate = new Date(REFERENCE_MONDAY)
  baseDate.setUTCDate(REFERENCE_MONDAY.getUTCDate() + dayOffset)

  function toISO(base, timeStr) {
    const [h, m] = (timeStr || '08:00').split(':').map(Number)
    const d = new Date(base)
    d.setUTCHours(h, m, 0, 0)
    return d.toISOString()
  }

  return {
    courseId:   form.courseId   ? Number(form.courseId)   : undefined,
    lecturerId: form.lecturerId ? Number(form.lecturerId) : undefined,
    roomRef:    form.room       || undefined,
    startAt:    toISO(baseDate, form.startTime),
    endAt:      toISO(baseDate, form.endTime),
    published:  form.published  ?? false,
  }
}

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getTimetable() {
  if (USE_MOCK) return mockTimetable
  const data = await apiGet('/api/v1/schedule/timetable')
  return (data.data || []).map(normalizeSlot)
}

export async function createTimetableSlot(form) {
  if (USE_MOCK) return normalizeSlot({ id: `t${Date.now()}`, ...form })

  const payload = buildPayload(form)

  if (!payload.lecturerId) {
    try {
      const savedUser = JSON.parse(sessionStorage.getItem('lms_user') || '{}')
      payload.lecturerId = Number(savedUser.id) || 1
    } catch {
      payload.lecturerId = 1
    }
  }

  const data = await apiPost('/api/v1/schedule/timetable', payload)
  return normalizeSlot(data.data)
}

export async function updateTimetableSlot(slotId, form) {
  if (USE_MOCK) return normalizeSlot({ id: slotId, ...form })
  const payload = buildPayload(form)
  const data = await apiPut(`/api/v1/schedule/timetable/${slotId}`, payload)
  return normalizeSlot(data.data)
}

export async function deleteTimetableSlot(slotId) {
  if (USE_MOCK) return true
  await apiDelete(`/api/v1/schedule/timetable/${slotId}`)
  return true
}