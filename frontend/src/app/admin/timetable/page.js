// DESTINATION: src/app/admin/timetable/page.js
'use client'

import { useState, useEffect } from 'react'
import { RiAddLine, RiGridLine, RiListCheck, RiDeleteBinLine } from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { getTimetable, createTimetableSlot, deleteTimetableSlot } from '@/lib/api/timetable'
import { apiGet } from '@/lib/api/client'
import { days, timeSlots } from '@/lib/mock/timetable'
import styles from './timetable.module.css'
import modalStyles from '@/components/ui/Modal.module.css'

const COLORS = ['teal', 'blue', 'purple', 'amber']

const EMPTY_FORM = {
  courseId: '', day: 'Monday',
  startTime: '08:00', endTime: '09:30',
  room: '', cohort: '', color: 'teal',
  lecturerId: '',
}

export default function TimetablePage() {
  const [slots, setSlots]         = useState([])
  const [view, setView]           = useState('grid')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)

  // Dropdown data
  const [courses, setCourses]     = useState([])
  const [lecturers, setLecturers] = useState([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(false)

  useEffect(() => { getTimetable().then(setSlots) }, [])

  // Load courses + lecturers when modal opens (lazy — only once)
  useEffect(() => {
    if (!modalOpen || courses.length > 0) return
    setLoadingDropdowns(true)
    Promise.allSettled([
      apiGet('/api/v1/courses'),
      apiGet('/api/v1/users?role=lecturer'),
    ]).then(([cRes, lRes]) => {
      if (cRes.status === 'fulfilled') {
        setCourses(cRes.value.data || cRes.value.courses || [])
      }
      if (lRes.status === 'fulfilled') {
        setLecturers(lRes.value.data || lRes.value.users || [])
      }
      setLoadingDropdowns(false)
    })
  }, [modalOpen, courses.length])

  const getSlotForCell = (day, time) =>
    slots.find(s => s.day === day && s.startTime === time)

  const handleAdd = async () => {
    if (!form.courseId || !form.day) return
    setSaving(true)
    try {
      const newSlot = await createTimetableSlot(form)
      setSlots(prev => [...prev, newSlot])
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteTimetableSlot(id)
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  // When a course is selected, auto-fill color and title for grid display
  const handleCourseChange = (courseId) => {
    const course = courses.find(c => String(c.id) === String(courseId))
    setForm(f => ({
      ...f,
      courseId,
      // Pre-fill lecturer if course carries one
      lecturerId: course?.lecturerId ? String(course.lecturerId) : f.lecturerId,
    }))
  }

  const uniqueCourses = [...new Map(slots.map(s => [s.courseCode, s])).values()]

  return (
    <DashboardShell title="Timetable" subtitle="Weekly class schedule" requiredRole="admin">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'grid' ? styles.active : ''}`}
              onClick={() => setView('grid')}
            >
              <RiGridLine size={13} style={{ marginRight: 4 }} />Grid
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`}
              onClick={() => setView('list')}
            >
              <RiListCheck size={13} style={{ marginRight: 4 }} />List
            </button>
          </div>
          <button className={styles.addBtn} onClick={() => setModalOpen(true)}>
            <RiAddLine size={16} /> Add Class
          </button>
        </div>

        {/* Grid View */}
        {view === 'grid' && (
          <div className={styles.gridCard}>
            <div className={styles.gridTableWrap}>
              <table className={styles.gridTable}>
                <thead>
                  <tr>
                    <th>Time</th>
                    {days.map(d => <th key={d}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.slice(0, -1).map(time => (
                    <tr key={time}>
                      <td className={styles.timeCell}>{time}</td>
                      {days.map(day => {
                        const slot = getSlotForCell(day, time)
                        return (
                          <td key={day} className={styles.dayCell}>
                            {slot && (
                              <div className={`${styles.classBlock} ${styles[slot.color]}`}>
                                <div className={styles.blockCode}>{slot.courseCode}</div>
                                <div className={styles.blockRoom}>{slot.room}</div>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.legend}>
              {uniqueCourses.map(s => (
                <div key={s.courseCode} className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles[s.color]}`} />
                  {s.courseCode} — {s.courseTitle}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          slots.length === 0 ? (
            <EmptyState
              icon={RiGridLine}
              title="No classes scheduled"
              desc="Add your first class to the timetable."
              actionLabel="Add Class"
              onAction={() => setModalOpen(true)}
            />
          ) : (
            <div className={styles.listCard}>
              <table className={styles.listTable}>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Cohort</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map(slot => (
                    <tr key={slot.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className={`${styles.colorBar} ${styles[slot.color]}`} />
                          <div>
                            <span className={styles.codeTag}>{slot.courseCode}</span>
                            <span style={{ marginLeft: 10, fontWeight: 500 }}>
                              {slot.courseTitle}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{slot.day}</td>
                      <td>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                          {slot.startTime} – {slot.endTime}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{slot.room}</td>
                      <td>
                        {slot.cohort && <Badge label={slot.cohort} color="gray" size="sm" />}
                      </td>
                      <td>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(slot.id)}>
                          <RiDeleteBinLine size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Class to Timetable"
        desc="Schedule a new class session."
        footer={
          <>
            <button className={modalStyles.btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button
              className={modalStyles.btnPrimary}
              onClick={handleAdd}
              disabled={saving || !form.courseId}
            >
              {saving ? 'Adding…' : 'Add Class'}
            </button>
          </>
        }
      >
        {loadingDropdowns ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading courses and lecturers…
          </div>
        ) : (
          <>
            {/* Course dropdown — real data from GET /api/v1/courses */}
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Course</label>
              <select
                className={modalStyles.select}
                value={form.courseId}
                onChange={e => handleCourseChange(e.target.value)}
              >
                <option value="">— Select a course —</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} — ${c.name || c.title}` : (c.name || c.title)}
                  </option>
                ))}
              </select>
            </div>

            {/* Lecturer dropdown — real data from GET /api/v1/users?role=lecturer */}
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Lecturer</label>
              <select
                className={modalStyles.select}
                value={form.lecturerId}
                onChange={e => setForm(f => ({ ...f, lecturerId: e.target.value }))}
              >
                <option value="">— Select a lecturer —</option>
                {lecturers.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>Day</label>
                <select
                  className={modalStyles.select}
                  value={form.day}
                  onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                >
                  {days.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>Room</label>
                <input
                  className={modalStyles.input}
                  placeholder="e.g. LH-101"
                  value={form.room}
                  onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                />
              </div>
            </div>

            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>Start Time</label>
                <input
                  className={modalStyles.input}
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>End Time</label>
                <input
                  className={modalStyles.input}
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className={modalStyles.row}>
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>Cohort</label>
                <input
                  className={modalStyles.input}
                  placeholder="e.g. CS Year 3"
                  value={form.cohort}
                  onChange={e => setForm(f => ({ ...f, cohort: e.target.value }))}
                />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>Color</label>
                <select
                  className={modalStyles.select}
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                >
                  {COLORS.map(c => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </Modal>
    </DashboardShell>
  )
}