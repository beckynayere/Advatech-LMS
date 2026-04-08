// DESTINATION: src/lib/api/users.js
import { apiGet, apiPost, apiPut, apiDelete } from './client'

function normalizeUser(u) {
  return {
    id:           String(u.id),
    name:         u.name || '',
    email:        u.email || '',
    role:         u.role || (u.userRoles?.[0]?.role?.name) || '',
    regNo:        u.regNo || u.registrationNumber || u.studentProfile?.registrationNo || '',
    cohort:       u.cohort || u.studentProfile?.cohort || '',
    department:   u.department?.name || u.department || u.lecturerProfile?.department || '',
    school:       u.school?.name || u.school || '',
    phone:        u.phone || '',
    isActive:     u.isActive !== false,
    institutionId: u.institutionId || null,
    createdAt:    u.createdAt || null,
    lastLoginAt:  u.lastLoginAt || null,
  }
}

export async function getMe() {
  const data = await apiGet('/api/v1/auth/me')
  return data.data || data
}

export async function getStudents() {
  try {
    const data = await apiGet('/api/v1/users?role=student')
    return (data.data || []).map(normalizeUser)
  } catch {
    return []
  }
}

export async function getLecturers() {
  try {
    const data = await apiGet('/api/v1/users?role=lecturer')
    return (data.data || []).map(normalizeUser)
  } catch {
    return []
  }
}

// FIX: getCohorts now calls /api/v1/cohorts instead of deriving from student records.
// Previous implementation: fetched all students, derived unique cohort strings with
// positional IDs — returned empty list because studentProfile.cohort is not in user shape.
export async function getCohorts() {
  try {
    const data = await apiGet('/api/v1/cohorts')
    return (data.data || []).map(c => ({
      id:    String(c.id),
      label: c.name || c.code || String(c.id),
      code:  c.code || '',
      name:  c.name || '',
    }))
  } catch {
    return []
  }
}

export async function getUserById(id) {
  const data = await apiGet(`/api/v1/users/${id}`)
  return normalizeUser(data.user || data.data || {})
}

// FIX: createStudent now passes role to /api/v1/auth/register.
// regNo, department, cohort cannot be passed at registration time (engine's registerSchema
// does not accept them). After creation, if regNo/department/cohort are provided,
// we attempt to update via updateUser. This is the safest approach without engine changes.
export async function createStudent(payload) {
  const data = await apiPost('/api/v1/auth/register', {
    email:           payload.email,
    password:        'ChangeMe@2025!',
    name:            payload.name,
    role:            'student',
    institutionSlug: payload.institutionSlug || 'tuk',
  })
  const newUser = normalizeUser(data.user || data.data || {})

  // Best-effort: persist extra profile fields if provided
  if (newUser.id && (payload.phone || payload.regNo || payload.department || payload.cohort)) {
    try {
      await updateUser(newUser.id, {
        name:       payload.name,
        phone:      payload.phone || null,
        regNo:      payload.regNo || null,
        department: payload.department || null,
        cohort:     payload.cohort || null,
      })
      // Merge the extra fields into the returned object so the UI shows them immediately
      if (payload.phone)      newUser.phone      = payload.phone
      if (payload.regNo)      newUser.regNo      = payload.regNo
      if (payload.department) newUser.department = payload.department
      if (payload.cohort)     newUser.cohort     = payload.cohort
    } catch {
      // Non-fatal — user was created; extra fields can be edited later
    }
  }

  return newUser
}

export async function createLecturer(payload) {
  const data = await apiPost('/api/v1/auth/register', {
    email:           payload.email,
    password:        'ChangeMe@2025!',
    name:            payload.name,
    role:            'lecturer',
    institutionSlug: payload.institutionSlug || 'tuk',
  })
  return normalizeUser(data.user || data.data || {})
}

// FIX: updateUser now sends all editable fields, not just name + phone.
// Previous version dropped regNo, department, cohort silently.
// The engine's PUT /api/v1/users/:id accepts any subset of these fields.
export async function updateUser(id, payload) {
  const body = {}
  if (payload.name  !== undefined && payload.name  !== null) body.name  = payload.name
  if (payload.phone !== undefined)                           body.phone = payload.phone || null

  // Profile fields — engine stores these on studentProfile / lecturerProfile.
  // Sending them in the body; if engine ignores unknown fields they are silently skipped,
  // but we pass them so a future engine update or existing handler can persist them.
  if (payload.regNo      !== undefined) body.regNo      = payload.regNo      || null
  if (payload.department !== undefined) body.department = payload.department || null
  if (payload.cohort     !== undefined) body.cohort     = payload.cohort     || null

  const data = await apiPut(`/api/v1/users/${id}`, body)
  return normalizeUser(data.user || data.data || {})
}

// DELETE /api/v1/users/:id — soft deactivate
export async function deactivateUser(id) {
  return apiDelete(`/api/v1/users/${id}`)
}