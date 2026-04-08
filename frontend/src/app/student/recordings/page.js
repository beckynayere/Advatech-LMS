// DESTINATION: src/app/student/recordings/page.js
'use client'

import { useState, useEffect } from 'react'
import DashboardShell from '@/components/layout/DashboardShell'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { getRecordings } from '@/lib/api/recordings'
import {
  RiSearchLine, RiPlayCircleLine, RiCalendarLine,
  RiHardDriveLine, RiTimeLine,
} from 'react-icons/ri'
import styles from './recordings.module.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const ACCENT = {
  teal:   { color: '#0d9488', bg: '#f0fdfa' },
  blue:   { color: '#2563eb', bg: '#eff6ff' },
  purple: { color: '#7c3aed', bg: '#f5f3ff' },
  amber:  { color: '#d97706', bg: '#fffbeb' },
}

function RecordingCard({ r }) {
  const accent = ACCENT[r.color] || ACCENT.teal
  // engine stores the file URL in r.url, UI previously used r.recordingUrl
  const href = r.url || r.recordingUrl

  return (
    <div className={styles.card}>
      <div className={styles.thumbnail} style={{ background: accent.bg }}>
        <RiPlayCircleLine size={28} color={accent.color} />
        {r.durationFormatted && (
          <span className={styles.duration}>{r.durationFormatted}</span>
        )}
      </div>
      <div className={styles.body}>
        <span className={styles.courseChip} style={{ color: accent.color, background: accent.bg }}>
          {r.courseCode || r.courseTitle}
        </span>
        <div className={styles.cardTitle}>{r.title}</div>
        {r.description && <div className={styles.cardDesc}>{r.description}</div>}
        <div className={styles.cardMeta}>
          {r.recordedAt && (
            <div className={styles.metaRow}><RiCalendarLine size={12} />{formatDate(r.recordedAt)}</div>
          )}
          {r.fileSizeFormatted && r.fileSizeFormatted !== '—' && (
            <div className={styles.metaRow}><RiHardDriveLine size={12} />{r.fileSizeFormatted}</div>
          )}
          {r.durationFormatted && (
            <div className={styles.metaRow}><RiTimeLine size={12} />{r.durationFormatted}</div>
          )}
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.watchBtn}
            style={{ background: accent.color }}
          >
            Watch Recording
          </a>
        ) : (
          <span className={styles.watchBtn} style={{ background: 'var(--gray-200)', color: 'var(--text-muted)', cursor: 'default' }}>
            Not available
          </span>
        )}
      </div>
    </div>
  )
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState([])
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    getRecordings()
      .then(setRecordings)
      .finally(() => setLoading(false))
  }, [])

  const courses = ['all', ...new Set(recordings.map(r => r.courseCode).filter(Boolean))]

  const filtered = recordings.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || (r.title || '').toLowerCase().includes(q)
      || (r.description || '').toLowerCase().includes(q)
      || (r.courseCode || '').toLowerCase().includes(q)
    const matchFilter = filter === 'all' || r.courseCode === filter
    return matchSearch && matchFilter
  })

  return (
    <DashboardShell title="Recordings" subtitle="Watch recorded lectures and sessions" requiredRole="student">
      <div className={styles.container}>

        {/* Search + filter */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <RiSearchLine size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              placeholder="Search recordings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1, background: 'transparent', color: 'var(--text-primary)' }}
            />
          </div>
          <div className={styles.filters}>
            {courses.map(c => (
              <button
                key={c}
                className={`${styles.filterBtn} ${filter === c ? styles.active : ''}`}
                onClick={() => setFilter(c)}
              >
                {c === 'all' ? 'All Courses' : c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.grid}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                <Skeleton height={140} style={{ borderRadius: 0 }} />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton width="40%" height={11} />
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="55%" height={11} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RiPlayCircleLine}
            title={search ? 'No recordings match your search' : 'No recordings yet'}
            desc={search
              ? 'Try a different search term or course filter.'
              : 'Recordings from your online sessions will appear here.'}
          />
        ) : (
          <div className={styles.grid}>
            {filtered.map(r => <RecordingCard key={r.id} r={r} />)}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}