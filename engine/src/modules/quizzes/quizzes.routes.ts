// DESTINATION: engine/src/modules/quizzes/quizzes.routes.ts
// FIX APPLIED: Removed `isActive: true` filter from both QuizQuestion queries
//              in startAttempt (QuizQuestion has no isActive field in schema)
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, lecturerOrAdmin, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";
import { moduleCache } from "@/lib/cache";

const router: import("express").Router = Router();

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── QUIZ CRUD ────────────────────────────────────────────────────────────────

const quizCreateSchema = z.object({
  title:         z.string().min(1).max(255),
  description:   z.string().optional().nullable(),
  courseId:      z.number().int().positive(),
  type:          z.enum(["practice", "graded", "exam"]).default("practice"),
  timeLimitMins: z.number().int().positive().optional().nullable(),
  maxAttempts:   z.number().int().positive().default(1),
  passMark:      z.number().int().min(0).max(100).default(50),
  randomizeQ:    z.boolean().default(false),
  randomizeA:    z.boolean().default(false),
  showResults:   z.boolean().default(true),
  openAt:        z.string().datetime().optional().nullable(),
  closeAt:       z.string().datetime().optional().nullable(),
  isPublished:   z.boolean().default(false),
});

router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r = req as RequestWithAuth;
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);
  const where: any = { institutionId, isActive: true };
  if (req.query.courseId) where.courseId = Number(req.query.courseId);
  if (r.user!.role === ROLES.STUDENT) where.isPublished = true;
  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    }),
    prisma.quiz.count({ where }),
  ]);
  res.json({ success: true, ...paginate(quizzes, total, page, limit) });
}));

router.post("/", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = quizCreateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const quiz = await prisma.quiz.create({
    data: {
      ...body.data,
      openAt:  body.data.openAt  ? new Date(body.data.openAt)  : null,
      closeAt: body.data.closeAt ? new Date(body.data.closeAt) : null,
      institutionId,
      createdBy: r.user!.id,
    },
  });
  res.status(201).json({ success: true, quiz });
}));

router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r    = req as RequestWithAuth;
  const quiz = await prisma.quiz.findFirst({
    where:   { id: Number(req.params.id), institutionId: getInstId(req), isActive: true },
    include: {
      course: { select: { id: true, name: true } },
      _count: { select: { questions: true } },
    },
  });
  if (!quiz) throw new AppError(ErrorCodes.NOT_FOUND, "Quiz not found", 404);
  if (r.user!.role === ROLES.STUDENT && !quiz.isPublished)
    throw new AppError(ErrorCodes.FORBIDDEN, "Quiz is not available", 403);
  res.json({ success: true, quiz });
}));

router.put("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = quizCreateSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const data: any = { ...body.data };
  if (data.openAt)  data.openAt  = new Date(data.openAt);
  if (data.closeAt) data.closeAt = new Date(data.closeAt);
  const quiz = await prisma.quiz.update({ where: { id: Number(req.params.id) }, data });
  res.json({ success: true, quiz });
}));

router.delete("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  await prisma.quiz.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ success: true });
}));

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

const questionSchema = z.object({
  type:        z.enum(["mcq", "multi_select", "short_answer", "essay", "true_false"]),
  body:        z.string().min(1),
  explanation: z.string().optional().nullable(),
  marks:       z.number().int().positive().default(1),
  sortOrder:   z.number().int().default(0),
  imageKey:    z.string().optional().nullable(),
  options: z.array(
    z.object({
      body:      z.string().min(1),
      isCorrect: z.boolean(),
      sortOrder: z.number().int().default(0),
    })
  ).optional(),
});

