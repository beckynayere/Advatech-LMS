// DESTINATION: src/lib/api/materials.js
// FIXES:
//   FIX 3: getMaterials now requests ?limit=200 to prevent silent truncation at default 20

import { apiGet, apiPost, apiPut, apiDelete, apiRequest } from './client'
 
// ─── Normaliser ─────────────────────────────────────────────────────────────
export function normalizeMaterial(m) {
  return {
    id:          String(m.id),
    title:       m.title || '',
    description: m.description || '',
    // Preserve all types including the new 'page' type
    type:        m.type || 'document',
    fileId:      m.fileId || null,
    externalUrl: m.externalUrl || null,
    content:     m.content || null,
    weekNumber:  m.weekNumber ?? null,
    isLocked:    m.isLocked ?? false,
    unlockDate:  m.unlockDate || null,
    isVisible:   m.isVisible ?? true,
    sortOrder:   m.sortOrder ?? 0,
    createdAt:   m.createdAt || null,
    createdBy:   m.creator ? { id: m.creator.id, name: m.creator.name } : null,
    downloadUrl: m.downloadUrl || null,
  }
}
 
// ─── GET /api/v1/courses/:courseId/materials ─────────────────────────────────
// FIX 3: Added ?limit=200 — default pagination is 20, silently truncates large courses
export async function getMaterials(courseId) {
  try {
    const data = await apiGet(`/api/v1/courses/${courseId}/materials?limit=200`)
    return (data.data || []).map(normalizeMaterial)
  } catch {
    return []
  }
}
 
// ─── GET /api/v1/courses/:courseId/materials/:id ─────────────────────────────
export async function getMaterial(courseId, materialId) {
  const data = await apiGet(`/api/v1/courses/${courseId}/materials/${materialId}`)
  const m = normalizeMaterial(data.material || data.data || data)
  if (data.downloadUrl) m.downloadUrl = data.downloadUrl
  return m
}
 
// ─── POST /api/v1/courses/:courseId/materials ─────────────────────────────────
export async function createMaterial(courseId, payload, file = null) {
  const body = {
    title:        payload.title,
    description:  payload.description || null,
    // Valid types: document | page | video | link | embed
    type:         payload.type || 'document',
    externalUrl:  payload.externalUrl || null,
    content:      payload.content || null,
    weekNumber:   payload.weekNumber ? Number(payload.weekNumber) : null,
    isLocked:     payload.isLocked ?? false,
    unlockDate:   payload.unlockDate ? new Date(payload.unlockDate).toISOString() : null,
    isVisible:    payload.isVisible ?? true,
    sortOrder:    payload.sortOrder ?? 0,
    schoolId:     Number(payload.schoolId),
    departmentId: payload.departmentId ? Number(payload.departmentId) : null,
  }
 
  if (file) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('data', JSON.stringify(body))
    const data = await apiRequest(`/api/v1/courses/${courseId}/materials`, {
      method: 'POST',
      body:   formData,
    })
    return normalizeMaterial(data.material || data.data || data)
  }
 
  const data = await apiPost(`/api/v1/courses/${courseId}/materials`, body)
  return normalizeMaterial(data.material || data.data || data)
}
 
// ─── PUT /api/v1/courses/:courseId/materials/:id ──────────────────────────────
export async function updateMaterial(courseId, materialId, payload) {
  const data = await apiPut(
    `/api/v1/courses/${courseId}/materials/${materialId}`,
    payload
  )
  return normalizeMaterial(data.material || data.data || data)
}
 
// ─── DELETE /api/v1/courses/:courseId/materials/:id ───────────────────────────
export async function deleteMaterial(courseId, materialId) {
  return apiDelete(`/api/v1/courses/${courseId}/materials/${materialId}`)
}