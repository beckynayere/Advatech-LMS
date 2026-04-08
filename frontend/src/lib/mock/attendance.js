export const mockAttendance = [
  {
    courseId: 'CS301',
    courseCode: 'CS301',
    courseTitle: 'Data Structures & Algorithms',
    sessions: [
      {
        id: 'sess1',
        date: '2025-03-03',
        topic: 'Introduction to DSA',
        records: [
          { studentId: 4, studentName: 'Alice Ochieng', status: 'present' },
          { studentId: 5, studentName: 'Brian Kamau', status: 'present' },
        ],
      },
      {
        id: 'sess2',
        date: '2025-03-10',
        topic: 'Arrays and Linked Lists',
        records: [
          { studentId: 4, studentName: 'Alice Ochieng', status: 'present' },
          { studentId: 5, studentName: 'Brian Kamau', status: 'absent' },
        ],
      },
      {
        id: 'sess3',
        date: '2025-03-17',
        topic: 'Trees and Binary Search',
        records: [
          { studentId: 4, studentName: 'Alice Ochieng', status: 'present' },
          { studentId: 5, studentName: 'Brian Kamau', status: 'present' },
        ],
      },
    ],
  },
  {
    courseId: 'CS205',
    courseCode: 'CS205',
    courseTitle: 'Database Systems',
    sessions: [
      {
        id: 'sess4',
        date: '2025-03-05',
        topic: 'Relational Model',
        records: [
          { studentId: 4, studentName: 'Alice Ochieng', status: 'present' },
          { studentId: 5, studentName: 'Brian Kamau', status: 'present' },
        ],
      },
      {
        id: 'sess5',
        date: '2025-03-12',
        topic: 'SQL Fundamentals',
        records: [
          { studentId: 4, studentName: 'Alice Ochieng', status: 'absent' },
          { studentId: 5, studentName: 'Brian Kamau', status: 'present' },
        ],
      },
    ],
  },
  {
    courseId: 'MATH201',
    courseCode: 'MATH201',
    courseTitle: 'Calculus II',
    sessions: [
      {
        id: 'sess6',
        date: '2025-03-04',
        topic: 'Integration by Parts',
        records: [
          { studentId: 6, studentName: 'Carol Wanjiku', status: 'present' },
        ],
      },
      {
        id: 'sess7',
        date: '2025-03-11',
        topic: 'Trigonometric Integrals',
        records: [
          { studentId: 6, studentName: 'Carol Wanjiku', status: 'present' },
        ],
      },
    ],
  },
]