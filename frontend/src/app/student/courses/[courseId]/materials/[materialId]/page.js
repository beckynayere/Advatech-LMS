// DESTINATION: src/app/student/courses/[courseId]/materials/[materialId]/page.js
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine,
  RiFileLine, RiFileTextLine, RiVideoLine, RiLinkM, RiCodeBoxLine,
  RiCheckboxCircleLine, RiArrowLeftSLine, RiArrowRightSLine,
  RiExternalLinkLine, RiDownloadLine, RiListUnordered,
  RiTimeLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import { useToast } from '@/lib/ToastContext'
import { getMaterial } from '@/lib/api/materials'
import { getModules, markProgress, getProgress } from '@/lib/api/modules'
import { getNextAndPrevious } from '@/lib/courseNavigation'
import styles from './reader.module.css'
 
// ── Type metadata ─────────────────────────────────────────────────────────────
const TYPE_META = {
  document: { icon: RiFileLine,      label: 'Document',     color: '#2563eb' },
  page:     { icon: RiFileTextLine,  label: 'Lecture Page', color: '#7c3aed' },
  video:    { icon: RiVideoLine,     label: 'Video',        color: '#dc2626' },
  link:     { icon: RiLinkM,         label: 'External Link',color: '#0d9488' },
  embed:    { icon: RiCodeBoxLine,   label: 'Embed',        color: '#d97706' },
}
 
// ── Helpers ───────────────────────────────────────────────────────────────────
function getYoutubeEmbed(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : url
}
 
function countWords(html) {
  if (!html) return 0
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
}
 
function estReadTime(words) {
  return `${Math.max(1, Math.round(words / 200))} min read`
}
 
// Parse h2/h3 headings from HTML for the table of contents
function extractHeadings(html) {
  if (!html) return []
  const matches = [...html.matchAll(/<(h[23])[^>]*>(.*?)<\/h[23]>/gi)]
  return matches.map((m, i) => ({
    id:    `heading-${i}`,
    level: m[1].toLowerCase(),
    text:  m[2].replace(/<[^>]*>/g, '').trim(),
  }))
}
 
// Inject id attributes into headings so ToC links work
function injectHeadingIds(html) {
  if (!html) return html
  let idx = 0
  return html.replace(/<(h[23])([^>]*)>/gi, (_, tag, attrs) => {
    return `<${tag}${attrs} id="heading-${idx++}">`
  })
}
 
// ── Reading progress hook ─────────────────────────────────────────────────────
function useReadingProgress(contentRef) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      const el = contentRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = el.offsetHeight
      const read  = Math.max(0, -rect.top)
      setProgress(Math.min(100, Math.round((read / total) * 100)))
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [contentRef])
  return progress
}
 
