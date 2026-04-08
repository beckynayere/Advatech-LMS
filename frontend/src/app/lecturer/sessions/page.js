// DESTINATION: src/app/lecturer/sessions/page.js
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  RiVideoLine, RiLiveLine, RiCalendarLine, RiTimeLine,
  RiCheckboxCircleLine, RiRefreshLine, RiLoaderLine,
  RiPlayCircleLine, RiStopCircleLine, RiDeleteBinLine,
  RiEditLine, RiUploadLine, RiErrorWarningLine,
  RiArrowRightLine, RiCloseLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import {
  getSessions, startSession, endSession, deleteSession,
  uploadRecording, SESSION_STATUS, RECORDING_STATUS,
} from '@/lib/api/sessions'
import styles from './sessions.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
function isLiveNow(s) { return s.status === 'live' }
function isUpcoming(s) { return s.status === 'scheduled' }
function isPast(s) { return s.status === 'ended' || s.status === 'cancelled' }

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = SESSION_STATUS[status] || { label: status, color: 'gray' }
  return (
    <span className={`${styles.badge} ${styles[`badge_${cfg.color}`]}`}>
      {status === 'live' && <span className={styles.livePulse} />}
      {cfg.label}
    </span>
  )
}

// ─── Recording badge ──────────────────────────────────────────────────────────
function RecordingBadge({ status }) {
  if (!status || status === 'none') return null
  const cfg = RECORDING_STATUS[status]
  return (
    <span className={`${styles.recBadge} ${styles[`recBadge_${cfg.color}`]}`}>
      {status === 'processing' && <RiLoaderLine size={11} className={styles.spin} />}
      {status === 'ready' && <RiCheckboxCircleLine size={11} />}
      {cfg.label}
    </span>
  )
}

