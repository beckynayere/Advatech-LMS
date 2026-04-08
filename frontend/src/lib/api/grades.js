// DESTINATION: src/lib/api/grades.js
// Unified gradebook: pulls from assignments (mySubmission on list),
// quizzes (attempts), and exam grades — aggregates per course.

import { apiGet } from './client'

// ─── Letter grade helper ───────────────────────────────────────────────────────
function letterGrade(pct) {
  if (pct >= 70) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}

// ─── Assignment grades ─────────────────────────────────────────────────────────
// Reads mySubmission directly from the assignment list — no extra per-assignment request.
async function getMyAssignmentGrades() {
  try {
    const data = await apiGet('/api/v1/assignments?limit=200')
    const assignments = data.data || []

    return assignments
      .filter(a => a.mySubmission && a.mySubmission.marks != null)
      .map(a => ({
        source:      'assignment',
        courseId:    String(a.courseId || a.course?.id || ''),
        courseName:  a.course?.name || '',
        courseCode:  a.course?.code || '',
        itemId:      String(a.id),
        itemTitle:   a.title || 'Assignment',
        marks:       Number(a.mySubmission.marks),
        maxMarks:    Number(a.maxMarks || 100),
        feedback:    a.mySubmission.feedback || '',
        gradedAt:    a.mySubmission.gradedAt || null,
      }))
  } catch {
    return []
  }
}

// ─── Quiz grades ───────────────────────────────────────────────────────────────
// The engine stores quiz attempt scores in quiz_attempts.score (percentage 0-100).
// We fetch each course's quizzes then find submitted attempts.
// To avoid N+1 we fetch the full quiz list then pull the student's own attempts
// for each quiz that has questionCount > 0.
async function getMyQuizGrades() {
  try {
    const data = await apiGet('/api/v1/quizzes?limit=200')
    const quizzes = data.data || []

    const gradedItems = []

    await Promise.allSettled(
      quizzes
        .filter(q => (q._count?.attempts ?? 0) > 0 || q.questionCount > 0)
        .map(async (q) => {
          try {
            // GET /api/v1/quizzes/:quizId/attempts — returns all attempts for this student
            // (The engine returns only the current user's attempts when role=student)
            const attData = await apiGet(`/api/v1/quizzes/${q.id}/attempts?limit=10`)
            const attempts = (attData.data || attData.attempts || [])
              .filter(a => a.status === 'submitted')

            if (attempts.length === 0) return

            // Use the best attempt (highest score)
            const best = attempts.reduce((a, b) =>
              Number(a.score ?? 0) >= Number(b.score ?? 0) ? a : b
            )

            // score is stored as a percentage (0-100)
            const scorePct = Number(best.score ?? 0)

            // Derive actual marks from question total if available
            const totalQuestionMarks = (q.questions || []).reduce((s, qq) => s + (qq.marks ?? 1), 0)
            const maxMarks = totalQuestionMarks || 100
            const actualMarks = (scorePct / 100) * maxMarks

            gradedItems.push({
              source:      'quiz',
              courseId:    String(q.courseId || q.course?.id || ''),
              courseName:  q.course?.name || '',
              courseCode:  q.course?.code || '',
              itemId:      String(q.id),
              itemTitle:   q.title || 'Quiz',
              marks:       Math.round(actualMarks * 10) / 10,
              maxMarks,
              scorePct,
              feedback:    '',
              gradedAt:    best.submittedAt || null,
            })
          } catch { /* skip individual quiz errors */ }
        })
    )

    return gradedItems
  } catch {
    return []
  }
}

// ─── Exam grades ───────────────────────────────────────────────────────────────
// GET /api/v1/grades/my returns exam grades grouped by course.
async function getMyExamGrades() {
  try {
    const data = await apiGet('/api/v1/grades/my')
    // Engine returns: { data: [ { course: {...}, grades: [{...}] } ] }
    const courses = data.data || []

    const items = []
    for (const courseGroup of courses) {
      const course = courseGroup.course || {}
      for (const g of courseGroup.grades || []) {
        items.push({
          source:      'exam',
          courseId:    String(course.id || g.examId || ''),
          courseName:  course.name || '',
          courseCode:  course.code || '',
          itemId:      String(g.examId),
          itemTitle:   g.examTitle || g.examType || 'Exam',
          examType:    g.examType || '',
          marks:       Number(g.marks),
          maxMarks:    Number(g.maxMarks || 100),
          feedback:    g.feedback || '',
          gradedAt:    g.gradedAt || null,
        })
      }
    }
    return items
  } catch {
    return []
  }
}

// ─── Aggregate: compute percentage and letter grade from items ─────────────────
function aggregateItems(items) {
  if (!items.length) return { percentage: 0, letterGrade: 'N/A', breakdown: [] }
  const total    = items.reduce((s, i) => s + i.marks, 0)
  const maxTotal = items.reduce((s, i) => s + i.maxMarks, 0)
  const pct      = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0
  return {
    percentage:  pct,
    letterGrade: letterGrade(pct),
    breakdown:   items.map(i => ({
      source:          i.source,
      assignmentTitle: i.itemTitle,
      examType:        i.examType || '',
      grade:           i.marks,
      totalMarks:      i.maxMarks,
      feedback:        i.feedback,
      gradedAt:        i.gradedAt,
    })),
  }
}

// ─── Public: getGradesForStudent ───────────────────────────────────────────────
// Returns: [{ courseId, courseTitle, courseCode, percentage, letterGrade, breakdown[] }]
export async function getGradesForStudent() {
  const [assignGrades, quizGrades, examGrades] = await Promise.all([
    getMyAssignmentGrades(),
    getMyQuizGrades(),
    getMyExamGrades(),
  ])

  const allItems = [...assignGrades, ...quizGrades, ...examGrades]

  // Group by courseId
  const byCourse = {}
  for (const item of allItems) {
    const key = item.courseId || 'unknown'
    if (!byCourse[key]) {
      byCourse[key] = {
        courseId:   item.courseId,
        courseTitle:item.courseName || `Course ${item.courseId}`,
        courseCode: item.courseCode || '',
        items:      [],
      }
    }
    byCourse[key].items.push(item)
  }

  return Object.values(byCourse)
    .map(course => ({
      courseId:    course.courseId,
      courseTitle: course.courseTitle,
      courseCode:  course.courseCode,
      ...aggregateItems(course.items),
    }))
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle))
}

// ─── Lecturer: getCourseGradebook ──────────────────────────────────────────────
// Returns per-student, per-assignment grade rows for a specific course.
export async function getCourseGradebook(courseId) {
  try {
    const assignData = await apiGet(`/api/v1/assignments?courseId=${courseId}&limit=100`)
    const assignments = assignData.data || []

    const rows = []
    await Promise.allSettled(
      assignments.map(async (a) => {
        try {
          const sd = await apiGet(`/api/v1/assignments/${a.id}/submissions?limit=200`)
          const subs = sd.data || sd.submissions || []
          for (const s of subs) {
            rows.push({
              assignmentId:    String(a.id),
              assignmentTitle: a.title,
              maxMarks:        a.maxMarks || 100,
              studentId:       String(s.studentId),
              studentName:     s.student?.name || `Student ${s.studentId}`,
              studentEmail:    s.student?.email || '',
              marks:           s.marks != null ? Number(s.marks) : null,
              status:          s.status,
              feedback:        s.feedback || '',
              submittedAt:     s.submittedAt,
            })
          }
        } catch { /* skip */ }
      })
    )
    return rows
  } catch {
    return []
  }
}

export { getCourseGradebook as getGradesForCourse }