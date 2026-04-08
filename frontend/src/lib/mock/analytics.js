export const mockAnalytics = {
  overview: {
    totalStudents: 135,
    totalLecturers: 8,
    activeCourses: 3,
    passRate: 78,
    avgAttendance: 82,
  },
  enrollmentByDepartment: [
    { department: 'Computer Science', count: 62 },
    { department: 'Mathematics', count: 55 },
    { department: 'Engineering', count: 18 },
  ],
  gradeDistribution: [
    { grade: 'A', count: 28 },
    { grade: 'B', count: 45 },
    { grade: 'C', count: 32 },
    { grade: 'D', count: 18 },
    { grade: 'F', count: 12 },
  ],
  attendanceByCourse: [
    { course: 'CS301', rate: 88 },
    { course: 'CS205', rate: 79 },
    { course: 'MATH201', rate: 84 },
  ],
  enrollmentTrend: [
    { month: 'Sep', count: 88 },
    { month: 'Oct', count: 92 },
    { month: 'Nov', count: 95 },
    { month: 'Dec', count: 95 },
    { month: 'Jan', count: 128 },
    { month: 'Feb', count: 133 },
    { month: 'Mar', count: 135 },
  ],
}