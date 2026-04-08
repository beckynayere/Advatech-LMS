// DESTINATION: src/app/student/courses/[courseId]/materials/page.js
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine, RiFileLine, RiVideoLine,
  RiLinkM, RiCodeBoxLine, RiLockLine, RiDownloadLine,
  RiExternalLinkLine, RiBook2Line, RiCalendarLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/lib/ToastContext'
import { getMaterials, getMaterial } from '@/lib/api/materials'
import styles from './materials.module.css'

const TYPE_META = {
  document: { icon: RiFileLine,     label: 'Document',  color: '#2563eb' },
  video:    { icon: RiVideoLine,    label: 'Video',     color: '#7c3aed' },
  link:     { icon: RiLinkM,        label: 'Link',      color: '#0d9488' },
  embed:    { icon: RiCodeBoxLine,  label: 'Embed',     color: '#d97706' },
}

function groupByWeek(materials) {
  const groups = {}
  const noWeek = []
  for (const m of materials) {
    if (m.weekNumber) {
      if (!groups[m.weekNumber]) groups[m.weekNumber] = []
      groups[m.weekNumber].push(m)
    } else {
      noWeek.push(m)
    }
  }
  return { groups, noWeek }
}

export default function StudentMaterialsPage() {
  const { courseId } = useParams()
  const router = useRouter()
  const toast  = useToast()

  const [materials,    setMaterials]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [downloading,  setDownloading]  = useState({})

  useEffect(() => {
    getMaterials(courseId)
      .then(setMaterials)
      .finally(() => setLoading(false))
  }, [courseId])

  const handleOpen = async (material) => {
    if (material.isLocked) return

    // External links open in new tab immediately
    if (material.type === 'link' && material.externalUrl) {
      window.open(material.externalUrl, '_blank', 'noopener')
      return
    }

    // File downloads — get presigned URL then open
    if (material.fileId) {
      if (downloading[material.id]) return
      setDownloading(prev => ({ ...prev, [material.id]: true }))
      try {
        const full = await getMaterial(courseId, material.id)
        if (full.downloadUrl) {
          window.open(full.downloadUrl, '_blank', 'noopener')
        } else {
          toast.error('Download link not available.')
        }
      } catch (e) {
        toast.error(e.message || 'Could not get download link.')
      } finally {
        setDownloading(prev => ({ ...prev, [material.id]: false }))
      }
      return
    }

    // Everything else (video/embed/text) → navigate to full-page reader
    router.push(`/student/courses/${courseId}/materials/${material.id}`)
  }

  const { groups, noWeek } = groupByWeek(materials)
  const weekNumbers = Object.keys(groups).map(Number).sort((a, b) => a - b)

  const renderMaterial = (m) => {
    const meta   = TYPE_META[m.type] || TYPE_META.document
    const locked = m.isLocked && (!m.unlockDate || new Date() < new Date(m.unlockDate))

    return (
      <div
        key={m.id}
        className={`${styles.materialRow} ${locked ? styles.materialLocked : ''}`}
        onClick={() => !locked && handleOpen(m)}
        role={locked ? 'listitem' : 'button'}
        tabIndex={locked ? -1 : 0}
        onKeyDown={e => !locked && e.key === 'Enter' && handleOpen(m)}
      >
        <div className={styles.materialIcon} style={{ background: meta.color + '15' }}>
          <meta.icon size={18} style={{ color: meta.color }} />
        </div>
        <div className={styles.materialInfo}>
          <div className={styles.materialTitle}>
            {locked && <RiLockLine size={13} className={styles.lockIcon} />}
            {m.title}
          </div>
          {m.description && <div className={styles.materialDesc}>{m.description}</div>}
          {locked && m.unlockDate && (
            <div className={styles.unlockDate}>
              <RiCalendarLine size={12} />
              Available from {new Date(m.unlockDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
        <div className={styles.materialAction}>
          {locked ? (
            <span className={styles.lockedBadge}><RiLockLine size={11} /> Locked</span>
          ) : downloading[m.id] ? (
            <span className={styles.loadingDot} />
          ) : m.type === 'link' ? (
            <span className={styles.actionChip}><RiExternalLinkLine size={12} /> Open</span>
          ) : m.fileId ? (
            <span className={styles.actionChip}><RiDownloadLine size={12} /> Download</span>
          ) : (
            <span className={styles.actionChip}>View</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <DashboardShell title="Course Materials" requiredRole="student">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/student/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to course
          </Link>
          <div className={styles.totalCount}>{materials.length} item{materials.length !== 1 ? 's' : ''}</div>
        </div>

        {loading ? (
          <SkeletonCard count={5} />
        ) : materials.length === 0 ? (
          <EmptyState
            icon={RiBook2Line}
            title="No materials yet"
            desc="Your lecturer hasn't uploaded any course materials yet."
          />
        ) : (
          <div className={styles.content}>
            {weekNumbers.map(week => (
              <div key={week} className={styles.weekSection}>
                <div className={styles.weekHeader}>
                  <span className={styles.weekLabel}>Week {week}</span>
                  <span className={styles.weekCount}>{groups[week].length} item{groups[week].length !== 1 ? 's' : ''}</span>
                </div>
                <div className={styles.materialList}>
                  {groups[week].map(renderMaterial)}
                </div>
              </div>
            ))}
            {noWeek.length > 0 && (
              <div className={styles.weekSection}>
                {weekNumbers.length > 0 && (
                  <div className={styles.weekHeader}>
                    <span className={styles.weekLabel}>General Materials</span>
                    <span className={styles.weekCount}>{noWeek.length} item{noWeek.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className={styles.materialList}>
                  {noWeek.map(renderMaterial)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Popup viewer has been removed — content opens in full-page reader */}
    </DashboardShell>
  )
}