router.get("/:quizId/questions", lecturerOrAdmin, asyncHandler(async (req, res) => {
  const questions = await prisma.quizQuestion.findMany({
    where:   { quizId: Number(req.params.quizId) },
    include: { options: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ success: true, data: questions });
}));

router.post("/:quizId/questions", lecturerOrAdmin, asyncHandler(async (req, res) => {
  const quizId = Number(req.params.quizId);
  const body   = questionSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const { options, ...qData } = body.data;
  const question = await prisma.quizQuestion.create({
    data: { ...qData, quizId, ...(options && { options: { create: options } }) },
    include: { options: true },
  });
  res.status(201).json({ success: true, question });
}));

router.put("/:quizId/questions/:id", lecturerOrAdmin, asyncHandler(async (req, res) => {
  const id   = Number(req.params.id);
  const body = questionSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const { options, ...qData } = body.data;
  const question = await prisma.quizQuestion.update({
    where: { id },
    data:  { ...qData, ...(options && { options: { deleteMany: {}, create: options } }) },
    include: { options: true },
  });
  res.json({ success: true, question });
}));

router.delete("/:quizId/questions/:id", lecturerOrAdmin, asyncHandler(async (req, res) => {
  await prisma.quizQuestion.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
}));

// ─── ATTEMPTS ─────────────────────────────────────────────────────────────────

// Start attempt — accepts both POST /:id/attempts AND POST /:id/attempts/start
async function startAttempt(req: Request, res: Response) {
  const r             = req as RequestWithAuth;
  const quizId        = Number(req.params.id);
  const institutionId = getInstId(req);

  if (r.user!.role !== ROLES.STUDENT)
    throw new AppError(ErrorCodes.FORBIDDEN, "Only students can start quiz attempts", 403);

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, institutionId, isActive: true, isPublished: true },
  });
  if (!quiz) throw new AppError(ErrorCodes.NOT_FOUND, "Quiz not available", 404);

  const now = new Date();
  if (quiz.openAt  && now < quiz.openAt)
    throw new AppError(ErrorCodes.FORBIDDEN, "Quiz has not opened yet", 403);
  if (quiz.closeAt && now > quiz.closeAt)
    throw new AppError(ErrorCodes.FORBIDDEN, "Quiz has closed", 403);

  const count = await prisma.quizAttempt.count({
    where: { quizId, studentId: r.user!.id },
  });
  if (count >= quiz.maxAttempts)
    throw new AppError(ErrorCodes.FORBIDDEN, `Maximum ${quiz.maxAttempts} attempt(s) reached`, 403);

  // Resume existing in-progress attempt
  const existing = await prisma.quizAttempt.findFirst({
    where: { quizId, studentId: r.user!.id, status: "in_progress" },
  });
  if (existing) {
    // FIX: removed isActive: true — QuizQuestion has no isActive field
    const questions = await prisma.quizQuestion.findMany({
      where:   { quizId },
      include: { options: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    const sanitized = questions.map(q => ({
      ...q,
      options: q.options.map(({ isCorrect: _ic, ...o }) => o),
    }));
    return res.json({ success: true, attempt: existing, questions: sanitized, resumed: true });
  }

  const endsAt = quiz.timeLimitMins
    ? new Date(now.getTime() + quiz.timeLimitMins * 60000)
    : null;

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId:    r.user!.id,
      institutionId,
      attempt:      count + 1,
      status:       "in_progress",
      startedAt:    now,
      endsAt,
    },
  });

  // FIX: removed isActive: true — QuizQuestion has no isActive field
  let questions = await prisma.quizQuestion.findMany({
    where:   { quizId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  if (quiz.randomizeQ) questions = shuffle(questions);
  if (quiz.randomizeA) questions = questions.map(q => ({ ...q, options: shuffle(q.options) }));

  // Strip isCorrect from options before sending to student
  const sanitized = questions.map(q => ({
    ...q,
    options: q.options.map(({ isCorrect: _ic, ...o }) => o),
  }));

  res.status(201).json({ success: true, attempt, questions: sanitized });
}

// Mount on BOTH routes for frontend compatibility
router.post("/:id/attempts",       anyRole, asyncHandler(startAttempt));
router.post("/:id/attempts/start", anyRole, asyncHandler(startAttempt));

router.get("/:id/attempts", anyRole, asyncHandler(async (req, res) => {
  const r      = req as RequestWithAuth;
  const quizId = Number(req.params.id);
  const { page, limit, skip } = parsePagination(req.query as any);
  const where: any = { quizId };
  if (r.user!.role === ROLES.STUDENT) {
    where.studentId = r.user!.id;
  } else if (req.query.studentId) {
    where.studentId = Number(req.query.studentId);
  }
  const [attempts, total] = await Promise.all([
    prisma.quizAttempt.findMany({
      where, skip, take: limit,
      orderBy: { startedAt: "desc" },
      include: { student: { select: { id: true, name: true, email: true } } },
    }),
    prisma.quizAttempt.count({ where }),
  ]);
  res.json({ success: true, ...paginate(attempts, total, page, limit) });
}));

// ─── SUBMIT ATTEMPT ───────────────────────────────────────────────────────────
// POST /api/v1/quizzes/:id/attempts/:attemptId/submit
// Body: { answers: [{ questionId: number, response: string | null }] }
//   mcq / true_false  → String(selectedOptionId)
//   multi_select      → "id1,id2,id3" (comma-separated, sorted ascending)
//   essay / short_answer → plain text

const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.number().int().positive(),
    response:   z.string().nullable().optional(),
  })),
});

