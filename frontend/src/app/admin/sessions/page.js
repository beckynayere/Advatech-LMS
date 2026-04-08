// DESTINATION: src/app/admin/sessions/page.js
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  RiVideoLine, RiCalendarLine, RiTimeLine,
  RiSearchLine, RiFilterLine, RiExternalLinkLine,
  RiRecordCircleLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { getSessions, SESSION_STATUS, RECORDING_STATUS } from '@/lib/api/sessions'
import styles from './sessions.module.css'

const STATUS_OPTIONS = ['all', 'scheduled', 'live', 'ended', 'cancelled']

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function AdminSessionsPage() {
  const [sessions, setSessions]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('all')

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .finally(() => setLoading(false))
  }, [])

  const filtered = sessions.filter(s => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q
      || s.title?.toLowerCase().includes(q)
      || s.courseCode?.toLowerCase().includes(q)
      || s.courseTitle?.toLowerCase().includes(q)
      || s.hostName?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const liveCount      = sessions.filter(s => s.status === 'live').length
  const scheduledCount = sessions.filter(s => s.status === 'scheduled').length
  const endedCount     = sessions.filter(s => s.status === 'ended').length

  return (
    <DashboardShell
      title="Online Sessions"
      subtitle="All institution-wide online class sessions"
      requiredRole="admin"
    >
      <div className={styles.page}>

        {/* Summary strip */}
        <div className={styles.summaryStrip}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryDot} style={{ background: SESSION_STATUS.live.hex }} />
            <span className={styles.summaryVal}>{liveCount}</span>
            <span className={styles.summaryLabel}>Live now</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryDot} style={{ background: SESSION_STATUS.scheduled.hex }} />
            <span className={styles.summaryVal}>{scheduledCount}</span>
            <span className={styles.summaryLabel}>Upcoming</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryDot} style={{ background: '#64748b' }} />
            <span className={styles.summaryVal}>{endedCount}</span>
            <span className={styles.summaryLabel}>Completed</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <RiSearchLine size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by course, title, or lecturer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filterWrap}>
            <RiFilterLine size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={e => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>
                  {s === 'all' ? 'All statuses' : SESSION_STATUS[s]?.label || s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading sessions…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RiVideoLine}
            title="No sessions found"
            desc={search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'No online class sessions have been scheduled yet.'}
          />
        ) : (
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Course</th>
                  <th>Date &amp; Time</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Recording</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const statusCfg = SESSION_STATUS[s.status] || {}
                  const recCfg   = RECORDING_STATUS[s.recordingStatus] || RECORDING_STATUS.none
                  return (
                    <tr key={s.id}>
                      {/* Session title */}
                      <td>
                        <div className={styles.sessionTitle}>{s.title || '—'}</div>
                        {s.meetingProvider && (
                          <div className={styles.sessionProvider}>
                            {s.meetingProvider.replace('_', ' ')}
                          </div>
                        )}
                      </td>

                      {/* Course */}
                      <td>
                        <span className={styles.courseCode}>{s.courseCode}</span>
                        {s.courseTitle && (
                          <span className={styles.courseTitle}>{s.courseTitle}</span>
                        )}
                      </td>

                      {/* Date & time */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <RiCalendarLine size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{formatDateTime(s.startTime)}</span>
                        </div>
                        {s.endTime && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            <RiTimeLine size={12} style={{ flexShrink: 0 }} />
                            <span>ends {formatTime(s.endTime)}</span>
                          </div>
                        )}
                      </td>

                      {/* Host */}
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {s.hostName || '—'}
                      </td>

                      {/* Status badge */}
                      <td>
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: statusCfg.hex + '18',
                            color: statusCfg.hex,
                            borderColor: statusCfg.hex + '40',
                          }}
                        >
                          {s.status === 'live' && (
                            <RiRecordCircleLine size={11} style={{ marginRight: 4 }} />
                          )}
                          {statusCfg.label || s.status}
                        </span>
                      </td>

                      {/* Recording */}
                      <td>
                        <Badge
                          label={recCfg.label}
                          color={recCfg.color}
                          size="sm"
                        />
                      </td>

                      {/* Join link */}
                      <td>
                        {s.meetingUrl && s.status !== 'ended' && s.status !== 'cancelled' && (
                          <a
                            href={s.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.joinLink}
                          >
                            Join <RiExternalLinkLine size={11} />
                          </a>
                        )}
                        {s.recordingUrl && (
                          <a
                            href={s.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.joinLink}
                          >
                            Recording <RiExternalLinkLine size={11} />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}