// ── ToC component ─────────────────────────────────────────────────────────────
function TableOfContents({ headings, activeId }) {
  if (!headings.length) return null
  return (
    <nav className={styles.toc}>
      <div className={styles.tocTitle}>
        <RiListUnordered size={13} /> Contents
      </div>
      <ul className={styles.tocList}>
        {headings.map(h => (
          <li key={h.id} className={`${styles.tocItem} ${h.level === 'h3' ? styles.tocItemH3 : ''} ${activeId === h.id ? styles.tocItemActive : ''}`}>
            <a href={`#${h.id}`} className={styles.tocLink}>{h.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
 
// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentMaterialReaderPage() {
  const { courseId, materialId } = useParams()
  const toast = useToast()
  const contentRef = useRef(null)
 
  const [material,   setMaterial]   = useState(null)
  const [modules,    setModules]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [completing, setCompleting] = useState(false)
  const [completed,  setCompleted]  = useState(false)
  const [activeHeading, setActiveHeading] = useState(null)
  const [tocOpen,    setTocOpen]    = useState(false)
 
  const readingProgress = useReadingProgress(contentRef)
 
  useEffect(() => {
    Promise.all([
      getMaterial(courseId, materialId),
      getModules(courseId),
      getProgress(courseId),
    ])
      .then(([mat, mods, progressList]) => {
        setMaterial(mat)
        setModules(mods)
        const record = progressList.find(p =>
          (p.itemType === 'material' || p.item_type === 'material') &&
          String(p.itemId ?? p.item_id) === String(materialId)
        )
        if (record?.status === 'completed') setCompleted(true)
      })
      .catch(() => toast.error('Could not load material.'))
      .finally(() => setLoading(false))
  }, [courseId, materialId])
 
  // Fire 'viewed' silently on mount
  useEffect(() => {
    if (!materialId || !courseId) return
    markProgress(courseId, 'material', materialId, 'viewed').catch(() => {})
  }, [courseId, materialId])
 
  // Track active heading for ToC highlighting
  useEffect(() => {
    if (!material?.content) return
    const headingEls = document.querySelectorAll('.readerArticle h2, .readerArticle h3')
    if (!headingEls.length) return
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) { setActiveHeading(e.target.id); break }
        }
      },
      { rootMargin: '-10% 0px -80% 0px' }
    )
    headingEls.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [material])
 
  const handleMarkComplete = async () => {
    if (completing || completed) return
    setCompleting(true)
    try {
      await markProgress(courseId, 'material', materialId, 'completed')
      setCompleted(true)
      toast.success('Marked as complete!')
    } catch { toast.error('Could not save progress.')
    } finally { setCompleting(false) }
  }
 
  const { prev, next } = getNextAndPrevious(modules, materialId, 'material', courseId)
  const meta     = material ? (TYPE_META[material.type] || TYPE_META.document) : TYPE_META.document
  const TypeIcon = meta.icon
 
  // Derived for lecture pages
  const processedContent = material?.type === 'page' ? injectHeadingIds(material.content) : material?.content
  const headings  = material?.type === 'page' ? extractHeadings(material.content) : []
  const wordCount = material?.type === 'page' ? countWords(material.content) : 0
 
  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardShell title="Loading…" requiredRole="student">
        <div className={styles.skeletonPage}>
          {[80, 24, 300, 18, 18, 18, 60].map((h, i) => (
            <div key={i} className={styles.skeletonLine} style={{ height: h, width: i === 0 ? '60%' : i > 3 ? '80%' : '100%' }} />
          ))}
        </div>
      </DashboardShell>
    )
  }
 
  if (!material) {
    return (
      <DashboardShell title="Not Found" requiredRole="student">
        <div className={styles.notFound}>
          Material not found.{' '}
          <Link href={`/student/courses/${courseId}`} className={styles.notFoundLink}>Back to course</Link>
        </div>
      </DashboardShell>
    )
  }
 
  const isPage = material.type === 'page'
 
  return (
    <DashboardShell title={material.title} requiredRole="student">
 
      {/* Reading progress bar */}
      {isPage && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${readingProgress}%` }} />
        </div>
      )}
 
      <div className={styles.page}>
 
        {/* Top nav */}
        <div className={styles.topNav}>
          <Link href={`/student/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to course
          </Link>
          <div className={styles.topNavRight}>
            {isPage && headings.length > 0 && (
              <button className={`${styles.tocToggle} ${tocOpen ? styles.tocToggleActive : ''}`}
                onClick={() => setTocOpen(v => !v)} title="Toggle table of contents">
                <RiListUnordered size={14} /> Contents
              </button>
            )}
            {completed ? (
              <span className={styles.completedBadge}>
                <RiCheckboxCircleLine size={15} /> Completed
              </span>
            ) : (
              <button className={styles.completeBtn} onClick={handleMarkComplete} disabled={completing}>
                <RiCheckboxCircleLine size={15} />
                {completing ? 'Saving…' : 'Mark Complete'}
              </button>
            )}
          </div>
        </div>
 
        {/* Main layout — two columns for lecture pages with ToC */}
        <div className={`${styles.layout} ${isPage && tocOpen && headings.length ? styles.layoutWithToc : ''}`}>
 
          {/* Content card */}
          <div className={styles.contentCard}>
 
            {/* Header */}
            <div className={styles.contentHeader}>
              <div className={styles.headerMeta}>
                <span className={styles.typeChip} style={{ color: meta.color, background: meta.color + '18' }}>
                  <TypeIcon size={12} /> {meta.label}
                </span>
                {isPage && wordCount > 0 && (
                  <span className={styles.readTime}>
                    <RiTimeLine size={12} /> {estReadTime(wordCount)}
                  </span>
                )}
              </div>
              <h1 className={styles.contentTitle}>{material.title}</h1>
              {material.description && (
                <p className={styles.contentDesc}>{material.description}</p>
              )}
            </div>
 
            <div className={styles.contentDivider} />
 
            {/* Body */}
            <div className={styles.contentBody} ref={contentRef}>
 
              {/* LECTURE PAGE */}
              {material.type === 'page' && processedContent && (
                <article
                  className={`${styles.richContent} readerArticle`}
                  dangerouslySetInnerHTML={{ __html: processedContent }}
                />
              )}
              {material.type === 'page' && !material.content && (
                <p className={styles.noContent}>This lecture page has no content yet.</p>
              )}
 
              {/* EMBED */}
              {material.type === 'embed' && material.externalUrl && (
                <div className={styles.embedWrap}>
                  <iframe src={material.externalUrl} className={styles.embedFrame}
                    allowFullScreen title={material.title} />
                </div>
              )}
 
              {/* VIDEO */}
              {material.type === 'video' && material.externalUrl && (
                <div className={styles.videoWrap}>
                  {material.externalUrl.includes('youtube.com') || material.externalUrl.includes('youtu.be') ? (
                    <iframe src={getYoutubeEmbed(material.externalUrl)}
                      className={styles.videoFrame} allowFullScreen
                      allow="autoplay; encrypted-media; picture-in-picture"
                      title={material.title} />
                  ) : (
                    <video controls className={styles.videoPlayer} src={material.externalUrl}>
                      Your browser does not support video.
                    </video>
                  )}
                </div>
              )}
 
              {/* EXTERNAL LINK */}
              {material.type === 'link' && material.externalUrl && (
                <div className={styles.linkCard}>
                  <div className={styles.linkCardIcon}>
                    <RiExternalLinkLine size={28} style={{ color: '#0d9488' }} />
                  </div>
                  <div className={styles.linkCardBody}>
                    <p className={styles.linkCardTitle}>External Resource</p>
                    <p className={styles.linkCardUrl}>{material.externalUrl}</p>
                  </div>
                  <a href={material.externalUrl} target="_blank" rel="noopener noreferrer"
                    className={styles.linkCardBtn}>
                    Open <RiExternalLinkLine size={13} />
                  </a>
                </div>
              )}
 
              {/* DOCUMENT: rich content */}
              {material.type === 'document' && material.content && (
                <article className={styles.richContent}
                  dangerouslySetInnerHTML={{ __html: material.content }} />
              )}
 
              {/* DOCUMENT: file download */}
              {material.type === 'document' && !material.content && material.fileId && material.downloadUrl && (
                <div className={styles.fileCard}>
                  <div className={styles.fileCardIcon}>
                    <RiFileLine size={32} style={{ color: '#2563eb' }} />
                  </div>
                  <div className={styles.fileCardBody}>
                    <p className={styles.fileCardTitle}>{material.title}</p>
                    <p className={styles.fileCardHint}>Click to open or download this file.</p>
                  </div>
                  <a href={material.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className={styles.fileCardBtn}>
                    <RiDownloadLine size={14} /> Download
                  </a>
                </div>
              )}
 
              {/* Fallback */}
              {!material.content && !material.externalUrl && !material.fileId && (
                <p className={styles.noContent}>No content available for this material.</p>
              )}
            </div>
 
            {/* Mark complete — bottom of card */}
            <div className={styles.completeRow}>
              {completed ? (
                <div className={styles.completedRow}>
                  <RiCheckboxCircleLine size={18} /> You completed this material
                </div>
              ) : (
                <button className={styles.completeBtnLg} onClick={handleMarkComplete} disabled={completing}>
                  <RiCheckboxCircleLine size={16} />
                  {completing ? 'Saving…' : 'Mark as Complete'}
                </button>
              )}
            </div>
          </div>
 
          {/* ToC sidebar */}
          {isPage && tocOpen && headings.length > 0 && (
            <aside className={styles.tocSidebar}>
              <TableOfContents headings={headings} activeId={activeHeading} />
            </aside>
          )}
        </div>
 
        {/* Prev / Next nav */}
        {(prev || next) && (
          <div className={styles.navBar}>
            {prev ? (
              <Link href={prev.href} className={styles.navBtn}>
                <RiArrowLeftSLine size={20} className={styles.navIcon} />
                <div className={styles.navBtnText}>
                  <span className={styles.navBtnLabel}>Previous</span>
                  <span className={styles.navBtnTitle}>{prev.title}</span>
                </div>
              </Link>
            ) : <div />}
            {next && (
              <Link href={next.href} className={`${styles.navBtn} ${styles.navBtnNext}`}>
                <div className={styles.navBtnText}>
                  <span className={styles.navBtnLabel}>Next</span>
                  <span className={styles.navBtnTitle}>{next.title}</span>
                </div>
                <RiArrowRightSLine size={20} className={styles.navIcon} />
              </Link>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}