router.post("/:id/attempts/:attemptId/submit", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r           = req as RequestWithAuth;
  const quizId      = Number(req.params.id);
  const attemptId   = Number(req.params.attemptId);

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, quizId },
  });
  if (!attempt) throw new AppError(ErrorCodes.NOT_FOUND, "Attempt not found", 404);
  if (r.user!.role === ROLES.STUDENT && attempt.studentId !== r.user!.id)
    throw new AppError(ErrorCodes.FORBIDDEN, "Not your attempt", 403);

  if (attempt.status === "submitted")
    throw new AppError(ErrorCodes.CONFLICT, "Attempt already submitted", 409);

  const body = submitSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid answers", 400, body.error.flatten() as any);

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError(ErrorCodes.NOT_FOUND, "Quiz not found", 404);

  const questions = await prisma.quizQuestion.findMany({
    where:   { quizId },
    include: { options: true },
  });
  const questionMap = new Map(questions.map(q => [q.id, q]));

  const now       = new Date();
  let totalScore  = 0;
  let totalMarks  = 0;

  const answerRecords = body.data.answers.map(ans => {
    const question = questionMap.get(ans.questionId);
    if (!question) return null;

    totalMarks += question.marks;

    let isCorrect:    boolean | null = null;
    let marksAwarded: number | null  = null;
    const response = ans.response ?? null;

    if (question.type === "mcq" || question.type === "true_false") {
      const selectedId = response ? Number(response) : null;
      const correctOpt = question.options.find(o => o.isCorrect);
      isCorrect    = selectedId != null && correctOpt != null && selectedId === correctOpt.id;
      marksAwarded = isCorrect ? question.marks : 0;
    } else if (question.type === "multi_select") {
      const correctIds  = new Set(question.options.filter(o => o.isCorrect).map(o => o.id));
      const selectedIds = response
        ? new Set(response.split(",").map(s => Number(s.trim())).filter(Boolean))
        : new Set<number>();

      const correctCount   = [...selectedIds].filter(id => correctIds.has(id)).length;
      const incorrectCount = [...selectedIds].filter(id => !correctIds.has(id)).length;

      if (correctIds.size === 0) {
        isCorrect    = true;
        marksAwarded = question.marks;
      } else if (incorrectCount > 0) {
        // Any wrong selection → 0 marks (strict mode)
        isCorrect    = false;
        marksAwarded = 0;
      } else {
        const ratio  = correctCount / correctIds.size;
        isCorrect    = ratio === 1;
        marksAwarded = Math.round(question.marks * ratio * 100) / 100;
      }
    } else {
      // essay / short_answer → manual grading
      isCorrect    = null;
      marksAwarded = null;
    }

    if (marksAwarded != null) totalScore += marksAwarded;

    return {
      attemptId,
      questionId: question.id,
      response,
      isCorrect,
      marksAwarded: marksAwarded != null ? String(marksAwarded) : null,
    };
  }).filter(Boolean) as {
    attemptId: number;
    questionId: number;
    response: string | null;
    isCorrect: boolean | null;
    marksAwarded: string | null;
  }[];

  const scorePct = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
  const passed   = scorePct >= quiz.passMark;

  await prisma.$transaction([
    prisma.quizAnswer.deleteMany({ where: { attemptId } }),
    prisma.quizAnswer.createMany({ data: answerRecords }),
    prisma.quizAttempt.update({
      where: { id: attemptId },
      data:  {
        status:      "submitted",
        score:       String(Math.round(scorePct * 100) / 100),
        submittedAt: now,
      },
    }),
  ]);

  // Auto-update student progress to "completed"
  try {
    const institutionId = getInstId(req);
    await prisma.studentProgress.upsert({
      where:  { studentId_itemType_itemId: { studentId: attempt.studentId, itemType: "quiz", itemId: quizId } },
      update: { status: "completed", completedAt: now },
      create: {
        studentId:    attempt.studentId,
        courseId:     quiz.courseId,
        itemType:     "quiz",
        itemId:       quizId,
        status:       "completed",
        viewedAt:     now,
        completedAt:  now,
        institutionId,
      },
    });
  } catch {
    // Non-fatal
  }

  const result: any = {
    attemptId,
    score:      Math.round(scorePct * 100) / 100,
    passed,
    totalMarks,
    maxMarks:   totalMarks,
    passMark:   quiz.passMark,
    message:    passed ? "Passed" : "Not passed",
  };

  if (quiz.showResults) {
    const savedAnswers = await prisma.quizAnswer.findMany({
      where:   { attemptId },
      include: { question: { include: { options: true } } },
    });
    result.breakdown = savedAnswers.map(a => ({
      questionId:     a.questionId,
      questionBody:   a.question.body,
      questionType:   a.question.type,
      explanation:    a.question.explanation,
      marks:          a.question.marks,
      marksAwarded:   a.marksAwarded != null ? Number(a.marksAwarded) : null,
      isCorrect:      a.isCorrect,
      response:       a.response,
      correctOptions: a.question.options
        .filter(o => o.isCorrect)
        .map(o => ({ id: o.id, body: o.body })),
    }));
  }

  res.json({ success: true, result });
}));

