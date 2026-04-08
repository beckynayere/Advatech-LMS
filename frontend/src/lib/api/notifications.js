// DESTINATION: src/lib/api/notifications.js

import { apiGet, apiPut } from './client'

const USE_MOCK = false

// ─── Mock data ────────────────────────────────────────────────────────────────
const mockNotifications = [
  {
    id: '1',
    type: 'announcement',
    title: 'Assignment deadline extended',
    message: 'DSA Assignment 1 due date extended by 2 days.',
    status: 'unread',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: '2',
    type: 'grade',
    title: 'Grade received',
    message: 'Your Database Systems ER Diagram has been graded.',
    status: 'unread',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: '3',
    type: 'class',
    title: 'Live class starting soon',
    message: 'CS301 live session starts in 30 minutes.',
    status: 'read',
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
  },
]

// ─── Normaliser ───────────────────────────────────────────────────────────────
// Backend shape: { id, channel, subject, body, sentAt, readAt, createdAt }
function normalizeNotification(n) {
  return {
    id: String(n.id),
    title: n.subject || n.title || 'Notification',
    message: n.body || n.message || '',
    // readAt === null means unread
    status: n.readAt ? 'read' : 'unread',
    type: n.type || n.channel || 'announcement',
    createdAt: n.createdAt || n.sentAt || new Date().toISOString(),
  }
}

// ─── Get notifications ────────────────────────────────────────────────────────
// status: 'unread' | 'read' | undefined (all)
export async function getNotifications(status) {
  if (USE_MOCK) {
    return status
      ? mockNotifications.filter(n => n.status === status)
      : mockNotifications
  }

  const params = new URLSearchParams()
  if (status === 'unread') params.set('unread', 'true')
  else if (status === 'read') params.set('unread', 'false')

  const qs = params.toString()
  const data = await apiGet(`/api/v1/notifications${qs ? '?' + qs : ''}`)
  return (data.data || []).map(normalizeNotification)
}

// ─── Mark a single notification as read ──────────────────────────────────────
// PUT /api/v1/notifications/:id/read
export async function markNotificationRead(notificationId) {
  if (USE_MOCK) return { id: notificationId, status: 'read' }

  try {
    const data = await apiPut(`/api/v1/notifications/${notificationId}/read`, {})
    return data.data || { id: notificationId, readAt: new Date().toISOString() }
  } catch (err) {
    // 409 = already marked read — treat as success
    if (err?.message?.includes('409') || err?.message?.includes('already')) {
      return { id: notificationId, readAt: new Date().toISOString() }
    }
    throw err
  }
}

// ─── Mark all unread notifications as read ────────────────────────────────────
// PUT /api/v1/notifications/read-all
export async function markAllRead(notifications) {
  if (USE_MOCK) return notifications.map(n => ({ ...n, status: 'read' }))

  try {
    const data = await apiPut('/api/v1/notifications/read-all', {})
    return data.data
  } catch {
    // Fallback: mark each unread notification individually
    const unread = notifications.filter(n => n.status === 'unread')
    return Promise.allSettled(unread.map(n => markNotificationRead(n.id)))
  }
}