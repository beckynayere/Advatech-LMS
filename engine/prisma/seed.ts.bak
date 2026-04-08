// DESTINATION: prisma/seed.ts
// Full realistic seed — Technical University of Kenya (TUK)
// Run: pnpm prisma db seed
// All accounts: password = ChangeMe@2025!

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysFromNow(n: number) { return new Date(Date.now() + n * 86_400_000); }
function daysAgo(n: number)     { return new Date(Date.now() - n * 86_400_000); }
function hoursFromNow(n: number){ return new Date(Date.now() + n * 3_600_000);  }
function hoursAgo(n: number)    { return new Date(Date.now() - n * 3_600_000);  }

async function main() {
  console.log("🌱  Seeding AdvaTech LMS — Technical University of Kenya\n");
  const pw = await bcrypt.hash("ChangeMe@2025!", 12);

  // ── Roles ────────────────────────────────────────────────────────────────────
  const roleNames = ["platform_admin", "institution_admin", "lecturer", "student"];
  for (const name of roleNames) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  const roleMap: Record<string, any> = {};
  for (const name of roleNames) {
    roleMap[name] = await prisma.role.findUniqueOrThrow({ where: { name } });
  }
  console.log("✓  Roles");

  // ── Institution ──────────────────────────────────────────────────────────────
  const institution = await prisma.institution.upsert({
    where: { slug: "tuk" }, update: {},
    create: {
      name: "Technical University of Kenya",
      slug: "tuk",
      domain: "tuk.advatech.ac.ke",
      primaryColor: "#0d9488",
      isActive: true,
    },
  });
  console.log(`✓  Institution: ${institution.name}`);

  // ── Platform admin ───────────────────────────────────────────────────────────
  const platformAdmin = await prisma.user.upsert({
    where: { email: "admin@advatech.ac.ke" }, update: {},
    create: { email: "admin@advatech.ac.ke", passwordHash: pw, name: "Platform Admin", emailVerified: true, isActive: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: platformAdmin.id, roleId: roleMap.platform_admin.id } },
    update: {}, create: { userId: platformAdmin.id, roleId: roleMap.platform_admin.id },
  });

  // ── Institution admin ────────────────────────────────────────────────────────
  const instAdmin = await prisma.user.upsert({
    where: { email: "admin@tuk.ac.ke" }, update: {},
    create: { email: "admin@tuk.ac.ke", passwordHash: pw, name: "Dr. James Odhiambo", institutionId: institution.id, emailVerified: true, isActive: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: instAdmin.id, roleId: roleMap.institution_admin.id } },
    update: {}, create: { userId: instAdmin.id, roleId: roleMap.institution_admin.id, institutionId: institution.id },
  });
  console.log("✓  Admins");

  // ── Schools ──────────────────────────────────────────────────────────────────
  const schoolsData = [
    { name: "School of Information & Communication Technology", code: "SICT" },
    { name: "School of Engineering",                            code: "SENG" },
    { name: "School of Mathematics & Statistics",               code: "SMATH" },
    { name: "School of Business",                               code: "SBUS" },
  ];
  const schools: Record<string, any> = {};
  for (const s of schoolsData) {
    schools[s.code] = await prisma.school.upsert({
      where: { code_institutionId: { code: s.code, institutionId: institution.id } },
      update: {}, create: { ...s, institutionId: institution.id, type: "school" },
    });
  }

  // ── Departments ──────────────────────────────────────────────────────────────
  const deptsData = [
    { name: "Computer Science",        code: "CS",   schoolCode: "SICT"  },
    { name: "Information Technology",  code: "IT",   schoolCode: "SICT"  },
    { name: "Electrical Engineering",  code: "EEE",  schoolCode: "SENG"  },
    { name: "Mathematics",             code: "MATH", schoolCode: "SMATH" },
    { name: "Business Administration", code: "BBA",  schoolCode: "SBUS"  },
  ];
  const depts: Record<string, any> = {};
  for (const d of deptsData) {
    depts[d.code] = await prisma.department.upsert({
      where: { code_institutionId: { code: d.code, institutionId: institution.id } },
      update: {}, create: { name: d.name, code: d.code, schoolId: schools[d.schoolCode].id, institutionId: institution.id },
    });
  }
  console.log("✓  Schools + Departments");

  // ── Lecturers (5) ────────────────────────────────────────────────────────────
  const lecturersData = [
    { email: "lecturer@tuk.ac.ke",  name: "Dr. Jane Mwangi",     deptCode: "CS",   emp: "TUK-LEC-001", spec: "Software Engineering"         },
    { email: "d.omondi@tuk.ac.ke",  name: "Mr. David Omondi",    deptCode: "MATH", emp: "TUK-LEC-002", spec: "Calculus & Analysis"           },
    { email: "p.wanjiku@tuk.ac.ke", name: "Prof. Peter Wanjiku", deptCode: "CS",   emp: "TUK-LEC-003", spec: "Data Structures & Algorithms"  },
    { email: "s.akinyi@tuk.ac.ke",  name: "Dr. Sarah Akinyi",    deptCode: "IT",   emp: "TUK-LEC-004", spec: "Database Systems"              },
    { email: "m.kamau@tuk.ac.ke",   name: "Mr. Moses Kamau",     deptCode: "EEE",  emp: "TUK-LEC-005", spec: "Circuit Theory"                },
  ];
  const lecturers: Record<string, any>        = {};
  const lecturerProfiles: Record<string, any> = {};
  for (const l of lecturersData) {
    const user = await prisma.user.upsert({
      where: { email: l.email }, update: {},
      create: { email: l.email, passwordHash: pw, name: l.name, institutionId: institution.id, emailVerified: true, isActive: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleMap.lecturer.id } },
      update: {}, create: { userId: user.id, roleId: roleMap.lecturer.id, institutionId: institution.id },
    });
    const profile = await prisma.lecturerProfile.upsert({
      where: { userId: user.id }, update: {},
      create: { userId: user.id, institutionId: institution.id, employeeId: l.emp, specialization: l.spec, department: depts[l.deptCode].name },
    });
    lecturers[l.email]        = user;
    lecturerProfiles[l.email] = profile;
  }
  console.log(`✓  Lecturers (${lecturersData.length})`);

  // ── Students (20) ────────────────────────────────────────────────────────────
  const studentsData = [
    { email: "student@tuk.ac.ke",            name: "Alice Kamau",     reg: "TUK/CS/2024/001",   year: 1 },
    { email: "b.otieno@student.tuk.ac.ke",   name: "Brian Otieno",    reg: "TUK/CS/2024/002",   year: 1 },
    { email: "c.wanjiru@student.tuk.ac.ke",  name: "Carol Wanjiru",   reg: "TUK/CS/2024/003",   year: 1 },
    { email: "d.mwenda@student.tuk.ac.ke",   name: "Dennis Mwenda",   reg: "TUK/CS/2024/004",   year: 1 },
    { email: "e.auma@student.tuk.ac.ke",     name: "Esther Auma",     reg: "TUK/CS/2024/005",   year: 1 },
    { email: "f.njoroge@student.tuk.ac.ke",  name: "Felix Njoroge",   reg: "TUK/CS/2024/006",   year: 1 },
    { email: "g.odhiambo@student.tuk.ac.ke", name: "Grace Odhiambo", reg: "TUK/CS/2024/007",   year: 1 },
    { email: "h.kimani@student.tuk.ac.ke",   name: "Hassan Kimani",   reg: "TUK/CS/2024/008",   year: 1 },
    { email: "i.wairimu@student.tuk.ac.ke",  name: "Irene Wairimu",   reg: "TUK/CS/2023/001",   year: 2 },
    { email: "j.mutua@student.tuk.ac.ke",    name: "James Mutua",     reg: "TUK/CS/2023/002",   year: 2 },
    { email: "k.chebet@student.tuk.ac.ke",   name: "Kevin Chebet",    reg: "TUK/CS/2023/003",   year: 2 },
    { email: "l.adhiambo@student.tuk.ac.ke", name: "Lucy Adhiambo",   reg: "TUK/CS/2023/004",   year: 2 },
    { email: "m.waweru@student.tuk.ac.ke",   name: "Mark Waweru",     reg: "TUK/CS/2023/005",   year: 2 },
    { email: "n.akoth@student.tuk.ac.ke",    name: "Nancy Akoth",     reg: "TUK/CS/2023/006",   year: 2 },
    { email: "o.kariuki@student.tuk.ac.ke",  name: "Oscar Kariuki",   reg: "TUK/MATH/2024/001", year: 1 },
    { email: "p.muthoni@student.tuk.ac.ke",  name: "Purity Muthoni",  reg: "TUK/MATH/2024/002", year: 1 },
    { email: "q.okoth@student.tuk.ac.ke",    name: "Quentin Okoth",   reg: "TUK/IT/2024/001",   year: 1 },
    { email: "r.njeri@student.tuk.ac.ke",    name: "Rose Njeri",      reg: "TUK/IT/2024/002",   year: 1 },
    { email: "s.muriuki@student.tuk.ac.ke",  name: "Samuel Muriuki",  reg: "TUK/CS/2022/001",   year: 3 },
    { email: "t.atieno@student.tuk.ac.ke",   name: "Tabitha Atieno",  reg: "TUK/CS/2022/002",   year: 3 },
  ];
  const students: any[] = [];
  for (const s of studentsData) {
    const user = await prisma.user.upsert({
      where: { email: s.email }, update: {},
      create: { email: s.email, passwordHash: pw, name: s.name, institutionId: institution.id, emailVerified: true, isActive: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleMap.student.id } },
      update: {}, create: { userId: user.id, roleId: roleMap.student.id, institutionId: institution.id },
    });
    await prisma.studentProfile.upsert({
      where: { userId: user.id }, update: {},
      create: {
        userId: user.id, institutionId: institution.id,
        registrationNo: s.reg, yearOfStudy: s.year,
        admissionYear: 2024 - (s.year - 1),
      },
    });
    students.push({ ...user, year: s.year });
  }
  console.log(`✓  Students (${studentsData.length})`);

  // ── Courses (8) ──────────────────────────────────────────────────────────────
  const coursesData = [
    { code: "CS101",   name: "Introduction to Computer Science", desc: "Foundational concepts in computing, algorithms, and programming.", credits: 3, deptCode: "CS",   schoolCode: "SICT",  lecEmail: "lecturer@tuk.ac.ke"  },
    { code: "CS201",   name: "Data Structures & Algorithms",     desc: "Arrays, linked lists, trees, graphs, sorting, and complexity.",    credits: 4, deptCode: "CS",   schoolCode: "SICT",  lecEmail: "p.wanjiku@tuk.ac.ke" },
    { code: "CS301",   name: "Database Systems",                 desc: "Relational databases, SQL, normalization, and NoSQL.",              credits: 3, deptCode: "CS",   schoolCode: "SICT",  lecEmail: "s.akinyi@tuk.ac.ke"  },
    { code: "CS401",   name: "Software Engineering",             desc: "SDLC methodologies, design patterns, testing, and management.",    credits: 3, deptCode: "CS",   schoolCode: "SICT",  lecEmail: "lecturer@tuk.ac.ke"  },
    { code: "MATH101", name: "Calculus I",                       desc: "Limits, derivatives, integrals, and their applications.",           credits: 4, deptCode: "MATH", schoolCode: "SMATH", lecEmail: "d.omondi@tuk.ac.ke"  },
    { code: "MATH201", name: "Linear Algebra",                   desc: "Vectors, matrices, eigenvalues, and linear transformations.",       credits: 3, deptCode: "MATH", schoolCode: "SMATH", lecEmail: "d.omondi@tuk.ac.ke"  },
    { code: "IT101",   name: "Networking Fundamentals",          desc: "OSI model, TCP/IP, routing, switching, and network security.",      credits: 3, deptCode: "IT",   schoolCode: "SICT",  lecEmail: "s.akinyi@tuk.ac.ke"  },
    { code: "EEE101",  name: "Circuit Theory",                   desc: "DC/AC circuits, Kirchhoff's laws, Thevenin/Norton theorems.",       credits: 3, deptCode: "EEE",  schoolCode: "SENG",  lecEmail: "m.kamau@tuk.ac.ke"   },
  ];
  const courses: Record<string, any> = {};
  for (const c of coursesData) {
    const course = await prisma.course.upsert({
      where: { code_institutionId: { code: c.code, institutionId: institution.id } }, update: {},
      create: {
        name: c.name, code: c.code, description: c.desc, credits: c.credits,
        semester: "Semester 1", academicYear: "2024/2025",
        schoolId: schools[c.schoolCode].id, departmentId: depts[c.deptCode].id,
        institutionId: institution.id, createdBy: lecturers[c.lecEmail].id,
      },
    });
    await prisma.courseLecturer.upsert({
      where: { courseId_lecturerId: { courseId: course.id, lecturerId: lecturerProfiles[c.lecEmail].id } },
      update: {}, create: { courseId: course.id, lecturerId: lecturerProfiles[c.lecEmail].id, institutionId: institution.id },
    });
    courses[c.code] = course;
  }
  console.log(`✓  Courses (${coursesData.length})`);

  // ── Cohorts + Enrollments ────────────────────────────────────────────────────
  const year1CS      = students.slice(0, 8);
  const year2CS      = students.slice(8, 14);
  const year3CS      = students.slice(18, 20);
  const mathStudents = students.slice(14, 16);
  const itStudents   = students.slice(16, 18);

  async function makeCohort(code: string, name: string, enrolls: any[], linkCodes: string[], coordEmail: string) {
    const lp     = lecturerProfiles[coordEmail];
    const cohort = await prisma.cohort.upsert({
      where: { code_institutionId: { code, institutionId: institution.id } }, update: {},
      create: {
        name, code, academicYear: "2024/2025", semester: "Semester 1",
        maxStudents: 60, startDate: new Date("2024-09-02"), endDate: new Date("2025-01-31"),
        coordinatorId: lp.id, institutionId: institution.id, createdBy: instAdmin.id,
      },
    });
    for (const cc of linkCodes) {
      await prisma.cohortCourse.upsert({
        where: { cohortId_courseId: { cohortId: cohort.id, courseId: courses[cc].id } },
        update: {}, create: { cohortId: cohort.id, courseId: courses[cc].id, institutionId: institution.id },
      });
    }
    for (const s of enrolls) {
      await prisma.cohortEnrollment.upsert({
        where: { cohortId_studentId: { cohortId: cohort.id, studentId: s.id } },
        update: {}, create: { cohortId: cohort.id, studentId: s.id, institutionId: institution.id },
      });
    }
    return cohort;
  }
  await makeCohort("CS-Y1-S1", "CS Year 1 — Sem 1",  year1CS,      ["CS101","MATH101","IT101"],  "lecturer@tuk.ac.ke");
  await makeCohort("CS-Y2-S1", "CS Year 2 — Sem 1",  year2CS,      ["CS201","CS301","MATH201"],  "p.wanjiku@tuk.ac.ke");
  await makeCohort("CS-Y3-S1", "CS Year 3 — Sem 1",  year3CS,      ["CS401"],                   "lecturer@tuk.ac.ke");
  await makeCohort("MATH-Y1",  "Maths Year 1",        mathStudents, ["MATH101","MATH201"],        "d.omondi@tuk.ac.ke");
  await makeCohort("IT-Y1",    "IT Year 1",           itStudents,   ["IT101","CS101"],            "s.akinyi@tuk.ac.ke");
  console.log("✓  Cohorts + Enrollments");

  // ── Course Materials ─────────────────────────────────────────────────────────
  const materialsData = [
    // CS101
    { courseCode: "CS101", schoolCode: "SICT", title: "Week 1 — Introduction Slides", type: "link", externalUrl: "https://docs.google.com/presentation/d/1example", weekNumber: 1, desc: "Slides covering the course overview and intro to computing.", lecEmail: "lecturer@tuk.ac.ke" },
    { courseCode: "CS101", schoolCode: "SICT", title: "Week 1 — Python Installation Guide", type: "document", content: "Download Python 3.12 from python.org. Install VS Code. Run `python --version` to verify.", weekNumber: 1, desc: "Setup guide for your development environment.", lecEmail: "lecturer@tuk.ac.ke" },
    { courseCode: "CS101", schoolCode: "SICT", title: "Week 2 — Variables & Data Types", type: "link", externalUrl: "https://docs.google.com/presentation/d/2example", weekNumber: 2, desc: "Variables, strings, integers, floats, booleans.", lecEmail: "lecturer@tuk.ac.ke" },
    { courseCode: "CS101", schoolCode: "SICT", title: "Week 3 — Control Flow Notes", type: "document", content: "# Control Flow\n\nif/elif/else statements and for/while loops in Python.\n\n```python\nfor i in range(10):\n    if i % 2 == 0:\n        print(f\"{i} is even\")\n```", weekNumber: 3, desc: "Conditionals and loops reference.", lecEmail: "lecturer@tuk.ac.ke" },
    { courseCode: "CS101", schoolCode: "SICT", title: "Week 4 — Functions Tutorial (YouTube)", type: "video", externalUrl: "https://www.youtube.com/watch?v=9Os0o3wzS_I", weekNumber: 4, desc: "Corey Schafer's Python functions tutorial.", lecEmail: "lecturer@tuk.ac.ke" },
    // CS201
    { courseCode: "CS201", schoolCode: "SICT", title: "DSA Textbook — Chapters 1–5", type: "link", externalUrl: "https://visualgo.net/en", weekNumber: 1, desc: "VisuAlgo for interactive visualizations of data structures.", lecEmail: "p.wanjiku@tuk.ac.ke" },
    { courseCode: "CS201", schoolCode: "SICT", title: "Complexity Cheat Sheet", type: "document", content: "# Big-O Reference\n\n| Algorithm | Best | Average | Worst |\n|---|---|---|---|\n| Bubble Sort | O(n) | O(n²) | O(n²) |\n| Merge Sort | O(n log n) | O(n log n) | O(n log n) |\n| Binary Search | O(1) | O(log n) | O(log n) |", weekNumber: 2, desc: "Quick reference for algorithm complexities.", lecEmail: "p.wanjiku@tuk.ac.ke" },
    // CS301
    { courseCode: "CS301", schoolCode: "SICT", title: "PostgreSQL Installation Guide", type: "document", content: "Install PostgreSQL 16:\n\nUbuntu: sudo apt install postgresql\nmacOS: brew install postgresql\nWindows: Download installer from postgresql.org", weekNumber: 1, desc: "Setting up your local database environment.", lecEmail: "s.akinyi@tuk.ac.ke" },
    { courseCode: "CS301", schoolCode: "SICT", title: "SQL Reference — W3Schools", type: "link", externalUrl: "https://www.w3schools.com/sql/", weekNumber: 2, desc: "Complete SQL reference and interactive examples.", lecEmail: "s.akinyi@tuk.ac.ke" },
    // MATH101
    { courseCode: "MATH101", schoolCode: "SMATH", title: "Week 1 — Limits & Continuity Notes", type: "document", content: "# Limits\n\nThe limit of f(x) as x→a is L if f(x) approaches L as x approaches a.\n\n**Key rules:**\n- lim[f(x) + g(x)] = lim f(x) + lim g(x)\n- lim[c·f(x)] = c·lim f(x)\n- L'Hôpital's Rule: lim f/g = lim f'/g' when 0/0 or ∞/∞", weekNumber: 1, desc: "Lecture notes on limits and continuity.", lecEmail: "d.omondi@tuk.ac.ke" },
    { courseCode: "MATH101", schoolCode: "SMATH", title: "Derivatives Formula Sheet", type: "document", content: "d/dx(xⁿ) = nxⁿ⁻¹\nd/dx(sin x) = cos x\nd/dx(cos x) = -sin x\nd/dx(eˣ) = eˣ\nd/dx(ln x) = 1/x\nChain Rule: d/dx[f(g(x))] = f'(g(x))·g'(x)", weekNumber: 3, desc: "All derivative formulas in one place.", lecEmail: "d.omondi@tuk.ac.ke" },
  ];
  let matCount = 0;
  for (const m of materialsData) {
    const existing = await prisma.courseMaterial.findFirst({ where: { courseId: courses[m.courseCode].id, title: m.title } });
    if (!existing) {
      await prisma.courseMaterial.create({
        data: {
          title: m.title,
          description: m.desc || null,
          type: m.type,
          externalUrl: (m as any).externalUrl || null,
          content: (m as any).content || null,
          weekNumber: m.weekNumber || null,
          courseId: courses[m.courseCode].id,
          schoolId: schools[m.schoolCode].id,
          departmentId: depts[m.courseCode === "MATH101" || m.courseCode === "MATH201" ? "MATH" : m.courseCode.startsWith("IT") ? "IT" : m.courseCode.startsWith("EEE") ? "EEE" : "CS"].id,
          institutionId: institution.id,
          createdBy: lecturers[m.lecEmail].id,
          isVisible: true,
          isLocked: false,
          sortOrder: matCount,
        },
      });
      matCount++;
    }
  }
  console.log(`✓  Course Materials (${matCount})`);

  // ── Assignments ──────────────────────────────────────────────────────────────
  const assignmentsData = [
    { title: "Week 1 — Hello World",          desc: "Write a Python program that asks for the user's name and greets them. Submit your .py file.",   courseCode: "CS101",   dueOffset: -14, maxMarks: 100, pub: true  },
    { title: "Week 3 — Loops & Conditionals", desc: "Implement FizzBuzz (1–100) and a number guessing game with 5 attempts.",                         courseCode: "CS101",   dueOffset: -3,  maxMarks: 100, pub: true  },
    { title: "Midterm Project — Calculator",  desc: "Build a CLI calculator with +, -, *, / and error handling for division by zero.",                 courseCode: "CS101",   dueOffset:  7,  maxMarks: 100, pub: true  },
    { title: "Week 5 — File I/O",             desc: "Read a CSV file of student marks, calculate averages, and write results to a new file.",          courseCode: "CS101",   dueOffset: 14,  maxMarks: 100, pub: false },
    { title: "Linked List Implementation",    desc: "Implement a singly and doubly linked list with insert, delete, search, and print.",               courseCode: "CS201",   dueOffset: -10, maxMarks: 80,  pub: true  },
    { title: "Binary Search Tree",            desc: "Build a BST with insert, search, delete, and inorder/preorder/postorder traversals.",             courseCode: "CS201",   dueOffset:  5,  maxMarks: 80,  pub: true  },
    { title: "Graph Traversal",               desc: "Implement BFS and DFS on an adjacency list graph. Print the traversal order.",                    courseCode: "CS201",   dueOffset: 15,  maxMarks: 80,  pub: false },
    { title: "ER Diagram — University DB",    desc: "Design an ER diagram for a university management system with at least 8 entities.",               courseCode: "CS301",   dueOffset: -7,  maxMarks: 60,  pub: true  },
    { title: "SQL Queries Assignment",        desc: "Write 15 SQL queries (SELECT, JOIN, GROUP BY, subqueries) on the university schema.",             courseCode: "CS301",   dueOffset:  4,  maxMarks: 60,  pub: true  },
    { title: "Requirements Document (SRS)",   desc: "Write an SRS document for a library management system following IEEE 830.",                       courseCode: "CS401",   dueOffset: -5,  maxMarks: 100, pub: true  },
    { title: "System Design Document",        desc: "Design the architecture for the library system — use UML class and sequence diagrams.",           courseCode: "CS401",   dueOffset: 10,  maxMarks: 100, pub: true  },
    { title: "Derivatives Problem Set",       desc: "Solve 20 differentiation problems using power, chain, product, and quotient rules.",              courseCode: "MATH101", dueOffset: -8,  maxMarks: 100, pub: true  },
    { title: "Integration Problem Set",       desc: "Solve 15 integration problems using substitution and integration by parts.",                      courseCode: "MATH101", dueOffset:  6,  maxMarks: 100, pub: true  },
    { title: "Matrix Operations",             desc: "Perform matrix multiplication, find determinants, and compute inverses for 5 matrix pairs.",      courseCode: "MATH201", dueOffset:  3,  maxMarks: 80,  pub: true  },
    { title: "Network Topology Design",       desc: "Design a LAN topology for a 3-floor office building with 50 users per floor. Include IP plan.",   courseCode: "IT101",   dueOffset: -4,  maxMarks: 80,  pub: true  },
    { title: "Subnetting Exercise",           desc: "Subnet 192.168.10.0/24 into 6 subnets. Show network/broadcast addresses and host ranges.",       courseCode: "IT101",   dueOffset:  8,  maxMarks: 80,  pub: true  },
    { title: "Kirchhoff's Laws Problems",     desc: "Solve 10 circuit problems using KVL and KCL. Show all working.",                                  courseCode: "EEE101",  dueOffset: -6,  maxMarks: 100, pub: true  },
  ];
  const assignmentMap: Record<string, any> = {};
  for (const a of assignmentsData) {
    const course   = courses[a.courseCode];
    const cData    = coursesData.find(c => c.code === a.courseCode)!;
    const existing = await prisma.assignment.findFirst({ where: { courseId: course.id, title: a.title } });
    const rec = existing ?? await prisma.assignment.create({
      data: {
        title: a.title, description: a.desc, instructions: a.desc,
        courseId: course.id, schoolId: schools[cData.schoolCode].id,
        dueDate: daysFromNow(a.dueOffset), maxMarks: a.maxMarks,
        allowLateSubmit: true, latePenaltyPct: 10, maxAttempts: 2,
        isPublished: a.pub, institutionId: institution.id, createdBy: lecturers[cData.lecEmail].id,
      },
    });
    assignmentMap[`${a.courseCode}::${a.title}`] = rec;
  }
  console.log(`✓  Assignments (${assignmentsData.length})`);

  // ── Submissions + Grades ─────────────────────────────────────────────────────
  type SubSeed = {
    courseCode: string; assignmentTitle: string; student: any;
    marks: number | null; graded: boolean; feedback: string; daysAgoN: number;
  };

  const feedbacks = [
    "Excellent work! Well structured and commented.",
    "Good effort. Minor issues with variable naming.",
    "Correct solution but missing edge case handling.",
    "Well done! Clean and efficient implementation.",
    "Needs improvement — some logic errors present.",
    "Satisfactory. Review the feedback and resubmit if needed.",
    "Great work! Above expectations.",
    "Acceptable. Please review the marking scheme.",
  ];

  const submissionsSeeds: SubSeed[] = [
    // CS101 Week 1
    ...year1CS.map((s: any, i: number) => ({
      courseCode: "CS101", assignmentTitle: "Week 1 — Hello World",
      student: s, marks: 70 + Math.floor(Math.random() * 26), graded: true,
      feedback: feedbacks[i % feedbacks.length], daysAgoN: 13,
    })),
    // CS101 Week 3 — only 6 submitted
    ...year1CS.slice(0, 6).map((s: any, i: number) => ({
      courseCode: "CS101", assignmentTitle: "Week 3 — Loops & Conditionals",
      student: s, marks: i < 4 ? 65 + Math.floor(Math.random() * 30) : null, graded: i < 4,
      feedback: i < 4 ? feedbacks[i] : "", daysAgoN: 2,
    })),
    // CS201 Linked List
    ...year2CS.map((s: any, i: number) => ({
      courseCode: "CS201", assignmentTitle: "Linked List Implementation",
      student: s, marks: 50 + Math.floor(Math.random() * 28), graded: true,
      feedback: feedbacks[i % feedbacks.length], daysAgoN: 9,
    })),
    // CS201 BST — year 2 students, 4 submitted so far
    ...year2CS.slice(0, 4).map((s: any, i: number) => ({
      courseCode: "CS201", assignmentTitle: "Binary Search Tree",
      student: s, marks: null, graded: false, feedback: "", daysAgoN: 1,
    })),
    // CS301 ER Diagram
    ...year2CS.slice(0, 5).map((s: any, i: number) => ({
      courseCode: "CS301", assignmentTitle: "ER Diagram — University DB",
      student: s, marks: i < 4 ? 38 + Math.floor(Math.random() * 20) : null, graded: i < 4,
      feedback: i < 4 ? "Good ER diagram. Watch your cardinalities." : "", daysAgoN: 6,
    })),
    // CS401 SRS — year 3 students
    ...year3CS.map((s: any, i: number) => ({
      courseCode: "CS401", assignmentTitle: "Requirements Document (SRS)",
      student: s, marks: 78 + i * 5, graded: true,
      feedback: "Well written SRS. Good use of IEEE 830 structure.", daysAgoN: 4,
    })),
    // MATH101 Derivatives — year 1 CS + math students
    ...[...year1CS.slice(0, 6), ...mathStudents].map((s: any, i: number) => ({
      courseCode: "MATH101", assignmentTitle: "Derivatives Problem Set",
      student: s, marks: 55 + Math.floor(Math.random() * 42), graded: true,
      feedback: feedbacks[i % feedbacks.length], daysAgoN: 7,
    })),
    // IT101 Network Topology — IT students + some CS year 1
    ...[...itStudents, ...year1CS.slice(0, 4)].map((s: any, i: number) => ({
      courseCode: "IT101", assignmentTitle: "Network Topology Design",
      student: s, marks: i < 4 ? 55 + Math.floor(Math.random() * 24) : null, graded: i < 4,
      feedback: i < 4 ? "Good topology. Include IP addressing plan next time." : "", daysAgoN: 3,
    })),
  ];

  let subCount = 0;
  for (const sub of submissionsSeeds) {
    const assignment = assignmentMap[`${sub.courseCode}::${sub.assignmentTitle}`];
    if (!assignment) continue;
    const existing = await prisma.submission.findFirst({ where: { assignmentId: assignment.id, studentId: sub.student.id } });
    if (existing) continue;
    const lecEmail = coursesData.find(c => c.code === sub.courseCode)!.lecEmail;
    await prisma.submission.create({
      data: {
        assignmentId: assignment.id, studentId: sub.student.id,
        institutionId: institution.id,
        textResponse: "Submission provided as per the assignment requirements.",
        submittedAt:  daysAgo(sub.daysAgoN),
        status:       sub.graded ? "graded" : "submitted",
        marks:        sub.graded && sub.marks != null ? sub.marks : null,
        feedback:     sub.graded ? sub.feedback : null,
        gradedAt:     sub.graded ? daysAgo(Math.max(0, sub.daysAgoN - 2)) : null,
        gradedBy:     sub.graded ? lecturers[lecEmail].id : null,
      },
    });
    subCount++;
  }
  console.log(`✓  Submissions (${subCount})`);

  // ── Quizzes + Questions ───────────────────────────────────────────────────────
  type QSeed = {
    courseCode: string; title: string; timeLimitMins: number; passMark: number; type: string;
    questions: { text: string; qType: string; options: { body: string; isCorrect: boolean }[]; marks: number }[];
  };
  const quizzesData: QSeed[] = [
    {
      courseCode: "CS101", title: "Week 2 Quiz — Python Basics", timeLimitMins: 20, passMark: 50, type: "practice",
      questions: [
        { text: "Which of the following is a Python data type?",            qType: "mcq",        options: [{body:"int",isCorrect:true},{body:"num",isCorrect:false},{body:"char",isCorrect:false},{body:"byte",isCorrect:false}],                                     marks: 2 },
        { text: "What does the print() function do in Python?",             qType: "mcq",        options: [{body:"Reads input",isCorrect:false},{body:"Outputs text to the console",isCorrect:true},{body:"Declares a variable",isCorrect:false},{body:"Creates a loop",isCorrect:false}], marks: 2 },
        { text: "Python uses # for single-line comments.",                  qType: "true_false",  options: [{body:"True",isCorrect:true},{body:"False",isCorrect:false}],                                                                                              marks: 1 },
        { text: "What is the result of 10 % 3 in Python?",                 qType: "mcq",        options: [{body:"3",isCorrect:false},{body:"1",isCorrect:true},{body:"0",isCorrect:false},{body:"2",isCorrect:false}],                                               marks: 2 },
        { text: "Which keyword is used to define a function in Python?",    qType: "mcq",        options: [{body:"function",isCorrect:false},{body:"def",isCorrect:true},{body:"fun",isCorrect:false},{body:"define",isCorrect:false}],                               marks: 2 },
        { text: "Python is a statically typed language.",                   qType: "true_false",  options: [{body:"True",isCorrect:false},{body:"False",isCorrect:true}],                                                                                              marks: 1 },
      ],
    },
    {
      courseCode: "CS201", title: "Data Structures Quiz 1 — Arrays & Lists", timeLimitMins: 30, passMark: 50, type: "graded",
      questions: [
        { text: "Time complexity of accessing an array element by index?",  qType: "mcq",        options: [{body:"O(n)",isCorrect:false},{body:"O(log n)",isCorrect:false},{body:"O(1)",isCorrect:true},{body:"O(n²)",isCorrect:false}],                               marks: 3 },
        { text: "Which data structure uses LIFO (Last In, First Out)?",     qType: "mcq",        options: [{body:"Queue",isCorrect:false},{body:"Stack",isCorrect:true},{body:"Heap",isCorrect:false},{body:"Tree",isCorrect:false}],                                  marks: 3 },
        { text: "A linked list node contains data and a pointer to the next node.", qType: "true_false", options: [{body:"True",isCorrect:true},{body:"False",isCorrect:false}],                                                                                      marks: 2 },
        { text: "What is the worst case time complexity of linear search?", qType: "mcq",        options: [{body:"O(1)",isCorrect:false},{body:"O(log n)",isCorrect:false},{body:"O(n log n)",isCorrect:false},{body:"O(n)",isCorrect:true}],                          marks: 3 },
        { text: "Which traversal visits the root first?",                   qType: "mcq",        options: [{body:"Inorder",isCorrect:false},{body:"Postorder",isCorrect:false},{body:"Preorder",isCorrect:true},{body:"Level order",isCorrect:false}],                 marks: 3 },
        { text: "Merge sort is a stable sorting algorithm.",                qType: "true_false",  options: [{body:"True",isCorrect:true},{body:"False",isCorrect:false}],                                                                                              marks: 2 },
      ],
    },
    {
      courseCode: "CS301", title: "SQL Basics Quiz", timeLimitMins: 25, passMark: 60, type: "practice",
      questions: [
        { text: "Which SQL command is used to retrieve data from a table?", qType: "mcq",        options: [{body:"INSERT",isCorrect:false},{body:"UPDATE",isCorrect:false},{body:"SELECT",isCorrect:true},{body:"DELETE",isCorrect:false}],                            marks: 2 },
        { text: "PRIMARY KEY enforces uniqueness and NOT NULL.",            qType: "true_false",  options: [{body:"True",isCorrect:true},{body:"False",isCorrect:false}],                                                                                              marks: 2 },
        { text: "Which JOIN returns all rows from both tables?",            qType: "mcq",        options: [{body:"INNER JOIN",isCorrect:false},{body:"LEFT JOIN",isCorrect:false},{body:"RIGHT JOIN",isCorrect:false},{body:"FULL OUTER JOIN",isCorrect:true}],        marks: 2 },
        { text: "What does normalization primarily aim to reduce?",         qType: "mcq",        options: [{body:"Query time",isCorrect:false},{body:"Data redundancy",isCorrect:true},{body:"Storage cost",isCorrect:false},{body:"Index count",isCorrect:false}],     marks: 2 },
        { text: "Which function counts the number of rows?",               qType: "mcq",        options: [{body:"SUM()",isCorrect:false},{body:"AVG()",isCorrect:false},{body:"COUNT()",isCorrect:true},{body:"MAX()",isCorrect:false}],                              marks: 2 },
      ],
    },
    {
      courseCode: "MATH101", title: "Derivatives Quiz", timeLimitMins: 30, passMark: 50, type: "graded",
      questions: [
        { text: "What is the derivative of x²?",                           qType: "mcq",        options: [{body:"x",isCorrect:false},{body:"2x",isCorrect:true},{body:"2",isCorrect:false},{body:"x²",isCorrect:false}],                                             marks: 2 },
        { text: "The derivative of a constant is 0.",                      qType: "true_false",  options: [{body:"True",isCorrect:true},{body:"False",isCorrect:false}],                                                                                              marks: 1 },
        { text: "Which rule applies to d/dx of f(g(x))?",                  qType: "mcq",        options: [{body:"Product rule",isCorrect:false},{body:"Quotient rule",isCorrect:false},{body:"Chain rule",isCorrect:true},{body:"Power rule",isCorrect:false}],       marks: 2 },
        { text: "What is the derivative of sin(x)?",                       qType: "mcq",        options: [{body:"-cos(x)",isCorrect:false},{body:"cos(x)",isCorrect:true},{body:"-sin(x)",isCorrect:false},{body:"tan(x)",isCorrect:false}],                         marks: 2 },
        { text: "If f(x) = 3x³, then f'(x) = ?",                         qType: "mcq",        options: [{body:"3x²",isCorrect:false},{body:"9x²",isCorrect:true},{body:"9x",isCorrect:false},{body:"x³",isCorrect:false}],                                        marks: 2 },
        { text: "The derivative of eˣ is eˣ.",                             qType: "true_false",  options: [{body:"True",isCorrect:true},{body:"False",isCorrect:false}],                                                                                              marks: 1 },
      ],
    },
  ];
  const quizMap: Record<string, any> = {};
  for (const qz of quizzesData) {
    const course   = courses[qz.courseCode];
    const lecEmail = coursesData.find(c => c.code === qz.courseCode)!.lecEmail;
    const existing = await prisma.quiz.findFirst({ where: { courseId: course.id, title: qz.title } });
    if (existing) { quizMap[qz.title] = existing; continue; }
    const quiz = await prisma.quiz.create({
      data: {
        title: qz.title, description: qz.title, courseId: course.id,
        institutionId: institution.id, createdBy: lecturers[lecEmail].id,
        timeLimitMins: qz.timeLimitMins, passMark: qz.passMark, type: qz.type,
        isPublished: true, maxAttempts: 2, closeAt: daysFromNow(60),
        showResults: true, randomizeQ: false, randomizeA: false,
      },
    });
    quizMap[qz.title] = quiz;
    for (let qi = 0; qi < qz.questions.length; qi++) {
      const q = qz.questions[qi];
      const question = await prisma.quizQuestion.create({
        data: { quizId: quiz.id, type: q.qType, body: q.text, marks: q.marks, sortOrder: qi },
      });
      for (let oi = 0; oi < q.options.length; oi++) {
        await prisma.quizOption.create({
          data: { questionId: question.id, body: q.options[oi].body, isCorrect: q.options[oi].isCorrect, sortOrder: oi },
        });
      }
    }
  }
  console.log(`✓  Quizzes + Questions (${quizzesData.length} quizzes)`);

  // ── Quiz Attempts (some students already attempted) ───────────────────────────
  // Seed completed quiz attempts for a few students so gradebook has data
  const cs101QuizId  = quizMap["Week 2 Quiz — Python Basics"]?.id;
  const math101QuizId = quizMap["Derivatives Quiz"]?.id;

  if (cs101QuizId) {
    for (let i = 0; i < 5; i++) {
      const student = year1CS[i];
      const existing = await prisma.quizAttempt.findFirst({ where: { quizId: cs101QuizId, studentId: student.id } });
      if (!existing) {
        const score = 60 + Math.floor(Math.random() * 40); // 60-100%
        await prisma.quizAttempt.create({
          data: {
            quizId: cs101QuizId, studentId: student.id,
            attempt: 1, status: "submitted",
            score, startedAt: daysAgo(5),
            submittedAt: daysAgo(5),
            institutionId: institution.id,
          },
        });
      }
    }
  }
  if (math101QuizId) {
    const mathAttemptStudents = [...year1CS.slice(0, 4), ...mathStudents];
    for (let i = 0; i < mathAttemptStudents.length; i++) {
      const student = mathAttemptStudents[i];
      const existing = await prisma.quizAttempt.findFirst({ where: { quizId: math101QuizId, studentId: student.id } });
      if (!existing) {
        const score = 50 + Math.floor(Math.random() * 50);
        await prisma.quizAttempt.create({
          data: {
            quizId: math101QuizId, studentId: student.id,
            attempt: 1, status: "submitted",
            score, startedAt: daysAgo(3),
            submittedAt: daysAgo(3),
            institutionId: institution.id,
          },
        });
      }
    }
  }
  console.log("✓  Quiz Attempts (sample)");

  // ── Announcements ─────────────────────────────────────────────────────────────
  const announcementsData = [
    { courseCode: "CS101",   title: "Welcome to CS101!",               body: "Welcome everyone! Course materials for Week 1 are now available under the Materials tab. Please install Python and VS Code before Thursday's lab.", daysAgoN: 20, lecEmail: "lecturer@tuk.ac.ke" },
    { courseCode: "CS101",   title: "Assignment 1 Deadline Extended",  body: "Due to the public holiday, the Week 1 deadline has been extended by 2 days. New deadline: Friday 23:59 EAT.", daysAgoN: 14, lecEmail: "lecturer@tuk.ac.ke" },
    { courseCode: "CS101",   title: "CAT 1 Results Released",          body: "CAT 1 results are in the gradebook. The class average was 71%. Excellent performance overall. See me during office hours (Tues 2–4 PM) for queries.", daysAgoN: 3, lecEmail: "lecturer@tuk.ac.ke" },
    { courseCode: "CS201",   title: "Week 4 Lecture Notes Online",     body: "Notes on Trees and Graphs are now available. Please review before Thursday's lecture. We'll start Binary Trees this week.", daysAgoN: 5, lecEmail: "p.wanjiku@tuk.ac.ke" },
    { courseCode: "CS201",   title: "Thursday Session Online",         body: "This Thursday's session will be held online via Google Meet. Join link will be shared 30 minutes before the class at 10 AM.", daysAgoN: 2, lecEmail: "p.wanjiku@tuk.ac.ke" },
    { courseCode: "CS301",   title: "DB Lab Access Hours",             body: "The Database Lab (DB-Lab) is open Monday to Friday 8 AM to 6 PM. Bring your student ID. Lab computers have PostgreSQL 16 installed.", daysAgoN: 10, lecEmail: "s.akinyi@tuk.ac.ke" },
    { courseCode: "CS301",   title: "SQL Assignment Tips",             body: "For the SQL queries assignment, use the university database schema provided. Pay attention to NULL handling and JOINs. Good luck!", daysAgoN: 2, lecEmail: "s.akinyi@tuk.ac.ke" },
    { courseCode: "MATH101", title: "CAT 1 Schedule",                  body: "CAT 1 is scheduled for this Friday in Lecture Hall 204 at 8 AM. It covers Limits and Derivatives (Chapters 1–3). Bring a calculator.", daysAgoN: 7, lecEmail: "d.omondi@tuk.ac.ke" },
    { courseCode: "MATH101", title: "Extra Practice Problems",         body: "Additional integration practice problems have been posted under Week 5 materials. Solutions will be discussed in Monday's class.", daysAgoN: 1, lecEmail: "d.omondi@tuk.ac.ke" },
    { courseCode: "IT101",   title: "Cisco Packet Tracer Required",    body: "Please download Cisco Packet Tracer (free with NetAcad account) for next week's networking lab. We'll be building network topologies.", daysAgoN: 8, lecEmail: "s.akinyi@tuk.ac.ke" },
    { courseCode: "EEE101",  title: "Lab Safety Briefing",             body: "All EEE101 students MUST attend the lab safety briefing this Monday before any circuit lab work. 9 AM, ENG-Lab. Mandatory attendance.", daysAgoN: 6, lecEmail: "m.kamau@tuk.ac.ke" },
    { courseCode: "CS401",   title: "Guest Lecture — Industry SE",     body: "We have a guest speaker from Safaricom next Wednesday at 2 PM. Software Engineer with 10 years in mobile money systems. Attendance encouraged.", daysAgoN: 3, lecEmail: "lecturer@tuk.ac.ke" },
  ];
  let annCount = 0;
  for (const a of announcementsData) {
    const existing = await prisma.announcement.findFirst({ where: { courseId: courses[a.courseCode].id, title: a.title } });
    if (!existing) {
      await prisma.announcement.create({
        data: {
          title: a.title, body: a.body, courseId: courses[a.courseCode].id,
          institutionId: institution.id, createdBy: lecturers[a.lecEmail].id,
          publishAt: daysAgo(a.daysAgoN),
        },
      });
      annCount++;
    }
  }
  console.log(`✓  Announcements (${annCount})`);

  // ── Timetable Slots ──────────────────────────────────────────────────────────
  function nextWeekday(dayName: string, hour: number) {
    const idx = ["Monday","Tuesday","Wednesday","Thursday","Friday"].indexOf(dayName);
    const targetDay = idx + 1;
    const now = new Date();
    let diff = targetDay - now.getDay();
    if (diff <= 0) diff += 7;
    const d = new Date(now);
    d.setDate(now.getDate() + diff);
    d.setHours(hour, 0, 0, 0);
    return d;
  }
  const timetableData = [
    { courseCode: "CS101",   lecEmail: "lecturer@tuk.ac.ke",  day: "Monday",    startH: 8,  endH: 10, room: "LH-101"  },
    { courseCode: "CS101",   lecEmail: "lecturer@tuk.ac.ke",  day: "Wednesday", startH: 8,  endH: 10, room: "LH-101"  },
    { courseCode: "CS201",   lecEmail: "p.wanjiku@tuk.ac.ke", day: "Tuesday",   startH: 10, endH: 12, room: "LH-203"  },
    { courseCode: "CS201",   lecEmail: "p.wanjiku@tuk.ac.ke", day: "Thursday",  startH: 10, endH: 12, room: "LH-203"  },
    { courseCode: "CS301",   lecEmail: "s.akinyi@tuk.ac.ke",  day: "Monday",    startH: 14, endH: 16, room: "DB-Lab"  },
    { courseCode: "CS301",   lecEmail: "s.akinyi@tuk.ac.ke",  day: "Friday",    startH: 10, endH: 12, room: "DB-Lab"  },
    { courseCode: "CS401",   lecEmail: "lecturer@tuk.ac.ke",  day: "Wednesday", startH: 14, endH: 16, room: "LH-304"  },
    { courseCode: "MATH101", lecEmail: "d.omondi@tuk.ac.ke",  day: "Tuesday",   startH: 8,  endH: 10, room: "LH-105"  },
    { courseCode: "MATH101", lecEmail: "d.omondi@tuk.ac.ke",  day: "Friday",    startH: 8,  endH: 10, room: "LH-105"  },
    { courseCode: "MATH201", lecEmail: "d.omondi@tuk.ac.ke",  day: "Thursday",  startH: 8,  endH: 10, room: "LH-106"  },
    { courseCode: "IT101",   lecEmail: "s.akinyi@tuk.ac.ke",  day: "Thursday",  startH: 14, endH: 16, room: "NET-Lab" },
    { courseCode: "IT101",   lecEmail: "s.akinyi@tuk.ac.ke",  day: "Monday",    startH: 11, endH: 13, room: "NET-Lab" },
    { courseCode: "EEE101",  lecEmail: "m.kamau@tuk.ac.ke",   day: "Monday",    startH: 11, endH: 13, room: "ENG-Lab" },
    { courseCode: "EEE101",  lecEmail: "m.kamau@tuk.ac.ke",   day: "Wednesday", startH: 11, endH: 13, room: "ENG-Lab" },
  ];
  let ttCount = 0;
  for (const t of timetableData) {
    const course   = courses[t.courseCode];
    const existing = await prisma.timetableSlot.findFirst({
      where: { courseId: course.id, roomRef: t.room, institutionId: institution.id },
    });
    if (!existing) {
      await prisma.timetableSlot.create({
        data: {
          courseId: course.id, lecturerId: lecturers[t.lecEmail].id,
          roomRef: t.room, startAt: nextWeekday(t.day, t.startH), endAt: nextWeekday(t.day, t.endH),
          published: true, institutionId: institution.id,
        },
      });
      ttCount++;
    }
  }
  console.log(`✓  Timetable (${ttCount} slots)`);

  // ── Online Sessions ───────────────────────────────────────────────────────────
  const sessionsData = [
    { courseCode: "CS101",   lecEmail: "lecturer@tuk.ac.ke",  title: "Week 5 — Functions & Scope (Live)",     startAt: hoursAgo(0.5),   endAt: hoursFromNow(1.5),  status: "live",      provider: "zoom",        joinUrl: "https://zoom.us/j/111222333444" },
    { courseCode: "CS201",   lecEmail: "p.wanjiku@tuk.ac.ke", title: "Binary Trees Live Coding Session",       startAt: hoursFromNow(3), endAt: hoursFromNow(5),    status: "scheduled", provider: "google_meet", joinUrl: "https://meet.google.com/abc-def-ghi" },
    { courseCode: "CS301",   lecEmail: "s.akinyi@tuk.ac.ke",  title: "SQL JOINs — Live Demonstration",        startAt: hoursFromNow(26),endAt: hoursFromNow(28),   status: "scheduled", provider: "zoom",        joinUrl: "https://zoom.us/j/444555666777" },
    { courseCode: "MATH101", lecEmail: "d.omondi@tuk.ac.ke",  title: "Integration by Parts — Live Q&A",       startAt: hoursFromNow(50),endAt: hoursFromNow(52),   status: "scheduled", provider: "zoom",        joinUrl: "https://zoom.us/j/888999000111" },
    { courseCode: "CS101",   lecEmail: "lecturer@tuk.ac.ke",  title: "Week 3 — Loops & Conditionals Review",  startAt: daysAgo(7),      endAt: new Date(daysAgo(7).getTime() + 7_200_000),  status: "ended",     provider: "zoom",        joinUrl: "https://zoom.us/j/pastcs101w3" },
    { courseCode: "CS201",   lecEmail: "p.wanjiku@tuk.ac.ke", title: "Week 2 — Arrays & Pointers Walkthrough", startAt: daysAgo(10),     endAt: new Date(daysAgo(10).getTime() + 7_200_000), status: "ended",     provider: "zoom",        joinUrl: "https://zoom.us/j/pastcs201w2" },
    { courseCode: "MATH101", lecEmail: "d.omondi@tuk.ac.ke",  title: "Differentiation Rules Review",           startAt: daysAgo(5),      endAt: new Date(daysAgo(5).getTime() + 5_400_000),  status: "ended",     provider: "google_meet", joinUrl: "https://meet.google.com/past-math101" },
    { courseCode: "CS301",   lecEmail: "s.akinyi@tuk.ac.ke",  title: "ER Diagram Modelling Session",           startAt: daysAgo(3),      endAt: new Date(daysAgo(3).getTime() + 5_400_000),  status: "ended",     provider: "zoom",        joinUrl: "https://zoom.us/j/pastcs301er" },
    { courseCode: "CS401",   lecEmail: "lecturer@tuk.ac.ke",  title: "Agile Sprint Planning Demo",             startAt: daysAgo(2),      endAt: new Date(daysAgo(2).getTime() + 5_400_000),  status: "ended",     provider: "zoom",        joinUrl: "https://zoom.us/j/pastcs401agile" },
  ];
  let sessCount = 0;
  for (const s of sessionsData) {
    const existing = await prisma.onlineClassSession.findFirst({ where: { courseId: courses[s.courseCode].id, title: s.title } });
    if (!existing) {
      await prisma.onlineClassSession.create({
        data: {
          courseId: courses[s.courseCode].id, lecturerId: lecturers[s.lecEmail].id,
          institutionId: institution.id, title: s.title, description: s.title,
          startAt: s.startAt, endAt: s.endAt, status: s.status,
          provider: s.provider, joinUrl: s.joinUrl,
        },
      });
      sessCount++;
    }
  }
  console.log(`✓  Online Sessions (${sessCount})`);

  // ── Attendance Records ────────────────────────────────────────────────────────
  const attendanceSessions = [
    { ref: "CS101-W1-MON",  date: daysAgo(21), topic: "Introduction to Computer Science", students: year1CS, presentCount: 8 },
    { ref: "CS101-W1-WED",  date: daysAgo(19), topic: "Programming Basics", students: year1CS, presentCount: 7 },
    { ref: "CS101-W2-MON",  date: daysAgo(14), topic: "Variables & Data Types", students: year1CS, presentCount: 7 },
    { ref: "CS101-W2-WED",  date: daysAgo(12), topic: "Control Flow (if/else, loops)", students: year1CS, presentCount: 6 },
    { ref: "CS101-W3-MON",  date: daysAgo(7),  topic: "Functions & Scope", students: year1CS, presentCount: 8 },
    { ref: "CS201-W1-TUE",  date: daysAgo(20), topic: "Arrays & Linked Lists", students: year2CS, presentCount: 5 },
    { ref: "CS201-W1-THU",  date: daysAgo(18), topic: "Algorithm Analysis", students: year2CS, presentCount: 6 },
    { ref: "CS201-W2-TUE",  date: daysAgo(13), topic: "Stacks & Queues", students: year2CS, presentCount: 6 },
    { ref: "CS301-W1-MON",  date: daysAgo(21), topic: "Database Fundamentals", students: year2CS, presentCount: 5 },
    { ref: "CS301-W2-MON",  date: daysAgo(14), topic: "Relational Model & SQL", students: year2CS, presentCount: 4 },
    { ref: "MATH101-W1-TUE",date: daysAgo(20), topic: "Limits & Continuity", students: [...year1CS.slice(0,6), ...mathStudents], presentCount: 6 },
    { ref: "MATH101-W1-FRI",date: daysAgo(17), topic: "Derivatives: Power Rule", students: [...year1CS.slice(0,6), ...mathStudents], presentCount: 5 },
    { ref: "MATH101-W2-TUE",date: daysAgo(13), topic: "Chain Rule & Product Rule", students: [...year1CS.slice(0,6), ...mathStudents], presentCount: 7 },
    { ref: "IT101-W1-THU",  date: daysAgo(18), topic: "Network Topologies", students: [...itStudents, ...year1CS.slice(0,4)], presentCount: 4 },
    { ref: "IT101-W2-MON",  date: daysAgo(11), topic: "IP Addressing & Subnetting", students: [...itStudents, ...year1CS.slice(0,4)], presentCount: 5 },
  ];
  let attCount = 0;
  for (const sess of attendanceSessions) {
    for (let i = 0; i < sess.students.length; i++) {
      const student  = sess.students[i];
      const verified = i < sess.presentCount;
      const existing = await prisma.attendanceRecord.findFirst({ where: { sessionRef: sess.ref, userId: student.id } });
      if (!existing) {
        await prisma.attendanceRecord.create({
          data: {
            userId: student.id,
            sessionRef: sess.ref,
            sessionTopic: sess.topic,
            sessionDate: sess.date,
            source: "manual",
            verified,
            institutionId: institution.id,
            createdAt: sess.date,
          },
        });
        attCount++;
      }
    }
  }
  console.log(`✓  Attendance (${attCount} records, ${attendanceSessions.length} sessions)`);

  // ── Notifications ─────────────────────────────────────────────────────────────
  const notifData = [
    { userId: students[0].id, subject: "Assignment graded — CS101 Week 1",       body: "Your Week 1 assignment for CS101 has been graded. You scored 85/100. Check your gradebook for feedback." },
    { userId: students[0].id, subject: "New announcement in CS101",              body: "Dr. Jane Mwangi posted: CAT 1 Results Released. Average was 71%." },
    { userId: students[0].id, subject: "Quiz available — CS101 Week 2",          body: "A new quiz is available: 'Week 2 Quiz — Python Basics'. You have 2 attempts. Time limit: 20 minutes." },
    { userId: students[0].id, subject: "Live class starting now — CS101",        body: "CS101 session 'Week 5 — Functions & Scope' is starting now. Join via your Sessions page." },
    { userId: students[0].id, subject: "Assignment due in 2 days — MATH101",     body: "Reminder: 'Derivatives Problem Set' for MATH101 is due in 2 days. You haven't submitted yet." },
    { userId: students[1].id, subject: "Assignment graded — CS101 Week 1",       body: "Your Week 1 assignment for CS101 has been graded. You scored 78/100." },
    { userId: students[1].id, subject: "New session scheduled — CS201",          body: "Prof. Peter Wanjiku has scheduled 'Binary Trees Live Coding Session' for tomorrow at 10 AM." },
    { userId: students[2].id, subject: "Assignment graded — CS101 Week 1",       body: "Your Week 1 assignment has been graded. Score: 92/100. Excellent work!" },
    { userId: students[8].id, subject: "Assignment submitted — CS201",            body: "Your Linked List Implementation has been received. You'll be notified when it's graded." },
    { userId: students[8].id, subject: "Assignment graded — CS201 Linked List",  body: "Your Linked List Implementation has been graded. Score: 68/80. See feedback in your gradebook." },
  ];
  for (const n of notifData) {
    await prisma.notification.create({
      data: { userId: n.userId, channel: "in_app", subject: n.subject, body: n.body, institutionId: institution.id, sentAt: new Date() },
    });
  }
  console.log(`✓  Notifications (${notifData.length})`);

  // ── Exams (for grades to show in gradebook) ────────────────────────────────────
  const examsData = [
    { courseCode: "CS101",   title: "CAT 1 — Programming Basics",      examType: "cat",      maxMarks: 30, daysAgoScheduled: 14 },
    { courseCode: "CS201",   title: "CAT 1 — Data Structures",         examType: "cat",      maxMarks: 30, daysAgoScheduled: 10 },
    { courseCode: "MATH101", title: "CAT 1 — Limits & Derivatives",    examType: "cat",      maxMarks: 30, daysAgoScheduled: 7  },
    { courseCode: "CS101",   title: "Midterm — Algorithms & Loops",    examType: "midterm",  maxMarks: 70, daysAgoScheduled: 0  }, // upcoming
  ];
  const examMap: Record<string, any> = {};
  for (const e of examsData) {
    const course   = courses[e.courseCode];
    const lecEmail = coursesData.find(c => c.code === e.courseCode)!.lecEmail;
    const existing = await prisma.exam.findFirst({ where: { courseId: course.id, title: e.title } });
    const rec = existing ?? await prisma.exam.create({
      data: {
        title: e.title, courseId: course.id, examType: e.examType as any,
        maxMarks: e.maxMarks, durationMins: 60,
        scheduledDate: daysAgo(e.daysAgoScheduled),
        institutionId: institution.id, createdBy: lecturers[lecEmail].id,
      },
    });
    examMap[e.title] = rec;
  }

  // Seed grades for the past CATs
  const gradesData = [
    ...year1CS.map((s: any, i: number) => ({ exam: "CAT 1 — Programming Basics", student: s, marks: 18 + Math.floor(Math.random() * 11), lecEmail: "lecturer@tuk.ac.ke" })),
    ...year2CS.map((s: any, i: number) => ({ exam: "CAT 1 — Data Structures",    student: s, marks: 16 + Math.floor(Math.random() * 13), lecEmail: "p.wanjiku@tuk.ac.ke" })),
    ...[...year1CS.slice(0,5), ...mathStudents].map((s: any, i: number) => ({ exam: "CAT 1 — Limits & Derivatives", student: s, marks: 15 + Math.floor(Math.random() * 14), lecEmail: "d.omondi@tuk.ac.ke" })),
  ];
  for (const g of gradesData) {
    const exam = examMap[g.exam];
    if (!exam) continue;
    const existing = await prisma.grade.findFirst({ where: { examId: exam.id, studentId: g.student.id } });
    if (!existing) {
      await prisma.grade.create({
        data: {
          examId: exam.id, studentId: g.student.id,
          marks: g.marks, feedback: "Well done.",
          gradedBy: lecturers[g.lecEmail].id,
          institutionId: institution.id,
          gradedAt: daysAgo(1),
        },
      });
    }
  }
  console.log(`✓  Exams + Grades (${examsData.length} exams, ${gradesData.length} grade records)`);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          ✅  SEED COMPLETE — AdvaTech LMS / TUK             ║
