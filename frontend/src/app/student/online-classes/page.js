// DESTINATION: src/app/student/online-classes/page.js
'use client'

import { useState, useEffect } from 'react'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { getOnlineClasses } from '@/lib/api/onlineClasses'
import {
  RiVideoLine, RiCalendarLine, RiTimeLine,
  RiExternalLinkLine, RiRecordCircleLine, RiPlayCircleLine,
} from 'react-icons/ri'
import styles from './online-classes.module.css'

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function getDuration(start, end) {
  if (!start || !end) return ''
  const mins = Math.round((new Date(end) - new Date(start)) / 60000)
  if (mins <= 0) return ''
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`
  return `${mins} min`
}

const STATUS_CONFIG = {
  live:      { label: 'Live Now',   color: '#059669', bg: '#ecfdf5' },
  scheduled: { label: 'Upcoming',   color: '#2563eb', bg: '#eff6ff' },
  ended:     { label: 'Ended',      color: '#64748b', bg: '#f1f5f9' },
  cancelled: { label: 'Cancelled',  color: '#dc2626', bg: '#fef2f2' },
}

const FILTERS = ['all', 'scheduled', 'live', 'ended']

export default function OnlineClassesPage() {
  const [classes, setClasses] = useState([])
  const [filter, setFilter]   = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOnlineClasses()
      .then(setClasses)
      .finally(() => setLoading(false))
  }, [])

  const liveClasses = classes.filter(c => c.status === 'live')
  const filtered = classes.filter(c =>
    filter === 'all' ? c.status !== 'live' : c.status === filter && c.status !== 'live'
  )

  return (
    <DashboardShell title="Online Classes" subtitle="Join live sessions or view upcoming classes" requiredRole="student">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Live now banner */}
        {!loading && liveClasses.map(cls => (
          <div key={cls.id} style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
            borderRadius: 14,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', background: '#34d399',
                boxShadow: '0 0 0 4px rgba(52,211,153,0.3)',
                animation: 'livePulse 2s ease-in-out infinite',
              }} />
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{cls.title}</div>
                <div style={{ color: '#a7f3d0', fontSize: 12, marginTop: 2 }}>
                  {cls.courseCode} · Started {new Date(cls.startAt || cls.scheduledStartTime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              </div>
            </div>
            {cls.meetingUrl || cls.joinUrl ? (
              <a
                href={cls.meetingUrl || cls.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#059669', color: '#fff', fontWeight: 600,
                  fontSize: 13, padding: '9px 18px', borderRadius: 8,
                  textDecoration: 'none', flexShrink: 0,
                }}
              >
                Join Now <RiExternalLinkLine size={13} />
              </a>
            ) : null}
          </div>
        ))}
        <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1px solid',
                borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
                background: filter === f ? 'var(--primary-light)' : 'var(--surface)',
                color: filter === f ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label || f}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <Skeleton key={i} variant="row" height={88} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RiVideoLine}
            title="No sessions found"
            desc={filter === 'all'
              ? 'No online sessions have been scheduled yet.'
              : `No ${STATUS_CONFIG[filter]?.label?.toLowerCase() || filter} sessions.`}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(cls => {
              const sc = STATUS_CONFIG[cls.status] || STATUS_CONFIG.ended
              const startIso = cls.startAt || cls.scheduledStartTime
              const endIso   = cls.endAt   || cls.scheduledEndTime
              return (
                <div
                  key={cls.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 14,
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {cls.status === 'ended'
                      ? <RiPlayCircleLine size={20} color={sc.color} />
                      : <RiVideoLine size={20} color={sc.color} />}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {cls.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 11 }}>
                        {cls.courseCode}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RiCalendarLine size={11} /> {formatDateTime(startIso)}
                      </span>
                      {getDuration(startIso, endIso) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <RiTimeLine size={11} /> {getDuration(startIso, endIso)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                      background: sc.bg, color: sc.color,
                    }}>
                      {cls.status === 'live' && <RiRecordCircleLine size={11} />}
                      {sc.label}
                    </span>
                    {(cls.meetingUrl || cls.joinUrl) && cls.status !== 'ended' && (
                      <a
                        href={cls.meetingUrl || cls.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, fontWeight: 600, color: 'var(--primary)',
                          padding: '6px 14px', borderRadius: 7,
                          border: '1px solid var(--primary)', textDecoration: 'none',
                        }}
                      >
                        Join <RiExternalLinkLine size={11} />
                      </a>
                    )}
                    {cls.recordingUrl && cls.status === 'ended' && (
                      <a
                        href={cls.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, fontWeight: 600, color: '#2563eb',
                          padding: '6px 14px', borderRadius: 7,
                          border: '1px solid #2563eb', textDecoration: 'none',
                        }}
                      >
                        Recording <RiPlayCircleLine size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}