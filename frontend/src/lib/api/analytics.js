// DESTINATION: src/lib/api/analytics.js

import { apiGet } from './client'

// ─── Empty/fallback shape ──────────────────────────────────────────────────────
const EMPTY = {
  overview: {
    totalStudents:       0,
    totalLecturers:      0,
    activeCourses:       0,
    activeCohorts:       0,
    pendingSubmissions:  0,
    activeUsersLast7Days:0,
    paymentsThisMonth:   { total: '0', count: 0 },
    passRate:            0,
  },
  enrollmentByDepartment: [],
  gradeDistribution:      [],
  enrollmentTrend:        [],
  attendanceByCourse:     [],
  courses:                [],
  // Flat aliases for legacy props
  totalCourses:    0,
  totalStudents:   0,
  totalLecturers:  0,
  attendanceRate:  0,
}

// ─── GET /api/v1/analytics/overview ───────────────────────────────────────────
// Engine returns:
//   { success: true, overview: { totalStudents, totalLecturers, totalCourses,
//     activeCohorts, pendingSubmissions, paymentsThisMonth, activeUsersLast7Days } }
//
// Note: the engine does NOT return enrollmentByDepartment, gradeDistribution,
// or enrollmentTrend — those are placeholders for future Phase 2 work.
// We return empty arrays for those to keep the analytics page rendering cleanly.
export async function getAnalyticsOverview() {
  try {
    const json = await apiGet('/api/v1/analytics/overview')

    // Engine wraps in { success, overview: {...} }
    const ov = json.overview || json.data?.overview || {}

    return {
      overview: {
        totalStudents:        ov.totalStudents        ?? 0,
        totalLecturers:       ov.totalLecturers       ?? 0,
        activeCourses:        ov.totalCourses         ?? ov.activeCourses ?? 0,
        activeCohorts:        ov.activeCohorts        ?? 0,
        pendingSubmissions:   ov.pendingSubmissions   ?? 0,
        activeUsersLast7Days: ov.activeUsersLast7Days ?? 0,
        paymentsThisMonth:    ov.paymentsThisMonth    ?? { total: '0', count: 0 },
        // passRate is not yet computed by engine — placeholder
        passRate:             ov.passRate             ?? 0,
      },
      // These arrays are not yet implemented in the engine (Phase 2).
      // Return empty so the analytics page gracefully shows "No data yet."
      enrollmentByDepartment: ov.enrollmentByDepartment ?? [],
      gradeDistribution:      ov.gradeDistribution      ?? [],
      enrollmentTrend:        ov.enrollmentTrend         ?? [],
      attendanceByCourse:     ov.attendanceByCourse      ?? [],
      courses:                ov.courses                 ?? [],
      // Flat aliases for any legacy component props
      totalCourses:    ov.totalCourses   ?? ov.activeCourses ?? 0,
      totalStudents:   ov.totalStudents  ?? 0,
      totalLecturers:  ov.totalLecturers ?? 0,
      attendanceRate:  ov.attendanceRate ?? 0,
    }
  } catch {
    return EMPTY
  }
}

// ─── GET /api/v1/analytics/course/:courseId ───────────────────────────────────
export async function getCourseAnalytics(courseId) {
  try {
    const json = await apiGet(`/api/v1/analytics/course/${courseId}`)
    return json.analytics || json.data || null
  } catch {
    return null
  }
}

// ─── GET /api/v1/analytics/student/:studentId ─────────────────────────────────
export async function getStudentAnalytics(studentId) {
  try {
    const json = await apiGet(`/api/v1/analytics/student/${studentId}`)
    return json.analytics || json.data || null
  } catch {
    return null
  }
}