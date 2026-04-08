// DESTINATION: src/app/student/sessions/page.js
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RiLiveLine, RiCalendarLine, RiTimeLine, RiVideoLine,
  RiPlayCircleLine, RiLoaderLine, RiRefreshLine,
  RiCheckboxCircleLine, RiCloseCircleLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import { getSessions, SESSION_STATUS, RECORDING_STATUS } from '@/lib/api/sessions'
import styles from './sessions.module.css'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtDuration(start, end) {
  if (!start || !end) return ''
  const mins = Math.round((new Date(end) - new Date(start)) / 60000)
  return mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`
}
function timeUntil(iso) {
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return 'Starting now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `In ${h}h ${m}m`
  return `In ${m}m`
}

function StatusBadge({ status }) {
  const cfg = SESSION_STATUS[status] || { label: status, color: 'gray' }
  return (
    <span className={`${styles.badge} ${styles[`badge_${cfg.color}`]}`}>
      {status === 'live' && <span className={styles.livePulse} />}
      {cfg.label}
    </span>
  )
}

function SessionCard({ session }) {
  const isLive      = session.status === 'live'
  const isScheduled = session.status === 'scheduled'
  const isEnded     = session.status === 'ended'
  const hasRec      = session.recordingStatus === 'ready'
  const isProcessing= session.recordingStatus === 'processing'

  return (
    <div className={`${styles.card} ${isLive ? styles.cardLive : ''}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardLeft}>
          <div className={styles.cardCourse}>{session.courseCode} · {session.courseTitle}</div>
          <div className={styles.cardTitle}>{session.title}</div>
          {session.description && <div className={styles.cardDesc}>{session.description}</div>}
          <div className={styles.cardHost}>Hosted by {session.hostName}</div>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className={styles.cardMeta}>
        <span><RiCalendarLine size={12} /> {fmtDate(session.startTime)}</span>
        <span><RiTimeLine size={12} /> {fmtDuration(session.startTime, session.endTime)}</span>
        {isScheduled && (
          <span className={styles.countdown}>{timeUntil(session.startTime)}</span>
        )}
      </div>

      <div className={styles.cardActions}>
        {isLive && session.meetingUrl && (
          <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnJoin}`}>
            <RiVideoLine size={13} /> Join Now
          </a>
        )}
        {isLive && !session.meetingUrl && (
          <span className={styles.noLink}>Link not available yet</span>
        )}
        {isScheduled && session.meetingUrl && (
          <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnScheduled}`}>
            <RiCalendarLine size={13} /> Add to Calendar
          </a>
        )}
        {isEnded && hasRec && (
          <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnWatch}`}>
            <RiPlayCircleLine size={13} /> Watch Recording
          </a>
        )}
        {isEnded && isProcessing && (
          <span className={`${styles.btn} ${styles.btnProcessing}`}>
            <RiLoaderLine size={13} className={styles.spin} /> Processing…
          </span>
        )}
        {isEnded && session.recordingStatus === 'none' && (
          <span className={styles.noRec}>No recording available</span>
        )}
      </div>
    </div>
  )
}

export default function StudentSessionsPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { setSessions(await getSessions()) }
    catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasLive = sessions.some(s => s.status === 'live')
    clearInterval(pollRef.current)
    if (hasLive) pollRef.current = setInterval(() => load(true), 30000)
    return () => clearInterval(pollRef.current)
  }, [sessions, load])

  const live     = sessions.filter(s => s.status === 'live')
  const upcoming = sessions.filter(s => s.status === 'scheduled')
  const past     = sessions.filter(s => s.status === 'ended' || s.status === 'cancelled')

  const Group = ({ title, items, icon: Icon, emptyMsg }) => (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <Icon size={15} />
        <span>{title}</span>
        <span className={styles.groupCount}>{items.length}</span>
      </div>
      {items.length === 0
        ? <div className={styles.groupEmpty}>{emptyMsg}</div>
        : items.map(s => <SessionCard key={s.id} session={s} />)
      }
    </div>
  )

  return (
    <DashboardShell title="Sessions" subtitle="Live and upcoming classes across your courses">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarNote}>
            {live.length > 0
              ? <span className={styles.liveAlert}><span className={styles.livePulse} /> {live.length} session{live.length > 1 ? 's' : ''} live now</span>
              : 'No live sessions right now'
            }
          </div>
          <button className={styles.refreshBtn} onClick={() => load()} disabled={loading}>
            <RiRefreshLine size={14} className={loading ? styles.spin : ''} />
          </button>
        </div>

        {loading
          ? <div className={styles.loadingState}><RiLoaderLine size={22} className={styles.spin} /> Loading sessions…</div>
          : <>
              <Group title="Live Now"  items={live}     icon={RiLiveLine}     emptyMsg="No live sessions right now." />
              <Group title="Upcoming"  items={upcoming} icon={RiCalendarLine} emptyMsg="No upcoming sessions scheduled." />
              <Group title="Past"      items={past}     icon={RiTimeLine}     emptyMsg="No past sessions yet." />
            </>
        }
      </div>
    </DashboardShell>
  )
}