// ─── GET ATTEMPT RESULT ───────────────────────────────────────────────────────
// GET /api/v1/quizzes/:id/attempts/:attemptId/result
router.get("/:id/attempts/:attemptId/result", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r         = req as RequestWithAuth;
  const quizId    = Number(req.params.id);
  const attemptId = Number(req.params.attemptId);

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, quizId },
  });
  if (!attempt) throw new AppError(ErrorCodes.NOT_FOUND, "Attempt not found", 404);
  if (r.user!.role === ROLES.STUDENT && attempt.studentId !== r.user!.id)
    throw new AppError(ErrorCodes.FORBIDDEN, "Not your attempt", 403);
  if (attempt.status !== "submitted")
    throw new AppError(ErrorCodes.BAD_REQUEST, "Attempt not yet submitted", 400);

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError(ErrorCodes.NOT_FOUND, "Quiz not found", 404);

  const totalMarksRow = await prisma.quizQuestion.aggregate({
    where:  { quizId },
    _sum:   { marks: true },
  });
  const totalMarks = totalMarksRow._sum.marks ?? 0;

  const result: any = {
    attemptId,
    score:    attempt.score != null ? Number(attempt.score) : null,
    passed:   attempt.score != null ? Number(attempt.score) >= quiz.passMark : null,
    totalMarks,
    maxMarks: totalMarks,
    passMark: quiz.passMark,
    message:  attempt.score != null
      ? (Number(attempt.score) >= quiz.passMark ? "Passed" : "Not passed")
      : "Pending manual grading",
  };

  if (quiz.showResults) {
    const answers = await prisma.quizAnswer.findMany({
      where:   { attemptId },
      include: { question: { include: { options: true } } },
    });
    result.breakdown = answers.map(a => ({
      questionId:     a.questionId,
      questionBody:   a.question.body,
      questionType:   a.question.type,
      explanation:    a.question.explanation,
      marks:          a.question.marks,
      marksAwarded:   a.marksAwarded != null ? Number(a.marksAwarded) : null,
      isCorrect:      a.isCorrect,
      response:       a.response,
      correctOptions: a.question.options
        .filter(o => o.isCorrect)
        .map(o => ({ id: o.id, body: o.body })),
    }));
  }

  res.json({ success: true, result });
}));

export { router as quizzesRouter };