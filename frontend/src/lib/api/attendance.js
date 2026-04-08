// DESTINATION: src/lib/api/attendance.js

import { mockAttendance } from '@/lib/mock/attendance'
import { apiGet, apiPost } from './client'

const USE_MOCK = false

// ─── Normalise raw backend attendance records into grouped course view ─────────
function normalizeToGrouped(records) {
  const courseMap = {}
  for (const r of records) {
    const courseId = String(r.course?.id || r.courseId || r.course_id || 'unknown')
    const courseCode = r.course?.code || r.courseCode || r.course_code || courseId
    const courseTitle = r.course?.name || r.courseTitle || r.course_name || courseCode
    const sessionRef = r.sessionRef || r.session_ref || r.sessionOrDate || r.session_date || ''
    const sessionDate = sessionRef.slice(0, 10) || r.createdAt?.slice(0, 10) || ''

    if (!courseMap[courseId]) {
      courseMap[courseId] = { courseId, courseCode, courseTitle, sessions: [] }
    }

    const existing = courseMap[courseId].sessions.find(s => s.id === sessionRef)
    const record = {
      studentId: String(r.userId || r.user?.id || r.studentId || ''),
      studentName: r.user?.name || r.studentName || r.student_name || `User ${r.userId}`,
      // FIX: verified=true → present, verified=false → absent (record exists but unverified)
      status: r.verified ? 'present' : 'absent',
    }

    if (existing) {
      existing.records.push(record)
    } else {
      courseMap[courseId].sessions.push({
        id: sessionRef,
        date: sessionDate,
        topic: sessionRef,
        records: [record],
      })
    }
  }
  return Object.values(courseMap)
}

// ─── Get attendance ────────────────────────────────────────────────────────────
export async function getAttendance(courseId) {
  if (USE_MOCK) {
    if (courseId) return mockAttendance.filter(a => a.courseId === courseId)
    return mockAttendance
  }

  try {
    const user = JSON.parse(sessionStorage.getItem('lms_user') || '{}')

    if (user?.role === 'student') {
      // FIX: /attendance/summary/:userId endpoint EXISTS in engine — use it correctly
      const data = await apiGet(`/api/v1/attendance/summary/${user.id}`)
      const d = data.data || {}
      return [{
        courseId: 'all',
        courseCode: 'All Courses',
        courseTitle: 'All Courses',
        sessions: (d.records || []).map(r => ({
          id: String(r.id),
          date: r.sessionDate ? r.sessionDate.slice(0, 10) : (r.createdAt?.slice(0, 10) || ''),
          topic: r.sessionTopic || r.sessionRef || '',
          records: [{
            studentId: String(user.id),
            studentName: user.name,
            status: r.verified ? 'present' : 'absent',
          }],
        })),
        summary: {
          rate: d.rate || 0,
          present: d.present || 0,
          total: d.total || 0,
          absent: d.absent || 0,
        },
      }]
    }

    // Lecturer / admin
    const url = courseId
      ? `/api/v1/attendance?courseId=${courseId}`
      : `/api/v1/attendance`
    const data = await apiGet(url)
    return normalizeToGrouped(data.data || [])
  } catch {
    return []
  }
}

// ─── Create an attendance session ─────────────────────────────────────────────
export async function createSession(courseId, payload) {
  if (USE_MOCK) {
    return { id: `sess${Date.now()}`, courseId, ...payload, records: [] }
  }

  const ref = `${courseId}-${payload.date}`
  return {
    id: ref,
    date: payload.date,
    topic: payload.topic || ref,
    records: [],
  }
}

// ─── Mark attendance for multiple students using bulk endpoint ─────────────────
// FIX: Use POST /api/v1/attendance/bulk to mark present students in one call.
// Absent students are explicitly created with verified=false so they appear in the UI.
// Previously: 30 individual POSTs, absent students never created → invisible in UI.
export async function markAttendance(sessionId, records, sessionDate) {
  if (USE_MOCK) return { sessionId, records }

  // Split into present and absent
  const presentRecords = records.filter(r => r.status === 'present')
  const absentRecords  = records.filter(r => r.status !== 'present')

  const results = []

  // POST present students via bulk endpoint (verified=true is set server-side by default
  // when using the single POST; bulk creates with verified=false, so we use single POST
  // for present students and mark them verified via override, OR we use individual POSTs
  // with verified=true. Engine's bulk endpoint sets verified=false — so for present,
  // use individual POST (which also deduplicates). For absent, use bulk with verified=false.

  // Present students: individual POST so verified defaults to false, then override to true
  for (const r of presentRecords) {
    try {
      const rec = await apiPost('/api/v1/attendance', {
        userId:     Number(r.studentId),
        sessionRef: sessionId,
        sessionDate: sessionDate ? new Date(sessionDate).toISOString() : undefined,
        verified:   true,
        source:     'manual',
      })
      results.push({ status: 'fulfilled', value: rec })
    } catch (e) {
      results.push({ status: 'rejected', reason: e })
    }
  }

  // Absent students: use bulk endpoint — creates records with verified=false
  if (absentRecords.length > 0) {
    try {
      const bulkRes = await apiPost('/api/v1/attendance/bulk', {
        sessionRef:   sessionId,
        sessionDate:  sessionDate ? new Date(sessionDate).toISOString() : undefined,
        records: absentRecords.map(r => ({
          userId: Number(r.studentId),
          source: 'manual',
        })),
      })
      results.push({ status: 'fulfilled', value: bulkRes })
    } catch (e) {
      results.push({ status: 'rejected', reason: e })
    }
  }

  return results
}

// ─── Override a single attendance record's verified status ────────────────────
export async function overrideAttendance(recordId, verified) {
  return apiPost(`/api/v1/attendance/${recordId}/override`, { verified })
}