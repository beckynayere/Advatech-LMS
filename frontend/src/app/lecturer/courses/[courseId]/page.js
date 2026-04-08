// DESTINATION: src/app/lecturer/courses/[courseId]/page.js
'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiAddLine, RiFileTextLine, RiVideoLine,
  RiEditLine, RiQuestionLine, RiMegaphoneLine, RiAwardLine,
  RiDeleteBinLine, RiEyeLine, RiEyeOffLine,
  RiBookOpenLine, RiLinkM, RiCodeBoxLine, RiUploadLine, RiFileLine,
  RiArticleLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useToast } from '@/lib/ToastContext'
import { getCourse } from '@/lib/api/courses'
import { getMaterials, createMaterial } from '@/lib/api/materials'
import { getAssignments, createAssignment } from '@/lib/api/assignments'
import { getQuizzes, createQuiz } from '@/lib/api/quizzes'
import {
  getModules, createModule, updateModule, deleteModule,
  addModuleItem, removeModuleItem,
} from '@/lib/api/modules'
import styles from './course.module.css'
import modalStyles from '@/components/ui/Modal.module.css'
 
// ── Constants ─────────────────────────────────────────────────────────────────
const QUICK_LINKS = (id) => [
  { label: 'Materials',     href: `/lecturer/courses/${id}/materials`,     color: 'teal',   icon: RiFileTextLine },
  { label: 'Assignments',   href: `/lecturer/courses/${id}/assignments`,   color: 'orange', icon: RiEditLine },
  { label: 'Quizzes',       href: `/lecturer/courses/${id}/quiz`,          color: 'blue',   icon: RiQuestionLine },
  { label: 'Announcements', href: `/lecturer/courses/${id}/announcements`, color: 'purple', icon: RiMegaphoneLine },
  { label: 'Gradebook',     href: `/lecturer/gradebook`,                   color: 'amber',  icon: RiAwardLine },
]
 
const ITEM_TYPE_ICONS  = { material: RiFileTextLine, assignment: RiEditLine, quiz: RiQuestionLine }
const TYPE_INDICATOR   = { material: '#2563eb', assignment: '#d97706', quiz: '#16a34a' }
 
// ── Material type options — NOW INCLUDES 'page' ───────────────────────────────
const MAT_TYPE_OPTIONS = [
  { value: 'document', label: 'Document',     icon: RiFileLine,     hint: 'Upload a file or paste text' },
  { value: 'page',     label: 'Lecture Page', icon: RiArticleLine,  hint: 'Rich content: headings, lists, images' },
  { value: 'video',    label: 'Video',        icon: RiVideoLine,    hint: 'YouTube or direct video URL' },
  { value: 'link',     label: 'External Link',icon: RiLinkM,        hint: 'Link to any external resource' },
  { value: 'embed',    label: 'Embed',        icon: RiCodeBoxLine,  hint: 'Google Slides, Padlet, etc.' },
]
const MAT_TYPE_COLORS = {
  document: '#2563eb',
  page:     '#7c3aed',
  video:    '#dc2626',
  link:     '#0d9488',
  embed:    '#d97706',
}
 
// Quiz types
const QUIZ_TYPES = [
  { value: 'practice', label: 'Practice (ungraded)' },
  { value: 'graded',   label: 'Graded' },
  { value: 'exam',     label: 'Exam' },
]
 
const EMPTY_MODULE_FORM = { title: '', description: '', isPublished: false }
const EMPTY_MAT_FORM    = { title: '', description: '', type: 'document', externalUrl: '', content: '', weekNumber: '', isVisible: true }
const EMPTY_ASSIGN_FORM = { title: '', description: '', dueDate: '', totalMarks: '100', isPublished: true }
const EMPTY_QUIZ_FORM   = { title: '', description: '', type: 'graded', timeLimitMins: '', maxAttempts: '1', passMark: '50' }
 
// TipTap outputs '<p></p>' for empty editor — this guards against saving blank pages
function isHtmlEmpty(html) {
  if (!html) return true
  return html.replace(/<[^>]*>/g, '').trim().length === 0
}
 
