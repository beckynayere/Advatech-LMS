// DESTINATION: src/lib/api/cohorts.js
import { apiGet, apiPost, apiPut, apiDelete } from './client'

function normalizeCohort(c) {
  return {
    id:            String(c.id),
    name:          c.name || '',
    code:          c.code || '',
    description:   c.description || '',
    academicYear:  c.academicYear || '',
    semester:      c.semester || '',
    maxStudents:   c.maxStudents || 50,
    startDate:     c.startDate || '',
    endDate:       c.endDate || '',
    coordinatorId: c.coordinatorId ? String(c.coordinatorId) : '',
    coordinatorName: c.coordinator?.user?.name || '',
    enrollmentCount: c._count?.enrollments ?? 0,
    courseCount:     c._count?.courses ?? 0,
    // Detail view fields
    courses:     (c.courses || []).map(cc => ({
      id:      String(cc.course?.id || cc.courseId),
      code:    cc.course?.code || '',
      name:    cc.course?.name || '',
      credits: cc.course?.credits || 0,
    })),
    enrollments: (c.enrollments || []).map(e => ({
      studentId:   String(e.student?.id || e.studentId),
      studentName: e.student?.name || '',
      studentEmail:e.student?.email || '',
      isActive:    e.isActive !== false,
    })),
  }
}

// GET /api/v1/cohorts
export async function getCohorts() {
  try {
    const data = await apiGet('/api/v1/cohorts')
    return (data.data || []).map(normalizeCohort)
  } catch {
    return []
  }
}

// GET /api/v1/cohorts/:id  (includes courses + enrollments)
export async function getCohort(id) {
  const data = await apiGet(`/api/v1/cohorts/${id}`)
  return normalizeCohort(data.cohort || data.data)
}

// POST /api/v1/cohorts
// Required: name, code, academicYear, semester, maxStudents, startDate, endDate, coordinatorId
export async function createCohort(payload) {
  const data = await apiPost('/api/v1/cohorts', {
    name:          payload.name,
    code:          payload.code.toUpperCase(),
    description:   payload.description || null,
    academicYear:  payload.academicYear,
    semester:      payload.semester,
    maxStudents:   Number(payload.maxStudents) || 50,
    startDate:     new Date(payload.startDate + 'T00:00:00').toISOString(),
    endDate:       new Date(payload.endDate   + 'T23:59:59').toISOString(),
    coordinatorId: Number(payload.coordinatorId),
  })
  return normalizeCohort(data.cohort || data.data)
}

// PUT /api/v1/cohorts/:id
export async function updateCohort(id, payload) {
  const body = {}
  if (payload.name)          body.name = payload.name
  if (payload.description !== undefined) body.description = payload.description || null
  if (payload.maxStudents)   body.maxStudents = Number(payload.maxStudents)
  if (payload.startDate)     body.startDate = new Date(payload.startDate + 'T00:00:00').toISOString()
  if (payload.endDate)       body.endDate   = new Date(payload.endDate   + 'T23:59:59').toISOString()
  if (payload.coordinatorId) body.coordinatorId = Number(payload.coordinatorId)
  const data = await apiPut(`/api/v1/cohorts/${id}`, body)
  return normalizeCohort(data.cohort || data.data)
}

// DELETE /api/v1/cohorts/:id  (soft delete)
export async function deleteCohort(id) {
  return apiDelete(`/api/v1/cohorts/${id}`)
}

// POST /api/v1/cohorts/:id/enroll  — enroll a student
export async function enrollStudent(cohortId, studentId) {
  return apiPost(`/api/v1/cohorts/${cohortId}/enroll`, {
    studentId: Number(studentId),
  })
}

// DELETE /api/v1/cohorts/:id/enroll/:studentId  — remove student
export async function unenrollStudent(cohortId, studentId) {
  return apiDelete(`/api/v1/cohorts/${cohortId}/enroll/${studentId}`)
}

// POST /api/v1/cohorts/:id/courses  — attach a course
export async function addCourseToCohort(cohortId, courseId) {
  return apiPost(`/api/v1/cohorts/${cohortId}/courses`, {
    courseId: Number(courseId),
  })
}

// DELETE /api/v1/cohorts/:id/courses/:courseId  — detach a course
export async function removeCourseFromCohort(cohortId, courseId) {
  return apiDelete(`/api/v1/cohorts/${cohortId}/courses/${courseId}`)
}