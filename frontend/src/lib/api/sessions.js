// DESTINATION: src/lib/api/sessions.js
// Session = Online Class. State machine:
//   scheduled → live → ended → (recording: none → processing → ready)
//                   ↘ cancelled

import { apiGet, apiPost, apiPut, apiDelete } from './client'

const USE_MOCK = false

// ─── Status config ─────────────────────────────────────────────────────────────
export const SESSION_STATUS = {
  scheduled:  { label: 'Scheduled',  color: 'blue',    hex: '#2563eb' },
  live:       { label: 'Live Now',   color: 'success', hex: '#059669' },
  ended:      { label: 'Ended',      color: 'gray',    hex: '#64748b' },
  cancelled:  { label: 'Cancelled',  color: 'danger',  hex: '#dc2626' },
}

export const RECORDING_STATUS = {
  none:       { label: 'No Recording',     color: 'gray' },
  processing: { label: 'Processing…',      color: 'warning' },
  ready:      { label: 'Recording Ready',  color: 'success' },
}

export const PROVIDERS = [
  { value: 'zoom',         label: 'Zoom' },
  { value: 'google_meet',  label: 'Google Meet' },
  { value: 'bbb',          label: 'BigBlueButton' },
  { value: 'custom',       label: 'Custom Link' },
]

// ─── Mock data ─────────────────────────────────────────────────────────────────
const now = Date.now()
const h = 3_600_000

const mockSessions = [
  {
    id: 's1',
    courseId: 'CS301', courseCode: 'CS301', courseTitle: 'Data Structures & Algorithms',
    title: 'Trees & Graphs — Live Session',
    description: 'Interactive walkthrough of BST, AVL Trees, and BFS/DFS graph traversal.',
    startAt: new Date(now - 0.5 * h).toISOString(),
    endAt:   new Date(now + 1.5 * h).toISOString(),
    status: 'live',
    provider: 'zoom',
    joinUrl: 'https://zoom.us/j/123456789',
    hostId: 2, hostName: 'Prof. Jane Mwangi',
    recordingUrl: null, recordingStatus: 'none',
    createdAt: new Date(now - 24 * h).toISOString(),
  },
  {
    id: 's2',
    courseId: 'CS205', courseCode: 'CS205', courseTitle: 'Database Systems',
    title: 'Advanced SQL — JOINs and Subqueries',
    description: 'Live coding demo covering complex SQL queries and performance tips.',
    startAt: new Date(now + 2 * h).toISOString(),
    endAt:   new Date(now + 4 * h).toISOString(),
    status: 'scheduled',
    provider: 'google_meet',
    joinUrl: 'https://meet.google.com/abc-defg-hij',
    hostId: 2, hostName: 'Prof. Jane Mwangi',
    recordingUrl: null, recordingStatus: 'none',
    createdAt: new Date(now - 48 * h).toISOString(),
  },
  {
    id: 's3',
    courseId: 'CS301', courseCode: 'CS301', courseTitle: 'Data Structures & Algorithms',
    title: 'Introduction to DSA — Week 1',
    description: 'Overview of the course, complexity analysis, and Big-O notation.',
    startAt: new Date(now - 7 * 24 * h).toISOString(),
    endAt:   new Date(now - 7 * 24 * h + 1.5 * h).toISOString(),
    status: 'ended',
    provider: 'zoom', joinUrl: null,
    hostId: 2, hostName: 'Prof. Jane Mwangi',
    recordingUrl: 'https://s3.amazonaws.com/advatech/recordings/s3.mp4',
    recordingStatus: 'ready',
    createdAt: new Date(now - 8 * 24 * h).toISOString(),
  },
]

// ─── Normaliser ────────────────────────────────────────────────────────────────
// Engine shape: { id, courseId, title, description, startAt, endAt, status,
//                 provider, joinUrl, course: { id, name, code }, … }
function normalize(s) {
  return {
    id: String(s.id),
    courseId: String(s.courseId || s.course?.id || ''),
    courseCode: s.courseCode || s.course?.code || '',
    courseTitle: s.courseTitle || s.course?.name || s.title || '',
    title: s.title || '',
    description: s.description || '',
    // Engine uses startAt / endAt
    startTime: s.startAt || s.startTime || s.start_time,
    endTime:   s.endAt   || s.endTime   || s.end_time,
    status: s.status || 'scheduled',
    // Engine uses provider / joinUrl
    meetingProvider: s.provider || s.meetingProvider || s.meeting_provider || 'custom',
    meetingUrl: s.joinUrl || s.meetingUrl || s.meeting_url || null,
    hostId: s.hostId || s.host_id,
    hostName: s.hostName || s.host_name || '',
    recordingUrl: s.recordingUrl || s.recording_url || null,
    recordingStatus: s.recordingStatus || s.recording_status || 'none',
    createdAt: s.createdAt || s.created_at,
    updatedAt: s.updatedAt || s.updated_at,
  }
}

