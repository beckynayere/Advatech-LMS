'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine, RiAddLine, RiFileLine, RiVideoLine,
  RiLinkM, RiCodeBoxLine, RiArticleLine,
  RiDeleteBinLine, RiUploadLine, RiBook2Line,
  RiEyeLine, RiEyeOffLine, RiLockLine, RiLockUnlockLine, RiEditLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import RichTextEditor from '@/components/ui/RichTextEditor'
import PageEditor from '@/components/ui/PageEditor'
import { useToast } from '@/lib/ToastContext'
import { getMaterials, createMaterial, updateMaterial, deleteMaterial } from '@/lib/api/materials'
import { getCourse } from '@/lib/api/courses'
import styles from './materials.module.css'
import modalStyles from '@/components/ui/Modal.module.css'
 
const TYPE_OPTIONS = [
  { value: 'document', label: 'Document',     icon: RiFileLine,    hint: 'Upload a PDF/DOCX or write plain text content' },
  { value: 'page',     label: 'Lecture Page', icon: RiArticleLine, hint: 'Full-screen rich editor — headings, images, lists' },
  { value: 'video',    label: 'Video',        icon: RiVideoLine,   hint: 'YouTube or direct video URL' },
  { value: 'link',     label: 'External Link',icon: RiLinkM,       hint: 'Link to any external resource' },
  { value: 'embed',    label: 'Embed',        icon: RiCodeBoxLine, hint: 'iFrame embed (Google Slides, Padlet…)' },
]
const TYPE_COLORS = { document: '#2563eb', page: '#7c3aed', video: '#dc2626', link: '#0d9488', embed: '#d97706' }
 
function buildBlankForm(schoolId = 1) {
  return { title: '', description: '', type: 'document', externalUrl: '', content: '', weekNumber: '', isLocked: false, unlockDate: '', isVisible: true, schoolId: String(schoolId) }
}
function isHtmlEmpty(html) {
  if (!html) return true
  return html.replace(/<[^>]*>/g, '').trim().length === 0
}
 
