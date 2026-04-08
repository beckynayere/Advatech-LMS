// DESTINATION: src/app/lecturer/courses/[courseId]/sessions/page.js
// Session management inside a specific course — create, start, end, upload recording
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine, RiAddLine, RiVideoLine, RiLiveLine,
  RiCalendarLine, RiTimeLine, RiLoaderLine, RiCloseLine,
  RiPlayCircleLine, RiStopCircleLine, RiDeleteBinLine,
  RiUploadLine, RiErrorWarningLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import {
  getSessions, createSession, startSession, endSession,
  deleteSession, uploadRecording, SESSION_STATUS, RECORDING_STATUS, PROVIDERS,
} from '@/lib/api/sessions'
import { getCourse } from '@/lib/api/courses'
import styles from './sessions.module.css'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
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

const EMPTY_FORM = {
  title: '', description: '', startTime: '', endTime: '',
  meetingProvider: 'zoom', meetingUrl: '',
}

function CreateModal({ courseId, courseName, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.title.trim())     { setErr('Title is required.'); return }
    if (!form.startTime)        { setErr('Start time is required.'); return }
    if (!form.endTime)          { setErr('End time is required.'); return }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setErr('End time must be after start time.'); return
    }
    setSaving(true); setErr('')
    try {
      const created = await createSession({
        ...form,
        courseMoodleId: courseId,
        startTime: new Date(form.startTime).toISOString(),
        endTime:   new Date(form.endTime).toISOString(),
      })
      onCreate(created)
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span>Schedule Session — {courseName}</span>
          <button onClick={onClose} className={styles.modalClose}><RiCloseLine size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          {err && <div className={styles.modalErr}><RiErrorWarningLine size={13} />{err}</div>}

          <div className={styles.field}>
            <label className={styles.label}>Session Title <span className={styles.req}>*</span></label>
            <input className={styles.input} placeholder="e.g. Week 5 — Trees & Graphs"
              value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea className={`${styles.input} ${styles.textarea}`} rows={2}
              placeholder="What will this session cover?"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Start Time <span className={styles.req}>*</span></label>
              <input className={styles.input} type="datetime-local"
                value={form.startTime} onChange={e => set('startTime', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>End Time <span className={styles.req}>*</span></label>
              <input className={styles.input} type="datetime-local"
                value={form.endTime} onChange={e => set('endTime', e.target.value)} />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Meeting Provider</label>
              <select className={styles.input} value={form.meetingProvider}
                onChange={e => set('meetingProvider', e.target.value)}>
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Meeting Link</label>
              <input className={styles.input} placeholder="https://..."
                value={form.meetingUrl} onChange={e => set('meetingUrl', e.target.value)} />
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving}>
            {saving
              ? <><RiLoaderLine size={13} className={styles.spin} /> Scheduling…</>
              : <><RiCalendarLine size={13} /> Schedule Session</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadModal({ session, onClose, onUploaded }) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!url.trim()) { setErr('URL is required.'); return }
    setSaving(true)
    try {
      const updated = await uploadRecording(session.id, url.trim())
      onUploaded(updated); onClose()
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
          {err && <div className={styles.modalErr}><RiErrorWarningLine size={13} />{err}</div>}
          <div className={styles.field}>
            <label className={styles.label}>Recording URL</label>
            <input className={styles.input} placeholder="https://s3.amazonaws.com/..."
              value={url} onChange={e => setUrl(e.target.value)} />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving}>
            {saving ? <><RiLoaderLine size={13} className={styles.spin} /> Saving…</> : 'Save Recording'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionRow({ session, onAction, busy }) {
  const isBusy = busy === session.id
  return (
    <div className={`${styles.row} ${session.status === 'live' ? styles.rowLive : ''}`}>
      <div className={styles.rowLeft}>
        <StatusBadge status={session.status} />
        <div>
          <div className={styles.rowTitle}>{session.title}</div>
          <div className={styles.rowMeta}>
            <RiCalendarLine size={11} /> {fmtDate(session.startTime)}
            {' · '}<RiTimeLine size={11} /> {session.meetingProvider}
          </div>
        </div>
      </div>
      <div className={styles.rowActions}>
        {isBusy
          ? <span className={styles.busyLabel}><RiLoaderLine size={12} className={styles.spin} /> Working…</span>
          : <>
              {session.status === 'scheduled' && (
                <button className={`${styles.btn} ${styles.btnStart}`} onClick={() => onAction('start', session)}>
                  <RiPlayCircleLine size={12} /> Go Live
                </button>
              )}
              {session.status === 'live' && (
                <>
                  {session.meetingUrl && (
                    <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer"
                      className={`${styles.btn} ${styles.btnJoin}`}>
                      <RiVideoLine size={12} /> Join
                    </a>
                  )}
                  <button className={`${styles.btn} ${styles.btnEnd}`} onClick={() => onAction('end', session)}>
                    <RiStopCircleLine size={12} /> End
                  </button>
                </>
              )}
              {session.status === 'ended' && session.recordingStatus === 'none' && (
                <button className={`${styles.btn} ${styles.btnUpload}`} onClick={() => onAction('upload', session)}>
                  <RiUploadLine size={12} /> Upload Rec
                </button>
              )}
              {session.status === 'ended' && session.recordingStatus === 'ready' && (
                <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnWatch}`}>
                  <RiPlayCircleLine size={12} /> View Rec
                </a>
              )}
              {session.status === 'ended' && session.recordingStatus === 'processing' && (
                <span className={`${styles.btn} ${styles.btnProcessing}`}>
                  <RiLoaderLine size={12} className={styles.spin} /> Processing
                </span>
              )}
              {session.status !== 'live' && (
                <button className={`${styles.btn} ${styles.btnDelete}`} onClick={() => onAction('delete', session)}>
                  <RiDeleteBinLine size={12} />
                </button>
              )}
            </>
        }
      </div>
    </div>
  )
}

export default function CourseSessionsPage() {
  const { courseId } = useParams()
  const [course, setCourse] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [uploadTarget, setUploadTarget] = useState(null)
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([getCourse(courseId), getSessions({ courseId })])
      setCourse(c); setSessions(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [courseId])

  useEffect(() => { load() }, [load])

  function showToast(msg, type = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
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
      showToast(action === 'start' ? 'Session is live!' : 'Session ended.')
    } catch (e) { showToast(e.message, 'danger') }
    finally { setBusy(null) }
  }

  const live     = sessions.filter(s => s.status === 'live')
  const upcoming = sessions.filter(s => s.status === 'scheduled')
  const past     = sessions.filter(s => ['ended','cancelled'].includes(s.status))

  return (
    <DashboardShell
      title={course ? `${course.code} — Sessions` : 'Sessions'}
      subtitle={course?.title || ''}
      requiredRole="lecturer"
    >
      {toast && <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>{toast.msg}</div>}
      {showCreate && (
        <CreateModal
          courseId={courseId}
          courseName={course?.title || courseId}
          onClose={() => setShowCreate(false)}
          onCreate={s => { setSessions(prev => [s, ...prev]); showToast('Session scheduled.') }}
        />
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
        <div className={styles.topBar}>
          <Link href={`/lecturer/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to Course
          </Link>
          <button className={styles.addBtn} onClick={() => setShowCreate(true)}>
            <RiAddLine size={15} /> Schedule Session
          </button>
        </div>

        {loading
          ? <div className={styles.loadingState}><RiLoaderLine size={20} className={styles.spin} /> Loading…</div>
          : <>
              {live.length > 0 && (
                <div className={styles.group}>
                  <div className={styles.groupHeader}><RiLiveLine size={14} /><span>Live Now</span><span className={styles.groupCount}>{live.length}</span></div>
                  {live.map(s => <SessionRow key={s.id} session={s} onAction={handleAction} busy={busy} />)}
                </div>
              )}
              <div className={styles.group}>
                <div className={styles.groupHeader}><RiCalendarLine size={14} /><span>Upcoming</span><span className={styles.groupCount}>{upcoming.length}</span></div>
                {upcoming.length === 0
                  ? <div className={styles.groupEmpty}>No upcoming sessions. Schedule one above.</div>
                  : upcoming.map(s => <SessionRow key={s.id} session={s} onAction={handleAction} busy={busy} />)
                }
              </div>
              <div className={styles.group}>
                <div className={styles.groupHeader}><RiTimeLine size={14} /><span>Past</span><span className={styles.groupCount}>{past.length}</span></div>
                {past.length === 0
                  ? <div className={styles.groupEmpty}>No past sessions yet.</div>
                  : past.map(s => <SessionRow key={s.id} session={s} onAction={handleAction} busy={busy} />)
                }
              </div>
            </>
        }
      </div>
    </DashboardShell>
  )
}