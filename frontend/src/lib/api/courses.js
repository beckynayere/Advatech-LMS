// DESTINATION: src/lib/api/courses.js
import { apiGet, apiPost, apiDelete } from './client'

function normalizeCourse(c) {
  return {
    id:               String(c.id),
    code:             c.code || '',
    title:            c.name || c.title || '',
    description:      c.description || '',
    credits:          c.credits || 3,
    color:            c.color || 'teal',
    semester:         c.semester || '',
    academicYear:     c.academicYear || '',
    schoolId:         c.schoolId ?? null,
    departmentId:     c.departmentId ?? null,
    school:           c.school?.name || c.school || '',
    department:       c.department?.name || c.department || '',
    lecturerId:       String(c.lecturers?.[0]?.lecturer?.userId || c.lecturerId || ''),
    lecturerName:     c.lecturers?.[0]?.lecturer?.user?.name || c.lecturerName || '',
    enrolledStudents: c._count?.enrollments ?? c.enrolledStudents ?? 0,
    visible:          c.isActive !== false,
    materialsCount:   c._count?.materials ?? 0,
    assignmentsCount: c._count?.assignments ?? 0,
    quizzesCount:     c._count?.quizzes ?? 0,
    assignments:      [],
    quizzes:          [],
    announcements:    [],
    modules:          c.modules || [],
  }
}

export async function getCourses() {
  try {
    const data = await apiGet('/api/v1/courses')
    return (data.data || []).map(normalizeCourse)
  } catch {
    return []
  }
}

export async function getCourse(courseId) {
  try {
    const data = await apiGet(`/api/v1/courses/${courseId}`)
    const raw = data.course || data.data || data
    return normalizeCourse(raw)
  } catch {
    return null
  }
}

export async function getEnrollments(courseId) {
  try {
    const data = await apiGet(`/api/v1/courses/${courseId}/enrollments`)
    return data.data || []
  } catch {
    return []
  }
}

export async function createCourse(payload) {
  const data = await apiPost('/api/v1/courses', payload)
  return normalizeCourse(data.course || data.data)
}

// POST /api/v1/courses/:id/lecturers — assigns a lecturer (by userId) to a course
export async function assignLecturerToCourse(courseId, lecturerUserId) {
  return apiPost(`/api/v1/courses/${courseId}/lecturers`, {
    lecturerUserId: Number(lecturerUserId),
  })
}

// DELETE /api/v1/courses/:id/lecturers/:lecturerId
export async function removeLecturerFromCourse(courseId, lecturerId) {
  return apiDelete(`/api/v1/courses/${courseId}/lecturers/${lecturerId}`)
}