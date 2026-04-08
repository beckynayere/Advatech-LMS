'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  RiArrowLeftLine,
  RiSaveLine,
  RiSettings3Line,
  RiCloseLine,
  RiEyeLine,
  RiLockLine,
} from 'react-icons/ri'
import RichTextEditor from './RichTextEditor'
import styles from './PageEditor.module.css'
 
// count words in HTML string
function countWords(html) {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').filter(Boolean).length
}
 
function estReadTime(words) {
  const mins = Math.max(1, Math.round(words / 200))
  return `${mins} min read`
}
 
export default function PageEditor({
  open,
  onClose,
  onSave,
  initialData = {},
  saving = false,
  courseId,
}) {
  const [title,       setTitle]      = useState('')
  const [description, setDesc]       = useState('')
  const [content,     setContent]    = useState('')
  const [weekNumber,  setWeekNumber] = useState('')
  const [isVisible,   setIsVisible]  = useState(true)
  const [isLocked,    setIsLocked]   = useState(false)
  const [unlockDate,  setUnlockDate] = useState('')
  const [metaOpen,    setMetaOpen]   = useState(false)
  const [savedOnce,   setSavedOnce]  = useState(false)
 
  // Populate fields when editing an existing page
  useEffect(() => {
    if (open) {
      setTitle(initialData.title || '')
      setDesc(initialData.description || '')
      setContent(initialData.content || '')
      setWeekNumber(initialData.weekNumber != null ? String(initialData.weekNumber) : '')
      setIsVisible(initialData.isVisible ?? true)
      setIsLocked(initialData.isLocked ?? false)
      setUnlockDate(
        initialData.unlockDate
          ? new Date(initialData.unlockDate).toISOString().slice(0, 16)
          : ''
      )
      setSavedOnce(false)
    }
  }, [open, initialData.id]) // reset only when opening a different item
 
  // Block browser back/close while editor is open
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [open])
 
  const wordCount = countWords(content)
 
  const handleSave = useCallback(() => {
    onSave({
      title:       title.trim(),
      description: description.trim() || null,
      content,
      weekNumber:  weekNumber ? Number(weekNumber) : null,
      isVisible,
      isLocked,
      unlockDate:  isLocked && unlockDate ? new Date(unlockDate).toISOString() : null,
    })
    setSavedOnce(true)
  }, [title, description, content, weekNumber, isVisible, isLocked, unlockDate, onSave])
 
  // Ctrl+S keyboard shortcut
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleSave])
 
  if (!open) return null
 
  // Status label
  let statusClass = styles.statusDraft
  let statusLabel = 'Unsaved'
  if (saving) { statusClass = styles.statusSaving; statusLabel = 'Saving…' }
  else if (savedOnce) { statusClass = styles.statusSaved; statusLabel = 'Saved' }
 
  return (
    <div className={styles.overlay}>
 
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button className={styles.closeBtn} onClick={onClose}>
            <RiArrowLeftLine size={14} />
            Back
          </button>
          <div className={styles.titleDivider} />
          <input
            className={styles.titleInput}
            placeholder="Page title…"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={255}
          />
        </div>
 
        <div className={styles.topBarRight}>
          <span className={`${styles.statusPill} ${statusClass}`}>
            <span className={`${styles.dot} ${saving ? styles.dotPulse : ''}`} />
            {statusLabel}
          </span>
 
          <button
            className={`${styles.metaToggle} ${metaOpen ? styles.metaToggleActive : ''}`}
            onClick={() => setMetaOpen(v => !v)}
            title="Page settings"
          >
            <RiSettings3Line size={14} />
            Settings
          </button>
 
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            <RiSaveLine size={14} />
            {saving ? 'Saving…' : 'Save Page'}
          </button>
        </div>
      </div>
 
      {/* ── Body ── */}
      <div className={styles.body}>
 
        {/* ── Settings panel ── */}
        {metaOpen && (
          <aside className={styles.metaPanel}>
            <div className={styles.metaPanelTitle}>Page Settings</div>
 
            <div className={styles.metaSection}>
              <label className={styles.metaLabel}>Description</label>
              <textarea
                className={styles.metaTextarea}
                placeholder="Brief description shown to students before they open the page…"
                value={description}
                onChange={e => setDesc(e.target.value)}
                rows={3}
              />
            </div>
 
            <div className={styles.metaSection}>
              <label className={styles.metaLabel}>Week Number</label>
              <input
                className={styles.metaInput}
                type="number"
                min="1"
                max="52"
                placeholder="e.g. 3"
                value={weekNumber}
                onChange={e => setWeekNumber(e.target.value)}
              />
              <p className={styles.metaHint}>Groups this page under a week in the materials list.</p>
            </div>
 
            <div className={styles.metaSection}>
              <label className={styles.metaLabel}>Visibility</label>
              <label className={styles.metaCheckRow}>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={e => setIsVisible(e.target.checked)}
                />
                <RiEyeLine size={13} />
                Visible to students
              </label>
              <label className={styles.metaCheckRow} style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={e => setIsLocked(e.target.checked)}
                />
                <RiLockLine size={13} />
                Lock until a date
              </label>
              {isLocked && (
                <input
                  className={styles.metaInput}
                  style={{ marginTop: 8 }}
                  type="datetime-local"
                  value={unlockDate}
                  onChange={e => setUnlockDate(e.target.value)}
                />
              )}
            </div>
 
            <div className={styles.metaSection}>
              <label className={styles.metaLabel}>Keyboard Shortcuts</label>
              <p className={styles.metaHint}>
                <strong>Ctrl+S</strong> — Save page<br />
                <strong>Ctrl+B</strong> — Bold<br />
                <strong>Ctrl+I</strong> — Italic<br />
                <strong>Ctrl+U</strong> — Underline<br />
                <strong>Ctrl+Z</strong> — Undo<br />
                <strong>Ctrl+Shift+Z</strong> — Redo
              </p>
            </div>
          </aside>
        )}
 
        {/* ── Editor column ── */}
        <div className={styles.editorCol}>
          <div className={styles.editorScroll}>
            <div className={styles.editorPaper}>
              <RichTextEditor
                key={`page-editor-${initialData.id ?? 'new'}`}
                content={content}
                onChange={setContent}
                minHeight={560}
                placeholder="Start writing your lecture content… Use headings to structure your page, lists to organise ideas, and the toolbar above to format text."
                fullPage
              />
            </div>
          </div>
 
          {/* Word count bar */}
          <div className={styles.wordCountBar}>
            <span className={styles.wordCountItem}>{wordCount} words</span>
            <span className={styles.wordCountItem}>{estReadTime(wordCount)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}