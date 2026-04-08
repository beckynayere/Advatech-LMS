// DESTINATION: src/app/student/timetable/page.js
'use client'

import { useState, useEffect } from 'react'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { useAuthContext } from '@/lib/context/AuthContext'
import { getTimetable } from '@/lib/api/timetable'
import { RiCalendarLine } from 'react-icons/ri'
import styles from './timetable.module.css'

// These are static constants — no need to import from mock
const DAYS       = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']

export default function StudentTimetablePage() {
  const { user } = useAuthContext()
  const [slots, setSlots]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getTimetable()
      .then(setSlots)
      .finally(() => setLoading(false))
  }, [user])

  const getSlot = (day, time) =>
    slots.find(s => s.day === day && s.startTime === time)

  return (
    <DashboardShell title="Timetable" subtitle="Your weekly class schedule" requiredRole="student">
      <div className={styles.page}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton height={200} style={{ borderRadius: 14 }} />
            <Skeleton variant="card" />
          </div>
        ) : slots.length === 0 ? (
          <EmptyState
            icon={RiCalendarLine}
            title="No timetable yet"
            desc="Your class schedule will appear here once it's been set up by your institution."
          />
        ) : (
          <>
            {/* Grid view */}
            <div className={styles.card}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      {DAYS.map(d => <th key={d}>{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.slice(0, -1).map(time => (
                      <tr key={time}>
                        <td className={styles.timeCell}>{time}</td>
                        {DAYS.map(day => {
                          const slot = getSlot(day, time)
                          return (
                            <td key={day} className={styles.dayCell}>
                              {slot && (
                                <div className={`${styles.classBlock} ${styles[slot.color] || styles.teal}`}>
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
            </div>

            {/* List view */}
            <div className={styles.listCard}>
              {slots.map(slot => (
                <div key={slot.id} className={styles.listRow}>
                  <div className={`${styles.listColorBar} ${styles[slot.color] || styles.teal}`} />
                  <div className={styles.listInfo}>
                    <div className={styles.listTitle}>{slot.courseTitle}</div>
                    <div className={styles.listMeta}>
                      {[slot.day, slot.startTime && slot.endTime && `${slot.startTime}–${slot.endTime}`, slot.room].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <Badge label={slot.courseCode} color="gray" size="sm" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}