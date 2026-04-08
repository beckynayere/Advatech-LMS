// DESTINATION: src/app/student/courses/[courseId]/sessions/page.js
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine, RiVideoLine, RiLiveLine, RiCalendarLine,
  RiTimeLine, RiLoaderLine, RiPlayCircleLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import { getSessions, SESSION_STATUS } from '@/lib/api/sessions'
import { getCourse } from '@/lib/api/courses'
import styles from './sessions.module.css'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}
function timeUntil(iso) {
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return 'Starting now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `In ${h}h ${m}m` : `In ${m}m`
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

function SessionRow({ session }) {
  const isLive      = session.status === 'live'
  const isScheduled = session.status === 'scheduled'
  const isEnded     = session.status === 'ended'

  return (
    <div className={`${styles.row} ${isLive ? styles.rowLive : ''}`}>
      <div className={styles.rowLeft}>
        <StatusBadge status={session.status} />
        <div>
          <div className={styles.rowTitle}>{session.title}</div>
          <div className={styles.rowMeta}>
            <RiCalendarLine size={11} /> {fmtDate(session.startTime)}
            {isScheduled && <span className={styles.countdown}> · {timeUntil(session.startTime)}</span>}
          </div>
        </div>
      </div>
      <div className={styles.rowActions}>
        {isLive && session.meetingUrl && (
          <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnJoin}`}>
            <RiVideoLine size={12} /> Join Now
          </a>
        )}
        {isLive && !session.meetingUrl && (
          <span className={styles.noLink}>Link coming soon</span>
        )}
        {isEnded && session.recordingStatus === 'ready' && (
          <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnWatch}`}>
            <RiPlayCircleLine size={12} /> Watch Recording
          </a>
        )}
        {isEnded && session.recordingStatus === 'processing' && (
          <span className={`${styles.btn} ${styles.btnProcessing}`}>
            <RiLoaderLine size={12} className={styles.spin} /> Processing
          </span>
        )}
        {isEnded && session.recordingStatus === 'none' && (
          <span className={styles.noRec}>No recording</span>
        )}
      </div>
    </div>
  )
}

export default function StudentCourseSessionsPage() {
  const { courseId } = useParams()
  const [course, setCourse] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [c, s] = await Promise.all([getCourse(courseId), getSessions({ courseId })])
      setCourse(c); setSessions(s)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [courseId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasLive = sessions.some(s => s.status === 'live')
    clearInterval(pollRef.current)
    if (hasLive) pollRef.current = setInterval(() => load(true), 30000)
    return () => clearInterval(pollRef.current)
  }, [sessions, load])

  const live     = sessions.filter(s => s.status === 'live')
  const upcoming = sessions.filter(s => s.status === 'scheduled')
  const past     = sessions.filter(s => ['ended','cancelled'].includes(s.status))

  return (
    <DashboardShell
      title={course ? `${course.code} — Sessions` : 'Sessions'}
      subtitle={course?.title || ''}
      requiredRole="student"
    >
      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link href={`/student/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to Course
          </Link>
        </div>

        {loading
          ? <div className={styles.loadingState}><RiLoaderLine size={20} className={styles.spin} /> Loading…</div>
          : <>
              {live.length > 0 && (
                <div className={styles.group}>
                  <div className={styles.groupHeader}><RiLiveLine size={14} /><span>Live Now</span><span className={styles.groupCount}>{live.length}</span></div>
                  {live.map(s => <SessionRow key={s.id} session={s} />)}
                </div>
              )}
              <div className={styles.group}>
                <div className={styles.groupHeader}><RiCalendarLine size={14} /><span>Upcoming</span><span className={styles.groupCount}>{upcoming.length}</span></div>
                {upcoming.length === 0
                  ? <div className={styles.groupEmpty}>No upcoming sessions for this course.</div>
                  : upcoming.map(s => <SessionRow key={s.id} session={s} />)
                }
              </div>
              <div className={styles.group}>
                <div className={styles.groupHeader}><RiTimeLine size={14} /><span>Past</span><span className={styles.groupCount}>{past.length}</span></div>
                {past.length === 0
                  ? <div className={styles.groupEmpty}>No past sessions yet.</div>
                  : past.map(s => <SessionRow key={s.id} session={s} />)
                }
              </div>
            </>
        }
      </div>
    </DashboardShell>
  )
}