╠══════════════════════════════════════════════════════════════╣
║  Password for ALL accounts: ChangeMe@2025!                   ║
╠══════════════════════════════════════════════════════════════╣
║  Platform Admin │ admin@advatech.ac.ke                       ║
║  Inst Admin     │ admin@tuk.ac.ke                            ║
╠══════════════════════════════════════════════════════════════╣
║  Lecturers (5)                                               ║
║    lecturer@tuk.ac.ke    (Dr. Jane Mwangi — CS101, CS401)   ║
║    p.wanjiku@tuk.ac.ke   (Prof. Wanjiku — CS201)             ║
║    s.akinyi@tuk.ac.ke    (Dr. Akinyi — CS301, IT101)         ║
║    d.omondi@tuk.ac.ke    (Mr. Omondi — MATH101, MATH201)     ║
║    m.kamau@tuk.ac.ke     (Mr. Kamau — EEE101)                ║
╠══════════════════════════════════════════════════════════════╣
║  Students (20)                                               ║
║    student@tuk.ac.ke     (Alice Kamau — CS Year 1)           ║
║    b.otieno@...           (Brian Otieno — CS Year 1)          ║
║    i.wairimu@...          (Irene Wairimu — CS Year 2)         ║
║    ... + 17 others                                           ║
╠══════════════════════════════════════════════════════════════╣
║  Courses:     8    Cohorts:       5                          ║
║  Assignments: 17   Submissions:  varies (graded + pending)  ║
║  Quizzes:     4    Quiz Attempts: seeded                     ║
║  Materials:   12   Announcements: 12                         ║
║  Timetable:   14   Sessions:      9                          ║
║  Exams:       4    Grade Records: seeded                     ║
║  Attendance:  15 sessions tracked (with topics & dates)      ║
╚══════════════════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());