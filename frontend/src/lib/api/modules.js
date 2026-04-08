// DESTINATION: src/lib/api/modules.js
// Module system API — create/read/update/delete modules, items, and progress

import { apiGet, apiPost, apiPut, apiDelete } from './client'

// ─── Normalisers ───────────────────────────────────────────────────────────────

function normalizeItem(item) {
  return {
    id:         String(item.id),
    moduleId:   String(item.moduleId),
    type:       item.type, // 'material' | 'assignment' | 'quiz'
    refId:      String(item.refId),
    title:      item.title || item.ref?.title || '',
    sortOrder:  item.sortOrder ?? 0,
    isLocked:   item.isLocked ?? false,
    unlockDate: item.unlockDate || null,
    ref:        item.ref || null,
    progress:   item.progress || null,
  }
}

function normalizeModule(mod) {
  return {
    id:          String(mod.id),
    courseId:    String(mod.courseId),
    title:       mod.title || '',
    description: mod.description || '',
    sortOrder:   mod.sortOrder ?? 0,
    isPublished: mod.isPublished ?? false,
    items:       (mod.items || []).map(normalizeItem),
  }
}

// ─── GET /api/v1/modules?courseId=X ───────────────────────────────────────────
export async function getModules(courseId) {
  try {
    const data = await apiGet(`/api/v1/modules?courseId=${courseId}`)
    return (data.data || []).map(normalizeModule)
  } catch {
    return []
  }
}

// ─── POST /api/v1/modules ─────────────────────────────────────────────────────
export async function createModule(courseId, payload) {
  const data = await apiPost('/api/v1/modules', {
    courseId:    Number(courseId),
    title:       payload.title,
    description: payload.description || null,
    sortOrder:   payload.sortOrder ?? 0,
    isPublished: payload.isPublished ?? false,
  })
  return normalizeModule(data.module)
}

// ─── PUT /api/v1/modules/:id ──────────────────────────────────────────────────
export async function updateModule(moduleId, payload) {
  const data = await apiPut(`/api/v1/modules/${moduleId}`, payload)
  return normalizeModule(data.module)
}

// ─── DELETE /api/v1/modules/:id ───────────────────────────────────────────────
export async function deleteModule(moduleId) {
  return apiDelete(`/api/v1/modules/${moduleId}`)
}

// ─── POST /api/v1/modules/:id/items ──────────────────────────────────────────
export async function addModuleItem(moduleId, payload) {
  const data = await apiPost(`/api/v1/modules/${moduleId}/items`, {
    type:       payload.type,        // 'material' | 'assignment' | 'quiz'
    refId:      Number(payload.refId),
    title:      payload.title || null,
    sortOrder:  payload.sortOrder ?? 0,
    isLocked:   payload.isLocked ?? false,
    unlockDate: payload.unlockDate || null,
  })
  return normalizeItem(data.item)
}

// ─── PUT /api/v1/modules/:id/items/:itemId ────────────────────────────────────
export async function updateModuleItem(moduleId, itemId, payload) {
  const data = await apiPut(`/api/v1/modules/${moduleId}/items/${itemId}`, payload)
  return normalizeItem(data.item)
}

// ─── DELETE /api/v1/modules/:id/items/:itemId ────────────────────────────────
export async function removeModuleItem(moduleId, itemId) {
  return apiDelete(`/api/v1/modules/${moduleId}/items/${itemId}`)
}

// ─── POST /api/v1/modules/:id/reorder ────────────────────────────────────────
export async function reorderModuleItems(moduleId, items) {
  // items: [{ id, sortOrder }]
  return apiPost(`/api/v1/modules/${moduleId}/reorder`, { items })
}

// ─── POST /api/v1/modules/progress ───────────────────────────────────────────
// Mark a material/assignment/quiz as viewed or completed
export async function markProgress(courseId, itemType, itemId, status = 'viewed') {
  try {
    const data = await apiPost('/api/v1/modules/progress', {
      courseId: Number(courseId),
      itemType,
      itemId:   Number(itemId),
      status,
    })
    return data.progress
  } catch {
    return null
  }
}

// ─── GET /api/v1/modules/progress?courseId=X ─────────────────────────────────
export async function getProgress(courseId) {
  try {
    const data = await apiGet(`/api/v1/modules/progress?courseId=${courseId}`)
    return data.data || []
  } catch {
    return []
  }
}