// ─── Upload recording modal ───────────────────────────────────────────────────
function UploadModal({ session, onClose, onUploaded }) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!url.trim()) { setErr('Recording URL is required.'); return }
    setSaving(true); setErr('')
    try {
      const updated = await uploadRecording(session.id, url.trim())
      onUploaded(updated)
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span>Upload Recording</span>
          <button onClick={onClose} className={styles.modalClose}><RiCloseLine size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalSessionName}>{session.title}</div>
          {err && <div className={styles.modalErr}><RiErrorWarningLine size={13} />{err}</div>}
          <label className={styles.label}>Recording URL (S3 or direct link)</label>
          <input
            className={styles.input}
            placeholder="https://s3.amazonaws.com/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <p className={styles.modalHint}>
            Paste the URL of the uploaded recording file. Students will be able to watch it directly.
          </p>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving}>
            {saving ? <><RiLoaderLine size={13} className={styles.spin} /> Saving…</> : <><RiUploadLine size={13} /> Save Recording</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session, onAction, busy }) {
  const isBusy = busy === session.id
  const isLive = session.status === 'live'
  const isScheduled = session.status === 'scheduled'
  const isEnded = session.status === 'ended'

  return (
    <div className={`${styles.card} ${isLive ? styles.cardLive : ''}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardLeft}>
          <div className={styles.cardCourse}>{session.courseCode} · {session.courseTitle}</div>
          <div className={styles.cardTitle}>{session.title}</div>
          {session.description && <div className={styles.cardDesc}>{session.description}</div>}
        </div>
        <div className={styles.cardBadges}>
          <StatusBadge status={session.status} />
          <RecordingBadge status={session.recordingStatus} />
        </div>
      </div>

      <div className={styles.cardMeta}>
        <span><RiCalendarLine size={12} /> {fmtDate(session.startTime)}</span>
        <span><RiTimeLine size={12} /> {fmtDuration(session.startTime, session.endTime)}</span>
        <span className={styles.provider}>{session.meetingProvider}</span>
      </div>

      <div className={styles.cardActions}>
        {isBusy
          ? <span className={styles.busyLabel}><RiLoaderLine size={13} className={styles.spin} /> Working…</span>
          : <>
              {isScheduled && (
                <button className={`${styles.btn} ${styles.btnStart}`} onClick={() => onAction('start', session)}>
                  <RiPlayCircleLine size={13} /> Go Live
                </button>
              )}
              {isLive && (
                <>
                  {session.meetingUrl && (
                    <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer"
                      className={`${styles.btn} ${styles.btnJoin}`}>
                      <RiVideoLine size={13} /> Join Session
                    </a>
                  )}
                  <button className={`${styles.btn} ${styles.btnEnd}`} onClick={() => onAction('end', session)}>
                    <RiStopCircleLine size={13} /> End Session
                  </button>
                </>
              )}
              {isEnded && session.recordingStatus === 'none' && (
                <button className={`${styles.btn} ${styles.btnUpload}`} onClick={() => onAction('upload', session)}>
                  <RiUploadLine size={13} /> Upload Recording
                </button>
              )}
              {isEnded && session.recordingStatus === 'ready' && (
                <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnWatch}`}>
                  <RiPlayCircleLine size={13} /> View Recording
                </a>
              )}
              {(isScheduled || isEnded) && (
                <button className={`${styles.btn} ${styles.btnDelete}`} onClick={() => onAction('delete', session)}>
                  <RiDeleteBinLine size={13} />
                </button>
              )}
            </>
        }
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LecturerSessionsPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [uploadTarget, setUploadTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getSessions()
      setSessions(data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll every 30s if any session is live
  useEffect(() => {
    const hasLive = sessions.some(s => s.status === 'live')
    clearInterval(pollRef.current)
    if (hasLive) pollRef.current = setInterval(() => load(true), 30000)
    return () => clearInterval(pollRef.current)
  }, [sessions, load])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAction(action, session) {
    if (action === 'upload') { setUploadTarget(session); return }
    setBusy(session.id)
    try {
      let updated
      if (action === 'start')  updated = await startSession(session.id)
      if (action === 'end')    updated = await endSession(session.id)
      if (action === 'delete') {
        await deleteSession(session.id)
        setSessions(prev => prev.filter(s => s.id !== session.id))
        showToast('Session deleted.')
        return
      }
      if (updated) setSessions(prev => prev.map(s => s.id === updated.id ? updated : s))
      const msgs = { start: 'Session is now live!', end: 'Session ended.' }
      showToast(msgs[action] || 'Done.')
    } catch (e) { showToast(e.message, 'danger') }
    finally { setBusy(null) }
  }

  const live      = sessions.filter(isLiveNow)
  const upcoming  = sessions.filter(isUpcoming)
  const past      = sessions.filter(isPast)

  const Group = ({ title, items, icon: Icon, emptyMsg }) => (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <Icon size={15} />
        <span>{title}</span>
        <span className={styles.groupCount}>{items.length}</span>
      </div>
      {items.length === 0
        ? <div className={styles.groupEmpty}>{emptyMsg}</div>
        : items.map(s => (
            <SessionCard key={s.id} session={s} onAction={handleAction} busy={busy} />
          ))
      }
    </div>
  )

  return (
    <DashboardShell title="My Sessions" subtitle="Manage live sessions across all your courses">

      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          {toast.msg}
        </div>
      )}

      {uploadTarget && (
        <UploadModal
          session={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onUploaded={updated => {
            setSessions(prev => prev.map(s => s.id === updated.id ? updated : s))
            showToast('Recording saved.')
          }}
        />
      )}

      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarNote}>
            Sessions are created inside each course. Click a course to add a new session.
          </div>
          <div className={styles.toolbarRight}>
            <button className={styles.refreshBtn} onClick={() => load()} disabled={loading}>
              <RiRefreshLine size={14} className={loading ? styles.spin : ''} />
            </button>
            <Link href="/lecturer/courses" className={styles.coursesBtn}>
              My Courses <RiArrowRightLine size={13} />
            </Link>
          </div>
        </div>

        {loading
          ? <div className={styles.loadingState}><RiLoaderLine size={22} className={styles.spin} /> Loading sessions…</div>
          : <>
              <Group title="Live Now"  items={live}     icon={RiLiveLine}     emptyMsg="No live sessions right now." />
              <Group title="Upcoming"  items={upcoming} icon={RiCalendarLine} emptyMsg="No upcoming sessions scheduled." />
              <Group title="Past"      items={past}     icon={RiTimeLine}     emptyMsg="No past sessions." />
            </>
        }
      </div>
    </DashboardShell>
  )
}