// DESTINATION: src/lib/api/onlineClasses.js

import { apiGet } from './client'

function normalize(s) {
  return {
    id: String(s.id),
    courseId: String(s.courseId || s.course?.id || ''),
    courseCode: s.courseCode || s.course?.code || '',
    courseTitle: s.courseTitle || s.course?.name || '',
    title: s.title || '',
    description: s.description || '',
    // Engine uses startAt/endAt
    startAt: s.startAt || s.startTime,
    endAt:   s.endAt   || s.endTime,
    // UI aliases
    scheduledStartTime: s.startAt || s.startTime,
    scheduledEndTime:   s.endAt   || s.endTime,
    status: s.status || 'scheduled',
    provider: s.provider || s.meetingProvider || 'custom',
    meetingUrl: s.joinUrl || s.meetingUrl || null,
    meetingProvider: s.provider || s.meetingProvider || 'custom',
    joinUrl: s.joinUrl || s.meetingUrl || null,
    recordingUrl: s.recordingUrl || null,
    recordingStatus: s.recordingStatus || 'none',
    hostId: s.hostId || null,
    hostName: s.hostName || s.host?.name || '',
    color: s.color || 'teal',
  }
}

export async function getOnlineClasses(courseId, status) {
  try {
    const params = new URLSearchParams()
    if (courseId) params.set('courseId', courseId)
    if (status)   params.set('status', status)
    const data = await apiGet(`/api/v1/schedule/online-classes?${params}`)
    return (data.data || []).map(normalize)
  } catch {
    return []
  }
}

export async function getOnlineClass(id) {
  const data = await apiGet(`/api/v1/schedule/online-classes/${id}`)
  return normalize(data.data || data.session)
}