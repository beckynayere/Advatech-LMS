// DESTINATION: engine/src/modules/grades/grades.routes.ts
// FIX: Routes /my and /transcript/:studentId are registered BEFORE /:id
// Previously Express was matching "my" as the :id parameter — causing 404/wrong result

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, lecturerOrAdmin, adminOnly, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";

const router: import("express").Router = Router();

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

// ══════════════════════════════════════════════════════════════
//  EXAMS
// ══════════════════════════════════════════════════════════════

const examSchema = z.object({
  title:        z.string().min(1).max(255),
  description:  z.string().optional().nullable(),
  courseId:     z.number().int().positive(),
  examType:     z.enum(["midterm", "final", "cat", "supplementary"]),
  maxMarks:     z.number().int().positive().default(100),
  durationMins: z.number().int().positive().default(60),
  scheduledDate:z.string().datetime(),
  venue:        z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  allowRetakes: z.boolean().default(false),
  isGraded:     z.boolean().default(true),
});

router.get("/exams", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);
  const where: any = { institutionId, isActive: true };
  if (req.query.courseId) where.courseId = Number(req.query.courseId);
  if (req.query.cohortId) where.cohorts = { some: { cohortId: Number(req.query.cohortId) } };

  const [exams, total] = await Promise.all([
    prisma.exam.findMany({
      where, skip, take: limit, orderBy: { scheduledDate: "asc" },
      include: {
        course:   { select: { id: true, name: true, code: true } },
        cohorts:  { include: { cohort: { select: { id: true, name: true, code: true } } } },
        creator:  { select: { id: true, name: true } },
        _count:   { select: { grades: true } },
      },
    }),
    prisma.exam.count({ where }),
  ]);
  res.json({ success: true, ...paginate(exams, total, page, limit) });
}));

router.post("/exams", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = examSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const exam = await prisma.exam.create({
    data: { ...body.data, scheduledDate: new Date(body.data.scheduledDate), institutionId, createdBy: r.user!.id },
  });
  res.status(201).json({ success: true, exam });
}));

router.get("/exams/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const exam = await prisma.exam.findFirst({
    where:   { id: Number(req.params.id), institutionId: getInstId(req) },
    include: { course: true, cohorts: { include: { cohort: true } }, creator: { select: { id: true, name: true } } },
  });
  if (!exam) throw new AppError(ErrorCodes.NOT_FOUND, "Exam not found", 404);
  res.json({ success: true, exam });
}));

router.put("/exams/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = examSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const data: any = { ...body.data };
  if (data.scheduledDate) data.scheduledDate = new Date(data.scheduledDate);
  const exam = await prisma.exam.update({ where: { id: Number(req.params.id) }, data });
  res.json({ success: true, exam });
}));

router.delete("/exams/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  await prisma.exam.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ success: true });
}));

router.post("/exams/:id/cohorts", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const examId        = Number(req.params.id);
  const institutionId = getInstId(req);
  const body = z.object({ cohortId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "cohortId required", 400);
  await prisma.examCohort.upsert({
    where:  { examId_cohortId: { examId, cohortId: body.data.cohortId } },
    update: {},
    create: { examId, cohortId: body.data.cohortId, institutionId },
  });
  res.status(201).json({ success: true });
}));

// ══════════════════════════════════════════════════════════════
//  GRADES — CRITICAL: specific routes BEFORE /:id
//  FIX: /my and /transcript/:studentId were AFTER /:id causing
//  Express to treat "my" as a grade ID → wrong results
// ══════════════════════════════════════════════════════════════

const gradeSchema = z.object({
  examId:    z.number().int().positive(),
  studentId: z.number().int().positive(),
  marks:     z.number().min(0),
  feedback:  z.string().optional().nullable(),
});

// GET /api/v1/grades/my  ← MUST be BEFORE /:id
router.get("/my", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r = req as RequestWithAuth;
  const grades = await prisma.grade.findMany({
    where:   { studentId: r.user!.id },
    orderBy: { gradedAt: "desc" },
    include: {
      exam: {
        include: {
          course: { select: { id: true, name: true, code: true, credits: true } },
        },
      },
    },
  });

  // Group by course for frontend consumption
  const byCourse: Record<string, any> = {};
  for (const g of grades) {
    const key = String(g.exam.courseId);
    if (!byCourse[key]) {
      byCourse[key] = { course: g.exam.course, grades: [] };
    }
    const pct = (Number(g.marks) / g.exam.maxMarks) * 100;
    byCourse[key].grades.push({
      examId:     g.examId,
      examTitle:  g.exam.title,
      examType:   g.exam.examType,
      maxMarks:   g.exam.maxMarks,
      marks:      g.marks,
      percentage: pct.toFixed(1),
      grade:      pct >= 70 ? "A" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 40 ? "D" : "F",
      feedback:   g.feedback,
      gradedAt:   g.gradedAt,
    });
  }
  res.json({ success: true, data: Object.values(byCourse) });
}));