// ── Component ─────────────────────────────────────────────────────────────────
export default function LecturerCourseDetailPage() {
  const { courseId } = useParams()
  const toast        = useToast()
  const fileInputRef = useRef(null)
 
  const [course,   setCourse]   = useState(null)
  const [modules,  setModules]  = useState([])
  const [loading,  setLoading]  = useState(true)
 
  // Module modal
  const [modModalOpen, setModModalOpen] = useState(false)
  const [modForm,      setModForm]      = useState(EMPTY_MODULE_FORM)
  const [savingMod,    setSavingMod]    = useState(false)
  const [editingMod,   setEditingMod]   = useState(null)
 
  // Add-Item modal state
  const [itemModalOpen,  setItemModalOpen]  = useState(false)
  const [activeModuleId, setActiveModuleId] = useState(null)
  const [savingItem,     setSavingItem]     = useState(false)
  const [itemType,       setItemType]       = useState('material')
  const [itemRefId,      setItemRefId]      = useState('')
  // 'select' = pick existing | 'create' = inline create form
  const [itemSubMode,    setItemSubMode]    = useState('select')
 
  // Inline create forms
  const [matForm,        setMatForm]        = useState(EMPTY_MAT_FORM)
  const [selectedFile,   setSelectedFile]   = useState(null)
  const [assignForm,     setAssignForm]     = useState(EMPTY_ASSIGN_FORM)
  const [quizForm,       setQuizForm]       = useState(EMPTY_QUIZ_FORM)
  const [courseSchoolId, setCourseSchoolId] = useState(1)
 
  // Available refs for select mode (lazy loaded)
  const [materials,   setMaterials]   = useState([])
  const [assignments, setAssignments] = useState([])
  const [quizzes,     setQuizzes]     = useState([])
  const [refsLoaded,  setRefsLoaded]  = useState(false)
 
  const [expanded, setExpanded] = useState({})
 
  // ── Load course + modules ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getCourse(courseId), getModules(courseId)])
      .then(([c, mods]) => {
        setCourse(c)
        setModules(mods)
        setCourseSchoolId(c?.schoolId ?? 1)
        if (mods.length > 0) setExpanded({ [mods[0].id]: true })
      })
      .catch(() => toast.error('Failed to load course.'))
      .finally(() => setLoading(false))
  }, [courseId])
 
  // Load existing refs when item modal opens (for select mode)
  useEffect(() => {
    if (!itemModalOpen || refsLoaded) return
    Promise.all([getMaterials(courseId), getAssignments(courseId), getQuizzes(courseId)])
      .then(([mats, asgns, qzs]) => {
        setMaterials(mats)
        setAssignments(asgns)
        setQuizzes(qzs)
        setRefsLoaded(true)
      })
  }, [itemModalOpen, courseId, refsLoaded])
 
  // ── Module CRUD ────────────────────────────────────────────────────────────
  const openCreateModule = () => {
    setEditingMod(null)
    setModForm(EMPTY_MODULE_FORM)
    setModModalOpen(true)
  }
  const openEditModule = (mod) => {
    setEditingMod(mod)
    setModForm({ title: mod.title, description: mod.description || '', isPublished: mod.isPublished })
    setModModalOpen(true)
  }
  const handleSaveModule = async () => {
    if (!modForm.title.trim()) { toast.warning('Module title is required.'); return }
    setSavingMod(true)
    try {
      if (editingMod) {
        const updated = await updateModule(editingMod.id, modForm)
        setModules(prev => prev.map(m => m.id === editingMod.id ? { ...m, ...updated } : m))
        toast.success('Module updated.')
      } else {
        const created = await createModule(courseId, { ...modForm, sortOrder: modules.length })
        setModules(prev => [...prev, created])
        setExpanded(prev => ({ ...prev, [created.id]: true }))
        toast.success(`Module "${created.title}" created.`)
      }
      setModModalOpen(false)
    } catch (e) {
      toast.error(e.message || 'Failed to save module.')
    } finally { setSavingMod(false) }
  }
  const handleDeleteModule = async (mod) => {
    if (!confirm(`Delete module "${mod.title}" and all its items? This cannot be undone.`)) return
    try {
      await deleteModule(mod.id)
      setModules(prev => prev.filter(m => m.id !== mod.id))
      toast.success('Module deleted.')
    } catch (e) { toast.error(e.message || 'Failed to delete module.') }
  }
  const togglePublish = async (mod) => {
    try {
      const updated = await updateModule(mod.id, { isPublished: !mod.isPublished })
      setModules(prev => prev.map(m => m.id === mod.id ? { ...m, isPublished: updated.isPublished } : m))
      toast.success(updated.isPublished ? 'Module published.' : 'Module unpublished.')
    } catch (e) { toast.error(e.message || 'Failed to update module.') }
  }
 
  // ── Open Add Item modal ───────────────────────────────────────────────────
  const openAddItem = (moduleId) => {
    setActiveModuleId(moduleId)
    setItemType('material')
    setItemRefId('')
    setItemSubMode('select')
    setMatForm(EMPTY_MAT_FORM)
    setSelectedFile(null)
    setAssignForm(EMPTY_ASSIGN_FORM)
    setQuizForm(EMPTY_QUIZ_FORM)
    setItemModalOpen(true)
  }
 
  // Switch type — reset sub-mode and forms
  const switchItemType = (type) => {
    setItemType(type)
    setItemRefId('')
    setItemSubMode('select')
  }
 
  // ── Add EXISTING item to module ───────────────────────────────────────────
  const handleAddExisting = async () => {
    if (!itemRefId) { toast.warning('Please select an item.'); return }
    setSavingItem(true)
    try {
      const mod     = modules.find(m => m.id === activeModuleId)
      const newItem = await addModuleItem(activeModuleId, {
        type: itemType, refId: itemRefId, sortOrder: mod?.items?.length ?? 0,
      })
      setModules(prev => prev.map(m =>
        m.id === activeModuleId ? { ...m, items: [...m.items, newItem] } : m
      ))
      setItemModalOpen(false)
      toast.success('Item added to module.')
    } catch (e) {
      toast.error(e.message || 'Failed to add item.')
    } finally { setSavingItem(false) }
  }
 
  // ── CREATE MATERIAL inline + add to module ────────────────────────────────
  const handleCreateMaterial = async () => {
    if (!matForm.title.trim()) {
      toast.warning('Title is required.')
      return
    }
    // URL-based types
    if (['video', 'link', 'embed'].includes(matForm.type) && !matForm.externalUrl.trim()) {
      toast.warning('URL is required for this type.')
      return
    }
    // Lecture page must have content
    if (matForm.type === 'page' && isHtmlEmpty(matForm.content)) {
      toast.warning('Lecture page content cannot be empty.')
      return
    }
    // Document must have file or text
    if (matForm.type === 'document' && !selectedFile && isHtmlEmpty(matForm.content)) {
      toast.warning('Upload a file or write some content.')
      return
    }
 
    setSavingItem(true)
    try {
      const payload = {
        title:       matForm.title.trim(),
        description: matForm.description.trim() || null,
        type:        matForm.type,
        externalUrl: matForm.externalUrl.trim() || null,
        content:     isHtmlEmpty(matForm.content) ? null : matForm.content,
        weekNumber:  matForm.weekNumber ? Number(matForm.weekNumber) : null,
        isLocked:    false,
        isVisible:   matForm.isVisible,
        sortOrder:   materials.length,
        schoolId:    courseSchoolId || 1,
      }
      const newMat  = await createMaterial(courseId, payload, selectedFile || null)
      setMaterials(prev => [...prev, newMat])
 
      const mod     = modules.find(m => m.id === activeModuleId)
      const newItem = await addModuleItem(activeModuleId, {
        type: 'material', refId: newMat.id, sortOrder: mod?.items?.length ?? 0,
      })
      setModules(prev => prev.map(m =>
        m.id === activeModuleId ? { ...m, items: [...m.items, newItem] } : m
      ))
      setItemModalOpen(false)
      toast.success(`"${newMat.title}" created and added.`)
    } catch (e) {
      toast.error(e.message || 'Failed to create material.')
    } finally { setSavingItem(false) }
  }
 
  // ── CREATE ASSIGNMENT inline + add to module ──────────────────────────────
  const handleCreateAssignment = async () => {
    if (!assignForm.title.trim())  { toast.warning('Title is required.'); return }
    if (!assignForm.dueDate)       { toast.warning('Due date is required.'); return }
    if (!assignForm.totalMarks || Number(assignForm.totalMarks) <= 0) {
      toast.warning('Total marks must be a positive number.'); return
    }
    setSavingItem(true)
    try {
      const newAsgn = await createAssignment(courseId, assignForm)
      setAssignments(prev => [...prev, { ...newAsgn, submissions: [], _subsLoaded: true }])
 
      const mod     = modules.find(m => m.id === activeModuleId)
      const newItem = await addModuleItem(activeModuleId, {
        type: 'assignment', refId: newAsgn.id, sortOrder: mod?.items?.length ?? 0,
      })
      setModules(prev => prev.map(m =>
        m.id === activeModuleId ? { ...m, items: [...m.items, newItem] } : m
      ))
      setItemModalOpen(false)
      toast.success(`"${newAsgn.title}" created and added.`)
    } catch (e) {
      toast.error(e.message || 'Failed to create assignment.')
    } finally { setSavingItem(false) }
  }
 
  // ── CREATE QUIZ inline + add to module ────────────────────────────────────
  const handleCreateQuiz = async () => {
    if (!quizForm.title.trim()) { toast.warning('Quiz title is required.'); return }
    setSavingItem(true)
    try {
      const newQuiz = await createQuiz({
        courseId,
        title:         quizForm.title.trim(),
        description:   quizForm.description.trim() || null,
        type:          quizForm.type,
        timeLimitMins: quizForm.timeLimitMins ? Number(quizForm.timeLimitMins) : null,
        maxAttempts:   Number(quizForm.maxAttempts) || 1,
        passMark:      Number(quizForm.passMark) || 50,
        randomizeQ:    false,
        randomizeA:    false,
        showResults:   true,
        isPublished:   false,
      })
      setQuizzes(prev => [...prev, { ...newQuiz, questions: [] }])
 
      const mod     = modules.find(m => m.id === activeModuleId)
      const newItem = await addModuleItem(activeModuleId, {
        type: 'quiz', refId: newQuiz.id, sortOrder: mod?.items?.length ?? 0,
      })
      setModules(prev => prev.map(m =>
        m.id === activeModuleId ? { ...m, items: [...m.items, newItem] } : m
      ))
      setItemModalOpen(false)
      toast.success(`Quiz "${newQuiz.title}" created as draft and added. Open the Quizzes tab to add questions.`)
    } catch (e) {
      toast.error(e.message || 'Failed to create quiz.')
    } finally { setSavingItem(false) }
  }
 
  // ── Remove item from module ───────────────────────────────────────────────
  const handleRemoveItem = async (moduleId, itemId) => {
    if (!confirm('Remove this item from the module?')) return
    try {
      await removeModuleItem(moduleId, itemId)
      setModules(prev => prev.map(m =>
        m.id === moduleId ? { ...m, items: m.items.filter(i => i.id !== itemId) } : m
      ))
      toast.success('Item removed.')
    } catch (e) { toast.error(e.message || 'Failed to remove item.') }
  }
 
  const getRefOptions = () => {
    if (itemType === 'material')   return materials
    if (itemType === 'assignment') return assignments
    if (itemType === 'quiz')       return quizzes
    return []
  }
 
  // ── Loading / not found ───────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardShell title="Loading…" requiredRole="lecturer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 4 }}>
          <Skeleton height={80} style={{ borderRadius: 14 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} height={72} style={{ borderRadius: 12 }} />)}
          </div>
          <Skeleton variant="card" />
        </div>
      </DashboardShell>
    )
  }
  if (!course) {
    return (
      <DashboardShell title="Course Not Found" requiredRole="lecturer">
        <EmptyState icon={RiFileTextLine} title="Course not found" desc="This course doesn't exist or you don't have access." />
      </DashboardShell>
    )
  }
 
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardShell
      title={course.title}
      subtitle={[course.code, course.department].filter(Boolean).join(' · ')}
      requiredRole="lecturer"
    >
      <div className={styles.page}>
        {/* Info bar */}
        <div className={styles.infoBar}>
          <div className={styles.infoBarLeft}>
            <div className={`${styles.courseColorMark} ${styles[course.color]}`}>{course.code}</div>
            <div className={styles.courseTitleWrap}>
              <div className={styles.courseTitle}>{course.title}</div>
              <div className={styles.courseSub}>
                {[course.cohort, course.semester].filter(Boolean).join(' · ') || course.department}
              </div>
            </div>
          </div>
          <div className={styles.infoStats}>
            {[
              { label: 'Students', value: course.enrolledStudents },
              { label: 'Modules',  value: modules.length },
              { label: 'Credits',  value: course.credits },
            ].map(s => (
              <div key={s.label} className={styles.infoStat}>
                <div className={styles.infoStatValue}>{s.value}</div>
                <div className={styles.infoStatLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
 
        {/* Quick links */}
        <div className={styles.quickLinks}>
          {QUICK_LINKS(courseId).map(l => (
            <Link key={l.href} href={l.href} className={styles.quickLink}>
              <div className={`${styles.qlIcon} ${styles[l.color]}`}><l.icon size={18} /></div>
              <span className={styles.qlLabel}>{l.label}</span>
            </Link>
          ))}
        </div>
 
        {/* Course Structure */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <RiBookOpenLine size={16} style={{ marginRight: 6 }} />
              Course Structure ({modules.length} {modules.length === 1 ? 'module' : 'modules'})
            </div>
            <button className={styles.addBtn} onClick={openCreateModule}>
              <RiAddLine size={14} /> Add Module
            </button>
          </div>
          {modules.length === 0 ? (
            <EmptyState
              icon={RiBookOpenLine}
              title="No modules yet"
              desc="Modules organise your course into sections. Add your first module to get started."
              actionLabel="Add Module"
              onAction={openCreateModule}
            />
          ) : (
            <div className={styles.moduleList}>
              {modules.map((mod, modIdx) => {
                const isOpen = !!expanded[mod.id]
                return (
                  <div key={mod.id} className={styles.moduleBlock}>
                    <div
                      className={styles.moduleHeader}
                      onClick={() => setExpanded(prev => ({ ...prev, [mod.id]: !isOpen }))}
                    >
                      <div className={styles.moduleLeft}>
                        <span className={styles.moduleNum}>{modIdx + 1}</span>
                        <div className={styles.moduleTitleWrap}>
                          <span className={styles.moduleTitle}>{mod.title}</span>
                          {mod.description && <span className={styles.moduleDesc}>{mod.description}</span>}
                        </div>
                        <Badge label={mod.isPublished ? 'Published' : 'Draft'} color={mod.isPublished ? 'green' : 'gray'} size="sm" />
                        <span className={styles.itemCount}>{mod.items.length} items</span>
                      </div>
                      <div className={styles.moduleActions} onClick={e => e.stopPropagation()}>
                        <button className={styles.iconBtn} title={mod.isPublished ? 'Unpublish' : 'Publish'} onClick={() => togglePublish(mod)}>
                          {mod.isPublished ? <RiEyeOffLine size={15} /> : <RiEyeLine size={15} />}
                        </button>
                        <button className={styles.iconBtn} title="Edit module" onClick={() => openEditModule(mod)}>
                          <RiEditLine size={15} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.danger}`} title="Delete module" onClick={() => handleDeleteModule(mod)}>
                          <RiDeleteBinLine size={15} />
                        </button>
                        <span className={styles.chevron} style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>›</span>
                      </div>
                    </div>
 
                    {isOpen && (
                      <div className={styles.moduleItems}>
                        {mod.items.length === 0 ? (
                          <div className={styles.emptyItems}>No items yet. Click "Add Item" below.</div>
                        ) : (
                          mod.items.map((item, itemIdx) => {
                            const Icon = ITEM_TYPE_ICONS[item.type] || RiFileTextLine
                            return (
                              <div key={item.id} className={styles.itemRow}>
                                <span className={styles.typeIndicator} style={{ background: TYPE_INDICATOR[item.type] || '#64748b' }} />
                                <span className={styles.itemOrder}>{itemIdx + 1}</span>
                                <span className={`${styles.itemTypeTag} ${styles[item.type]}`}>
                                  <Icon size={12} /> {item.type}
                                </span>
                                <span className={styles.itemTitle}>
                                  {item.title || item.ref?.title || `${item.type} #${item.refId}`}
                                </span>
                                {item.isLocked && <Badge label="Locked" color="gray" size="xs" />}
                                <button
                                  className={`${styles.iconBtn} ${styles.danger} ${styles.small}`}
                                  title="Remove from module"
                                  onClick={() => handleRemoveItem(mod.id, item.id)}
                                >
                                  <RiDeleteBinLine size={13} />
                                </button>
                              </div>
                            )
                          })
                        )}
                        <button className={styles.addItemBtn} onClick={() => openAddItem(mod.id)}>
                          <RiAddLine size={13} /> Add Item
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
 
      {/* ── Module Create/Edit Modal ── */}
      <Modal open={modModalOpen} onClose={() => setModModalOpen(false)} title={editingMod ? 'Edit Module' : 'Create Module'}>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Module Title *</label>
          <input className={modalStyles.input} value={modForm.title} onChange={e => setModForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Week 1: Introduction" />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Description (optional)</label>
          <textarea className={modalStyles.textarea} rows={2} value={modForm.description} onChange={e => setModForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief overview of this module…" />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.checkboxRow}>
            <input type="checkbox" checked={modForm.isPublished} onChange={e => setModForm(p => ({ ...p, isPublished: e.target.checked }))} />
            Publish immediately (students can see this module)
          </label>
        </div>
        <div className={modalStyles.actions}>
          <button className={modalStyles.cancel} onClick={() => setModModalOpen(false)}>Cancel</button>
          <button className={modalStyles.submit} onClick={handleSaveModule} disabled={savingMod}>
            {savingMod ? 'Saving…' : editingMod ? 'Save Changes' : 'Create Module'}
          </button>
        </div>
      </Modal>
 
      {/* ── Add Item Modal ── */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title="Add Item to Module"
      >
        {/* Item type tabs: Material / Assignment / Quiz */}
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Item Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['material', 'assignment', 'quiz'].map(t => (
              <button
                key={t}
                className={`${modalStyles.typeBtn} ${itemType === t ? modalStyles.typeBtnActive : ''}`}
                onClick={() => switchItemType(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
 
        {/* Select / Create toggle */}
        <div className={modalStyles.field}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              className={`${modalStyles.typeBtn} ${itemSubMode === 'select' ? modalStyles.typeBtnActive : ''}`}
              onClick={() => setItemSubMode('select')}
            >
              Select Existing
            </button>
            <button
              className={`${modalStyles.typeBtn} ${itemSubMode === 'create' ? modalStyles.typeBtnActive : ''}`}
              onClick={() => setItemSubMode('create')}
            >
              + Create New
            </button>
          </div>
        </div>
 
        {/* ── SELECT EXISTING ── */}
        {itemSubMode === 'select' && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>
              Select {itemType.charAt(0).toUpperCase() + itemType.slice(1)} *
            </label>
            {!refsLoaded ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
            ) : (
              <select className={modalStyles.select} value={itemRefId} onChange={e => setItemRefId(e.target.value)}>
                <option value="">— choose —</option>
                {getRefOptions().map(r => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            )}
            {refsLoaded && getRefOptions().length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                No {itemType}s found.{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600 }}
                  onClick={() => setItemSubMode('create')}
                >
                  Create one now →
                </button>
              </p>
            )}
            <div className={modalStyles.actions}>
              <button className={modalStyles.cancel} onClick={() => setItemModalOpen(false)}>Cancel</button>
              <button className={modalStyles.submit} onClick={handleAddExisting} disabled={savingItem || !itemRefId}>
                {savingItem ? 'Adding…' : 'Add to Module'}
              </button>
            </div>
          </div>
        )}
 
        {/* ── CREATE NEW MATERIAL ── */}
        {itemSubMode === 'create' && itemType === 'material' && (
          <div>
            {/* Material type selector */}
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Material Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {MAT_TYPE_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 8, border: '1.5px solid',
                      borderColor: matForm.type === t.value ? MAT_TYPE_COLORS[t.value] : 'var(--border)',
                      background:  matForm.type === t.value ? MAT_TYPE_COLORS[t.value] + '15' : 'var(--surface)',
                      color:       matForm.type === t.value ? MAT_TYPE_COLORS[t.value] : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}
                    onClick={() => setMatForm(f => ({ ...f, type: t.value, content: '', externalUrl: '' }))}
                  >
                    <t.icon size={15} />{t.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {MAT_TYPE_OPTIONS.find(t => t.value === matForm.type)?.hint}
              </div>
            </div>
 
            {/* Title */}
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Title *</label>
              <input
                className={modalStyles.input}
                placeholder={matForm.type === 'page' ? 'e.g. Week 1: Introduction to the Course' : 'e.g. Week 1 Lecture Notes'}
                value={matForm.title}
                onChange={e => setMatForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
 
            {/* Description */}
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Description</label>
              <input
                className={modalStyles.input}
                placeholder="Brief description…"
                value={matForm.description}
                onChange={e => setMatForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
 
            {/* ── LECTURE PAGE: TipTap rich text editor ── */}
            {matForm.type === 'page' && (
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>Page Content *</label>
                <RichTextEditor
                  key={`item-modal-page-${itemModalOpen}`}
                  content={matForm.content}
                  onChange={html => setMatForm(f => ({ ...f, content: html }))}
                  minHeight={220}
                  placeholder="Write your lecture content here — headings, lists, images…"
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  Supports headings, bold/italic, lists, blockquotes, links, and images.
                </div>
              </div>
            )}
 
            {/* ── DOCUMENT: file upload + plain text ── */}
            {matForm.type === 'document' && (
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>File or Text</label>
                <div
                  style={{
                    border: '1.5px dashed var(--border)', borderRadius: 8,
                    padding: 14, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 6, cursor: 'pointer',
                    fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-2)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f) }}
                >
                  {selectedFile ? (
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      <RiFileLine size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      {selectedFile.name}
                    </span>
                  ) : (
                    <><RiUploadLine size={20} /><span>Click or drag to upload</span></>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                  onChange={e => setSelectedFile(e.target.files[0] || null)}
                />
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', margin: '8px 0' }}>
                  — or paste text —
                </div>
                <textarea
                  className={modalStyles.textarea}
                  placeholder="Paste text content here…"
                  rows={3}
                  value={matForm.content}
                  onChange={e => setMatForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>
            )}
 
            {/* ── VIDEO / LINK / EMBED: URL field ── */}
            {['video', 'link', 'embed'].includes(matForm.type) && (
              <div className={modalStyles.field}>
                <label className={modalStyles.label}>URL *</label>
                <input
                  className={modalStyles.input}
                  placeholder={
                    matForm.type === 'video'
                      ? 'https://youtube.com/watch?v=…'
                      : matForm.type === 'embed'
                      ? 'https://docs.google.com/presentation/…'
                      : 'https://…'
                  }
                  value={matForm.externalUrl}
                  onChange={e => setMatForm(f => ({ ...f, externalUrl: e.target.value }))}
                />
              </div>
            )}
 
            {/* Week number */}
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Week Number (optional)</label>
              <input
                className={modalStyles.input}
                type="number" min="1" max="52"
                placeholder="e.g. 1"
                value={matForm.weekNumber}
                onChange={e => setMatForm(f => ({ ...f, weekNumber: e.target.value }))}
                style={{ maxWidth: 120 }}
              />
            </div>
 
            <div className={modalStyles.actions}>
              <button className={modalStyles.cancel} onClick={() => setItemSubMode('select')}>← Back</button>
              <button className={modalStyles.submit} onClick={handleCreateMaterial} disabled={savingItem}>
                {savingItem ? 'Creating…' : 'Create & Add to Module'}
              </button>
            </div>
          </div>
        )}
 
        {/* ── CREATE NEW ASSIGNMENT ── */}
        {itemSubMode === 'create' && itemType === 'assignment' && (
          <div>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Title *</label>
              <input className={modalStyles.input} placeholder="Assignment title" value={assignForm.title} onChange={e => setAssignForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Description / Instructions</label>
              <textarea className={modalStyles.textarea} rows={3} placeholder="Describe the assignment and instructions for students…" value={assignForm.description} onChange={e => setAssignForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className={modalStyles.field} style={{ flex: 1 }}>
                <label className={modalStyles.label}>Due Date *</label>
                <input className={modalStyles.input} type="date" value={assignForm.dueDate} onChange={e => setAssignForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className={modalStyles.field} style={{ flex: 1 }}>
                <label className={modalStyles.label}>Total Marks *</label>
                <input className={modalStyles.input} type="number" min="1" placeholder="100" value={assignForm.totalMarks} onChange={e => setAssignForm(f => ({ ...f, totalMarks: e.target.value }))} />
              </div>
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.checkboxRow}>
                <input type="checkbox" checked={assignForm.isPublished} onChange={e => setAssignForm(f => ({ ...f, isPublished: e.target.checked }))} />
                Publish immediately (students can see and submit)
              </label>
            </div>
            <div className={modalStyles.actions}>
              <button className={modalStyles.cancel} onClick={() => setItemSubMode('select')}>← Back</button>
              <button className={modalStyles.submit} onClick={handleCreateAssignment} disabled={savingItem}>
                {savingItem ? 'Creating…' : 'Create & Add to Module'}
              </button>
            </div>
          </div>
        )}
 
        {/* ── CREATE NEW QUIZ ── */}
        {itemSubMode === 'create' && itemType === 'quiz' && (
          <div>
            <div style={{ padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
              The quiz will be created as a draft. Open the Quizzes tab after to add questions and publish.
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Title *</label>
              <input className={modalStyles.input} placeholder="e.g. Week 3 Assessment" value={quizForm.title} onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.label}>Description</label>
              <textarea className={modalStyles.textarea} rows={2} placeholder="Instructions for students…" value={quizForm.description} onChange={e => setQuizForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className={modalStyles.field} style={{ flex: 1 }}>
                <label className={modalStyles.label}>Quiz Type</label>
                <select className={modalStyles.select} value={quizForm.type} onChange={e => setQuizForm(f => ({ ...f, type: e.target.value }))}>
                  {QUIZ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className={modalStyles.field} style={{ flex: 1 }}>
                <label className={modalStyles.label}>Time Limit (min)</label>
                <input className={modalStyles.input} type="number" min="1" placeholder="No limit" value={quizForm.timeLimitMins} onChange={e => setQuizForm(f => ({ ...f, timeLimitMins: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className={modalStyles.field} style={{ flex: 1 }}>
                <label className={modalStyles.label}>Max Attempts</label>
                <input className={modalStyles.input} type="number" min="1" value={quizForm.maxAttempts} onChange={e => setQuizForm(f => ({ ...f, maxAttempts: e.target.value }))} />
              </div>
              <div className={modalStyles.field} style={{ flex: 1 }}>
                <label className={modalStyles.label}>Pass Mark (%)</label>
                <input className={modalStyles.input} type="number" min="0" max="100" value={quizForm.passMark} onChange={e => setQuizForm(f => ({ ...f, passMark: e.target.value }))} />
              </div>
            </div>
            <div className={modalStyles.actions}>
              <button className={modalStyles.cancel} onClick={() => setItemSubMode('select')}>← Back</button>
              <button className={modalStyles.submit} onClick={handleCreateQuiz} disabled={savingItem}>
                {savingItem ? 'Creating…' : 'Create & Add to Module'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  )
}