// ─── Get sessions (optionally filtered by courseId and/or status) ──────────────
// GET /api/v1/schedule/online-classes
export async function getSessions({ courseId, status } = {}) {
  if (USE_MOCK) {
    let list = [...mockSessions]
    if (courseId) list = list.filter(s => s.courseId === String(courseId))
    if (status) list = list.filter(s => s.status === status)
    return list.map(normalize)
  }

  try {
    const params = new URLSearchParams()
    if (courseId) params.set('courseId', courseId)   // engine expects courseId, NOT courseMoodleId
    if (status) params.set('status', status)
    const data = await apiGet(`/api/v1/schedule/online-classes?${params}`)
    return (data.data || []).map(normalize)
  } catch {
    return []
  }
}

// ─── Get a single session ──────────────────────────────────────────────────────
export async function getSession(sessionId) {
  if (USE_MOCK) {
    const s = mockSessions.find(s => s.id === String(sessionId))
    return s ? normalize(s) : null
  }
  const data = await apiGet(`/api/v1/schedule/online-classes/${sessionId}`)
  return normalize(data.session || data.data)
}

// ─── Create a session ──────────────────────────────────────────────────────────
// POST /api/v1/schedule/online-classes
// Payload: { courseId, startAt, endAt, provider, joinUrl, title?, description? }
export async function createSession(payload) {
  if (USE_MOCK) {
    return normalize({ id: 's' + Date.now(), status: 'scheduled', ...payload })
  }
  const data = await apiPost('/api/v1/schedule/online-classes', {
    courseId:    payload.courseId,
    title:       payload.title || '',
    description: payload.description || '',
    startAt:     payload.startAt || payload.startTime,
    endAt:       payload.endAt   || payload.endTime,
    provider:    payload.provider || payload.meetingProvider || 'zoom',
    joinUrl:     payload.joinUrl  || payload.meetingUrl || '',
  })
  return normalize(data.session || data.data)
}

// ─── Update a session ──────────────────────────────────────────────────────────
export async function updateSession(sessionId, payload) {
  if (USE_MOCK) return normalize({ id: sessionId, ...payload })
  const data = await apiPut(`/api/v1/schedule/online-classes/${sessionId}`, {
    courseId:    payload.courseId,
    title:       payload.title,
    description: payload.description,
    startAt:     payload.startAt || payload.startTime,
    endAt:       payload.endAt   || payload.endTime,
    provider:    payload.provider || payload.meetingProvider,
    joinUrl:     payload.joinUrl  || payload.meetingUrl,
  })
  return normalize(data.session || data.data)
}

// ─── Delete / cancel a session ─────────────────────────────────────────────────
export async function deleteSession(sessionId) {
  if (USE_MOCK) return true
  await apiDelete(`/api/v1/schedule/online-classes/${sessionId}`)
  return true
}

// ─── Upload a recording for a session ─────────────────────────────────────────
// POST /api/v1/schedule/online-classes/:sessionId/recordings
export async function uploadRecording(sessionId, payload) {
  if (USE_MOCK) return { id: 'r' + Date.now(), sessionId, ...payload }

  if (payload.file) {
    const formData = new FormData()
    formData.append('file', payload.file)
    if (payload.title) formData.append('title', payload.title)
    const data = await apiPost(
      `/api/v1/schedule/online-classes/${sessionId}/recordings`,
      formData
    )
    return data.recording || data.data
  }

  const data = await apiPost(
    `/api/v1/schedule/online-classes/${sessionId}/recordings`,
    { title: payload.title || '', url: payload.url || '' }
  )
  return data.recording || data.data
}

export async function startSession(sessionId) {
  const data = await apiPost(`/api/v1/schedule/online-classes/${sessionId}/start`, {})
  return normalize(data.data || data.session)
}

export async function endSession(sessionId) {
  const data = await apiPost(`/api/v1/schedule/online-classes/${sessionId}/end`, {})
  return normalize(data.data || data.session)
}