// GET /api/v1/grades/transcript/:studentId  ← MUST be BEFORE /:id
router.get("/transcript/:studentId", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r         = req as RequestWithAuth;
  const studentId = Number(req.params.studentId);
  const isSelf    = r.user!.id === studentId;
  const isAdmin   = ["platform_admin", "institution_admin"].includes(r.user!.role);
  if (!isSelf && !isAdmin) throw new AppError(ErrorCodes.FORBIDDEN, "Access denied", 403);

  const student = await prisma.user.findUnique({
    where:   { id: studentId },
    include: { studentProfile: true, institution: { select: { name: true } } },
  });
  if (!student) throw new AppError(ErrorCodes.NOT_FOUND, "Student not found", 404);

  const grades = await prisma.grade.findMany({
    where:   { studentId },
    orderBy: { gradedAt: "asc" },
    include: {
      exam: {
        include: {
          course: { select: { id: true, name: true, code: true, credits: true, semester: true, academicYear: true } },
        },
      },
    },
  });

  const semesters: Record<string, any> = {};
  let totalCredits = 0;
  let weightedSum  = 0;

  for (const g of grades) {
    const key = `${g.exam.course.academicYear ?? "N/A"} — ${g.exam.course.semester ?? "N/A"}`;
    if (!semesters[key]) semesters[key] = { period: key, courses: [] };
    const pct       = (Number(g.marks) / g.exam.maxMarks) * 100;
    const gpaPoints = pct >= 70 ? 4.0 : pct >= 60 ? 3.0 : pct >= 50 ? 2.0 : pct >= 40 ? 1.0 : 0.0;
    const credits   = g.exam.course.credits;
    totalCredits   += credits;
    weightedSum    += gpaPoints * credits;
    semesters[key].courses.push({
      courseCode:  g.exam.course.code,
      courseName:  g.exam.course.name,
      credits,
      marks:       g.marks,
      maxMarks:    g.exam.maxMarks,
      percentage:  pct.toFixed(1),
      grade:       pct >= 70 ? "A" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 40 ? "D" : "F",
      gpaPoints,
    });
  }

  const cumulativeGPA = totalCredits > 0 ? weightedSum / totalCredits : 0;
  res.json({
    success: true,
    transcript: {
      student: {
        id:             student.id,
        name:           student.name,
        email:          student.email,
        registrationNo: student.studentProfile?.registrationNo ?? null,
        institution:    student.institution?.name ?? null,
      },
      semesters: Object.values(semesters),
      summary: {
        totalCredits,
        cumulativeGPA:  cumulativeGPA.toFixed(2),
        classification:
          cumulativeGPA >= 3.6 ? "First Class Honours" :
          cumulativeGPA >= 3.0 ? "Second Class Upper"  :
          cumulativeGPA >= 2.0 ? "Second Class Lower"  :
          cumulativeGPA >= 1.0 ? "Pass" : "Fail",
      },
    },
  });
}));

// ──────────────────────────────────────────────────────────────
//  Parameterised routes AFTER the specific ones above
// ──────────────────────────────────────────────────────────────

// GET /api/v1/grades
router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);
  const where: any = { institutionId };
  if (req.query.examId)    where.examId    = Number(req.query.examId);
  if (req.query.studentId) where.studentId = Number(req.query.studentId);
  if (req.query.courseId)  where.exam      = { courseId: Number(req.query.courseId) };
  if (req.query.cohortId) {
    where.student = {
      cohortEnrollments: { some: { cohortId: Number(req.query.cohortId), isActive: true } },
    };
  }
  if (r.user!.role === ROLES.STUDENT) where.studentId = r.user!.id;

  const [grades, total] = await Promise.all([
    prisma.grade.findMany({
      where, skip, take: limit, orderBy: { gradedAt: "desc" },
      include: {
        exam:    { select: { id: true, title: true, examType: true, maxMarks: true, courseId: true, course: { select: { name: true, code: true } } } },
        student: { select: { id: true, name: true, email: true } },
        grader:  { select: { id: true, name: true } },
      },
    }),
    prisma.grade.count({ where }),
  ]);
  res.json({ success: true, ...paginate(grades, total, page, limit) });
}));

// POST /api/v1/grades
router.post("/", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = gradeSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const exam = await prisma.exam.findUnique({ where: { id: body.data.examId } });
  if (!exam) throw new AppError(ErrorCodes.NOT_FOUND, "Exam not found", 404);
  if (body.data.marks > exam.maxMarks)
    throw new AppError(ErrorCodes.BAD_REQUEST, `Marks exceed exam max (${exam.maxMarks})`, 400);

  const grade = await prisma.grade.upsert({
    where:  { examId_studentId: { examId: body.data.examId, studentId: body.data.studentId } },
    update: { marks: new Decimal(body.data.marks), feedback: body.data.feedback ?? null, gradedBy: r.user!.id, gradedAt: new Date() },
    create: { ...body.data, marks: new Decimal(body.data.marks), gradedBy: r.user!.id, institutionId, gradedAt: new Date() },
  });
  res.status(201).json({ success: true, grade });
}));

// GET /api/v1/grades/:id  ← parameterised LAST
router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const grade = await prisma.grade.findUnique({
    where:   { id: Number(req.params.id) },
    include: { exam: true, student: { select: { id: true, name: true, email: true } } },
  });
  if (!grade) throw new AppError(ErrorCodes.NOT_FOUND, "Grade not found", 404);
  res.json({ success: true, grade });
}));

// PUT /api/v1/grades/:id
router.put("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r    = req as RequestWithAuth;
  const body = z.object({ marks: z.number().min(0), feedback: z.string().optional().nullable() }).safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const grade = await prisma.grade.update({
    where: { id: Number(req.params.id) },
    data:  { marks: new Decimal(body.data.marks), feedback: body.data.feedback ?? null, gradedBy: r.user!.id, gradedAt: new Date() },
  });
  res.json({ success: true, grade });
}));

export { router as gradesRouter };