export default function LecturerMaterialsPage() {
  const { courseId } = useParams()
  const toast        = useToast()
  const fileInputRef = useRef(null)
 
  const [materials,      setMaterials]     = useState([])
  const [loading,        setLoading]       = useState(true)
  const [courseSchoolId, setSchoolId]      = useState(1)
 
  // Regular modal state (non-page types)
  const [modalOpen,       setModalOpen]    = useState(false)
  const [editingMaterial, setEditing]      = useState(null)
  const [saving,          setSaving]       = useState(false)
  const [form,            setForm]         = useState(buildBlankForm(1))
  const [selectedFile,    setFile]         = useState(null)
 
  // Page editor state
  const [pageEditorOpen,  setPageEditorOpen] = useState(false)
  const [editingPage,     setEditingPage]    = useState(null)
  const [savingPage,      setSavingPage]     = useState(false)
 
  const [deleting, setDeleting] = useState(null)
  const [toggling, setToggling] = useState({})
 
  useEffect(() => {
    Promise.allSettled([getMaterials(courseId), getCourse(courseId)])
      .then(([matsRes, courseRes]) => {
        if (matsRes.status === 'fulfilled')  setMaterials(matsRes.value)
        if (courseRes.status === 'fulfilled' && courseRes.value) setSchoolId(courseRes.value.schoolId ?? 1)
      })
      .finally(() => setLoading(false))
  }, [courseId])
 
  // ── Open handlers ────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditing(null); setForm(buildBlankForm(courseSchoolId)); setFile(null); setModalOpen(true)
  }
  const switchToPageEditor = () => {
    setModalOpen(false); setEditingPage(null); setPageEditorOpen(true)
  }
  const openPageEditor = (m) => { setEditingPage(m); setPageEditorOpen(true) }
  const openEditModal  = (m) => {
    setEditing(m)
    setForm({
      title: m.title, description: m.description || '', type: m.type,
      externalUrl: m.externalUrl || '', content: m.content || '',
      weekNumber: m.weekNumber != null ? String(m.weekNumber) : '',
      isLocked: m.isLocked ?? false,
      unlockDate: m.unlockDate ? new Date(m.unlockDate).toISOString().slice(0, 16) : '',
      isVisible: m.isVisible ?? true, schoolId: String(courseSchoolId),
    })
    setFile(null); setModalOpen(true)
  }
  const handleEdit  = (m) => m.type === 'page' ? openPageEditor(m) : openEditModal(m)
  const closeModal  = () => { setModalOpen(false); setEditing(null) }
 
  // ── Save — page editor ───────────────────────────────────────────────────
  const handleSavePage = async (pageForm) => {
    if (!pageForm.title.trim()) { toast.warning('Title is required.'); return }
    if (isHtmlEmpty(pageForm.content)) { toast.warning('Page content cannot be empty.'); return }
    setSavingPage(true)
    try {
      const payload = {
        title: pageForm.title.trim(), description: pageForm.description || null,
        type: 'page', content: pageForm.content,
        weekNumber: pageForm.weekNumber || null,
        isLocked: pageForm.isLocked, unlockDate: pageForm.unlockDate || null,
        isVisible: pageForm.isVisible, externalUrl: null,
        sortOrder: editingPage ? (editingPage.sortOrder ?? 0) : materials.length,
        schoolId: courseSchoolId || 1,
      }
      if (editingPage) {
        const updated = await updateMaterial(courseId, editingPage.id, payload)
        setMaterials(prev => prev.map(x => String(x.id) === String(editingPage.id) ? updated : x))
        toast.success(`"${pageForm.title}" updated.`)
      } else {
        const newM = await createMaterial(courseId, payload)
        setMaterials(prev => [...prev, newM])
        toast.success(`"${pageForm.title}" created.`)
      }
      setPageEditorOpen(false); setEditingPage(null)
    } catch (e) { toast.error(e.message || 'Failed to save page.')
    } finally { setSavingPage(false) }
  }
 
  // ── Save — regular modal ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { toast.warning('Title is required.'); return }
    if (['video', 'link', 'embed'].includes(form.type) && !form.externalUrl.trim()) { toast.warning('URL is required.'); return }
    if (form.type === 'document' && !editingMaterial && !selectedFile && isHtmlEmpty(form.content)) { toast.warning('Upload a file or write some content.'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(), description: form.description.trim() || null,
        type: form.type, externalUrl: form.externalUrl.trim() || null,
        content: isHtmlEmpty(form.content) ? null : form.content,
        weekNumber: form.weekNumber ? Number(form.weekNumber) : null,
        isLocked: form.isLocked,
        unlockDate: form.isLocked && form.unlockDate ? new Date(form.unlockDate).toISOString() : null,
        isVisible: form.isVisible,
        sortOrder: editingMaterial ? (editingMaterial.sortOrder ?? 0) : materials.length,
        schoolId: Number(form.schoolId) || courseSchoolId || 1,
      }
      if (editingMaterial) {
        const updated = await updateMaterial(courseId, editingMaterial.id, payload)
        setMaterials(prev => prev.map(x => String(x.id) === String(editingMaterial.id) ? updated : x))
        toast.success(`"${form.title}" updated.`)
      } else {
        const newM = await createMaterial(courseId, payload, selectedFile || null)
        setMaterials(prev => [...prev, newM])
        toast.success(`"${form.title}" added.`)
      }
      closeModal()
    } catch (e) { toast.error(e.message || 'Failed to save material.')
    } finally { setSaving(false) }
  }
 
  const handleDelete = async (m) => {
    try {
      await deleteMaterial(courseId, m.id)
      setMaterials(prev => prev.filter(x => x.id !== m.id))
      setDeleting(null); toast.success('Material deleted.')
    } catch (e) { toast.error(e.message || 'Could not delete material.') }
  }
 
  const handleToggleVisible = async (m) => {
    if (toggling[m.id]) return
    setToggling(prev => ({ ...prev, [m.id]: true }))
    try {
      await updateMaterial(courseId, m.id, { isVisible: !m.isVisible })
      setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, isVisible: !x.isVisible } : x))
    } catch (e) { toast.error(e.message || 'Could not update.')
    } finally { setToggling(prev => ({ ...prev, [m.id]: false })) }
  }
  const handleToggleLock = async (m) => {
    if (toggling[m.id]) return
    setToggling(prev => ({ ...prev, [m.id]: true }))
    try {
      await updateMaterial(courseId, m.id, { isLocked: !m.isLocked })
      setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, isLocked: !x.isLocked } : x))
    } catch (e) { toast.error(e.message || 'Could not update.')
    } finally { setToggling(prev => ({ ...prev, [m.id]: false })) }
  }
 
  // Group by week
  const weeks = {}; const noWeek = []
  for (const m of materials) {
    if (m.weekNumber) { if (!weeks[m.weekNumber]) weeks[m.weekNumber] = []; weeks[m.weekNumber].push(m) }
    else noWeek.push(m)
  }
  const weekNums = Object.keys(weeks).map(Number).sort((a, b) => a - b)
 
  const renderRow = (m) => {
    const color    = TYPE_COLORS[m.type] || '#64748b'
    const TypeIcon = TYPE_OPTIONS.find(t => t.value === m.type)?.icon || RiFileLine
    let preview = null
    if (m.externalUrl) preview = m.externalUrl.slice(0, 55) + (m.externalUrl.length > 55 ? '…' : '')
    else if (m.type === 'page' && m.content) preview = 'Rich page content'
    else if (m.content) preview = 'Text content'
    else if (m.fileId)  preview = 'File uploaded'
 
    return (
      <div key={m.id} className={`${styles.row} ${!m.isVisible ? styles.rowHidden : ''}`}>
        <div className={styles.rowIcon} style={{ background: color + '15' }}>
          <TypeIcon size={18} style={{ color }} />
        </div>
        <div className={styles.rowInfo}>
          <div className={styles.rowTitle}>{m.title}</div>
          {m.description && <div className={styles.rowDesc}>{m.description}</div>}
          <div className={styles.rowMeta}>
            <span className={styles.typeTag} style={{ color, background: color + '12' }}>
              {m.type === 'page' ? 'Lecture Page' : m.type}
            </span>
            {preview && <span className={styles.urlPreview}>{preview}</span>}
            {!m.isVisible && <span className={styles.hiddenTag}>Hidden</span>}
            {m.isLocked  && <span className={styles.lockedTag}>Locked</span>}
          </div>
        </div>
        <div className={styles.rowActions}>
          <button className={styles.actionBtn} onClick={() => handleEdit(m)} title={m.type === 'page' ? 'Open page editor' : 'Edit'}>
            <RiEditLine size={14} />
          </button>
          <button className={`${styles.actionBtn} ${!m.isVisible ? styles.actionBtnMuted : ''}`}
            onClick={() => handleToggleVisible(m)} disabled={toggling[m.id]}
            title={m.isVisible ? 'Hide' : 'Show'}>
            {m.isVisible ? <RiEyeLine size={14} /> : <RiEyeOffLine size={14} />}
          </button>
          <button className={`${styles.actionBtn} ${m.isLocked ? styles.actionBtnLock : ''}`}
            onClick={() => handleToggleLock(m)} disabled={toggling[m.id]}
            title={m.isLocked ? 'Unlock' : 'Lock'}>
            {m.isLocked ? <RiLockLine size={14} /> : <RiLockUnlockLine size={14} />}
          </button>
          <button className={`${styles.actionBtn} ${styles.actionBtnDel}`} onClick={() => setDeleting(m)} title="Delete">
            <RiDeleteBinLine size={14} />
          </button>
        </div>
      </div>
    )
  }
 
  return (
    <DashboardShell title="Course Materials" requiredRole="lecturer">
 
      {/* Full-screen Page Editor */}
      <PageEditor
        open={pageEditorOpen}
        onClose={() => { setPageEditorOpen(false); setEditingPage(null) }}
        onSave={handleSavePage}
        initialData={editingPage || {}}
        saving={savingPage}
        courseId={courseId}
      />
 
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/lecturer/courses/${courseId}`} className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Back to course
          </Link>
          <button className={styles.addBtn} onClick={openAddModal}>
            <RiAddLine size={15} /> Add Material
          </button>
        </div>
 
        {loading ? <SkeletonCard count={5} /> : materials.length === 0 ? (
          <EmptyState icon={RiBook2Line} title="No materials yet"
            desc="Upload PDFs, create lecture pages, share links — all in one place."
            actionLabel="Add Material" onAction={openAddModal} />
        ) : (
          <div className={styles.content}>
            {weekNums.map(week => (
              <div key={week} className={styles.section}>
                <div className={styles.sectionHeader}>Week {week}</div>
                {weeks[week].map(renderRow)}
              </div>
            ))}
            {noWeek.length > 0 && (
              <div className={styles.section}>
                {weekNums.length > 0 && <div className={styles.sectionHeader}>General</div>}
                {noWeek.map(renderRow)}
              </div>
            )}
          </div>
        )}
      </div>
 
      {/* ── Add / Edit Modal (non-page types) ── */}
      <Modal open={modalOpen} onClose={closeModal}
        title={editingMaterial ? `Edit: ${editingMaterial.title}` : 'Add Course Material'}>
 
        {!editingMaterial && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Material Type</label>
            <div className={styles.typeGrid}>
              {TYPE_OPTIONS.map(t => (
                <button key={t.value} type="button"
                  className={`${styles.typeCard} ${form.type === t.value ? styles.typeCardActive : ''}`}
                  onClick={() => { if (t.value === 'page') { switchToPageEditor(); return } setForm(f => ({ ...f, type: t.value, content: '', externalUrl: '' })) }}
                  style={form.type === t.value ? { borderColor: TYPE_COLORS[t.value], color: TYPE_COLORS[t.value], background: TYPE_COLORS[t.value] + '10' } : {}}
                >
                  <t.icon size={20} style={{ color: TYPE_COLORS[t.value] }} />
                  <span>{t.label}</span>
                  {t.value === 'page' && <span className={styles.typeCardBadge}>Full editor ↗</span>}
                </button>
              ))}
            </div>
            <div className={styles.typeHint}>{TYPE_OPTIONS.find(t => t.value === form.type)?.hint}</div>
          </div>
        )}
 
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Title *</label>
          <input className={modalStyles.input} placeholder="e.g. Week 2 Lecture Notes"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Description</label>
          <input className={modalStyles.input} placeholder="Brief description for students…"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
 
        {form.type === 'document' && !editingMaterial && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>File Upload</label>
            <div className={styles.dropZone} onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}>
              {selectedFile ? (
                <div className={styles.fileSelected}>
                  <RiFileLine size={20} style={{ color: '#2563eb' }} />
                  <span>{selectedFile.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <><RiUploadLine size={24} style={{ color: 'var(--text-muted)' }} />
                  <span>Click or drag a file to upload</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>PDF, DOCX, PPTX, etc.</span></>
              )}
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
              onChange={e => setFile(e.target.files[0] || null)} />
            <div className={styles.orDivider}>— or write text content —</div>
            <RichTextEditor key={`doc-add-${modalOpen}`} content={form.content}
              onChange={html => setForm(f => ({ ...f, content: html }))} minHeight={120}
              placeholder="Optional accompanying text…" />
          </div>
        )}
        {form.type === 'document' && editingMaterial && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Text Content</label>
            <RichTextEditor key={`doc-edit-${editingMaterial?.id}`} content={form.content}
              onChange={html => setForm(f => ({ ...f, content: html }))} minHeight={140} />
            {editingMaterial.fileId && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>File attached. Delete and re-create to replace the file.</p>}
          </div>
        )}
        {['video', 'link', 'embed'].includes(form.type) && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>URL *</label>
            <input className={modalStyles.input}
              placeholder={form.type === 'video' ? 'https://youtube.com/watch?v=…' : form.type === 'embed' ? 'https://docs.google.com/presentation/d/…' : 'https://…'}
              value={form.externalUrl} onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))} />
          </div>
        )}
 
        <div className={modalStyles.row}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Week Number</label>
            <input className={modalStyles.input} type="number" min="1" max="52" placeholder="Optional"
              value={form.weekNumber} onChange={e => setForm(f => ({ ...f, weekNumber: e.target.value }))} />
          </div>
        </div>
        <div className={modalStyles.checkRow}>
          <label className={modalStyles.checkLabel}>
            <input type="checkbox" checked={form.isVisible} onChange={e => setForm(f => ({ ...f, isVisible: e.target.checked }))} /> Visible to students
          </label>
          <label className={modalStyles.checkLabel}>
            <input type="checkbox" checked={form.isLocked} onChange={e => setForm(f => ({ ...f, isLocked: e.target.checked }))} /> Lock until a date
          </label>
        </div>
        {form.isLocked && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>Unlock Date &amp; Time</label>
            <input className={modalStyles.input} type="datetime-local" value={form.unlockDate}
              onChange={e => setForm(f => ({ ...f, unlockDate: e.target.value }))} />
          </div>
        )}
 
        <div className={modalStyles.actions}>
          <button className={modalStyles.cancel} onClick={closeModal}>Cancel</button>
          <button className={modalStyles.submit} onClick={handleSave} disabled={saving}>
            {saving ? (editingMaterial ? 'Saving…' : 'Adding…') : (editingMaterial ? 'Save Changes' : 'Add Material')}
          </button>
        </div>
      </Modal>
 
      {/* Delete Confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Material">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
          Delete <strong>"{deleting?.title}"</strong>? This cannot be undone.
          {deleting?.fileId && ' The uploaded file will also be removed.'}
        </p>
        <div className={modalStyles.actions}>
          <button className={modalStyles.cancel} onClick={() => setDeleting(null)}>Cancel</button>
          <button className={modalStyles.submit} style={{ background: 'var(--danger)' }} onClick={() => handleDelete(deleting)}>Delete</button>
        </div>
      </Modal>
    </DashboardShell>
  )
}
 