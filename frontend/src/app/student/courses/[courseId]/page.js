// DESTINATION: src/app/student/courses/[courseId]/page.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiFileTextLine, RiEditLine, RiQuestionLine,
  RiLockLine, RiArrowRightLine, RiCheckboxCircleLine,
  RiBookOpenLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { getCourse } from '@/lib/api/courses'
import { getModules, markProgress } from '@/lib/api/modules'
import { itemHref } from '@/lib/courseNavigation'
import styles from './course.module.css'

const QUICK_LINKS = (courseId) => [
  { label: 'Assignments', href: `/student/courses/${courseId}/assignments`, color: 'orange', icon: RiEditLine },
  { label: 'Quizzes',     href: `/student/courses/${courseId}/quiz`,        color: 'blue',   icon: RiQuestionLine },
  { label: 'Materials',   href: `/student/courses/${courseId}/materials`,   color: 'teal',   icon: RiFileTextLine },
]

const ITEM_ICONS = {
  material:   RiFileTextLine,
  assignment: RiEditLine,
  quiz:       RiQuestionLine,
}

// Visual type indicator colour per content type
const TYPE_INDICATOR = {
  material:   '#2563eb',   // blue
  assignment: '#d97706',   // amber
  quiz:       '#16a34a',   // green
}

const TYPE_LABEL = {
  material:   'Reading',
  assignment: 'Assignment',
  quiz:       'Quiz',
}

export default function StudentCourseDetailPage() {
  const { courseId } = useParams()
  const [course,   setCourse]   = useState(null)
  const [modules,  setModules]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    Promise.all([getCourse(courseId), getModules(courseId)])
      .then(([c, mods]) => {
        setCourse(c)
        setModules(mods)
        // Auto-expand first published module that has items
        const first = mods.find(m => m.isPublished && m.items?.length > 0) || mods.find(m => m.items?.length > 0)
        if (first) setExpanded({ [first.id]: true })
      })
      .finally(() => setLoading(false))
  }, [courseId])

  // Progress helpers
  const getItemStatus  = (item) => item.progress?.status || null
  const isCompleted    = (item) => getItemStatus(item) === 'completed'
  const isViewed       = (item) => !!getItemStatus(item)
  const countCompleted = (items) => items.filter(isCompleted).length

  if (loading) {
    return (
      <DashboardShell title="Loading…" requiredRole="student">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 4 }}>
          <Skeleton height={80} style={{ borderRadius: 14 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[1,2,3].map(i => <Skeleton key={i} height={72} style={{ borderRadius: 12 }} />)}
          </div>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </DashboardShell>
    )
  }

  if (!course) {
    return (
      <DashboardShell title="Not Found" requiredRole="student">
        <EmptyState icon={RiFileTextLine} title="Course not found" desc="This course doesn't exist or you're not enrolled." />
      </DashboardShell>
    )
  }

  const allItems    = modules.flatMap(m => m.items ?? [])
  const totalItems  = allItems.length
  const totalDone   = allItems.filter(isCompleted).length
  const progressPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

  // Only show modules that are published AND have at least one item
  const visibleModules = modules.filter(m => m.isPublished && (m.items?.length ?? 0) > 0)

  return (
    <DashboardShell
      title={course.title}
      subtitle={[course.code, course.lecturerName].filter(Boolean).join(' · ')}
      requiredRole="student"
    >
      <div className={styles.page}>
        {/* Info bar */}
        <div className={styles.infoBar}>
          <div className={`${styles.colorMark} ${styles[course.color] || styles.teal}`}>
            {course.code}
          </div>
          <div className={styles.titleWrap}>
            <div className={styles.title}>{course.title}</div>
            <div className={styles.sub}>
              {[course.cohort, course.semester, course.department].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className={styles.stats}>
            {[
              { label: 'Modules',  value: visibleModules.length },
              { label: 'Credits',  value: course.credits },
              { label: 'Progress', value: `${progressPct}%` },
            ].map(s => (
              <div key={s.label} className={styles.stat}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {totalItems > 0 && (
          <div className={styles.progressBarWrap}>
            <div className={styles.progressBarLabel}>
              Course progress · {totalDone} of {totalItems} items completed
            </div>
            <div className={styles.progressBarTrack}>
              <div className={styles.progressBarFill} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className={styles.quickLinks}>
          {QUICK_LINKS(courseId).map(l => (
            <Link key={l.href} href={l.href} className={styles.quickLink}>
              <div className={`${styles.qlIcon} ${styles[l.color]}`}><l.icon size={18} /></div>
              <span className={styles.qlLabel}>{l.label}</span>
            </Link>
          ))}
        </div>

        {/* Modules accordion */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <RiBookOpenLine size={16} style={{ marginRight: 6 }} />
            Course Content
          </div>
          {visibleModules.length === 0 ? (
            <EmptyState
              icon={RiBookOpenLine}
              title="No modules yet"
              desc="Your lecturer hasn't published any content for this course yet. Check back soon."
            />
          ) : (
            <div className={styles.moduleList}>
              {visibleModules.map((mod, modIdx) => {
                const isOpen      = !!expanded[mod.id]
                const completed   = countCompleted(mod.items)
                const total       = mod.items.length
                const modProgress = total > 0 ? Math.round((completed / total) * 100) : 0

                return (
                  <div key={mod.id} className={styles.moduleBlock}>
                    <div
                      className={styles.moduleHeader}
                      onClick={() => setExpanded(p => ({ ...p, [mod.id]: !isOpen }))}
                    >
                      <div className={styles.moduleLeft}>
                        <span className={styles.moduleNum}>{modIdx + 1}</span>
                        <div className={styles.moduleTitleWrap}>
                          <span className={styles.moduleTitle}>{mod.title}</span>
                          {mod.description && (
                            <span className={styles.moduleDesc}>{mod.description}</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.moduleRight}>
                        <span className={styles.modProgressText}>
                          {completed}/{total} done
                        </span>
                        <div className={styles.modProgressBar}>
                          <div
                            className={styles.modProgressFill}
                            style={{ width: `${modProgress}%` }}
                          />
                        </div>
                        <span className={styles.chevron} style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                          ›
                        </span>
                      </div>
                    </div>

                    {isOpen && (
                      <div className={styles.moduleItems}>
                        {mod.items.map((item, itemIdx) => {
                          const Icon   = ITEM_ICONS[item.type] || RiFileTextLine
                          const locked = item.isLocked
                          const viewed = isViewed(item)
                          const done   = isCompleted(item)
                          const href   = itemHref(courseId, item)   // ← deep link

                          return (
                            <Link
                              key={item.id}
                              href={locked ? '#' : href}
                              className={`${styles.itemRow} ${locked ? styles.itemLocked : ''} ${done ? styles.itemDone : ''}`}
                              onClick={e => {
                                if (locked) e.preventDefault()
                                // Do NOT fire markProgress here — moved to the reader page
                              }}
                            >
                              {/* Coloured left indicator bar */}
                              <span
                                className={styles.typeIndicator}
                                style={{ background: TYPE_INDICATOR[item.type] || '#64748b' }}
                              />

                              <span className={styles.itemOrder}>{itemIdx + 1}</span>

                              <span className={`${styles.itemIcon} ${styles[item.type]}`}>
                                {locked ? <RiLockLine size={14} /> : <Icon size={14} />}
                              </span>

                              <span className={styles.itemTitle}>
                                {item.title || item.ref?.title || `${item.type} #${item.refId}`}
                              </span>

                              {/* Type label pill */}
                              <span
                                className={styles.typeLabel}
                                style={{
                                  color: TYPE_INDICATOR[item.type],
                                  background: TYPE_INDICATOR[item.type] + '18',
                                }}
                              >
                                {TYPE_LABEL[item.type] || item.type}
                              </span>

                              <span className={styles.itemMeta}>
                                {item.type === 'assignment' && item.ref?.dueDate && (
                                  <span className={styles.dueDate}>
                                    Due {new Date(item.ref.dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                                {item.type === 'quiz' && item.ref?.timeLimitMins && (
                                  <span className={styles.quizTime}>{item.ref.timeLimitMins} min</span>
                                )}
                              </span>

                              <span className={styles.itemStatus}>
                                {locked ? (
                                  <Badge label="Locked" color="gray" size="xs" />
                                ) : done ? (
                                  <RiCheckboxCircleLine size={16} className={styles.doneIcon} />
                                ) : viewed ? (
                                  <Badge label="In Progress" color="blue" size="xs" />
                                ) : (
                                  <RiArrowRightLine size={16} className={styles.goIcon} />
                                )}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}