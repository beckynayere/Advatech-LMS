// DESTINATION: engine/src/modules/assignments/assignments.routes.ts
// CHANGES FROM ORIGINAL:
//   - POST /:id/submissions now upserts StudentProgress to "completed" after successful submit
//   - All other logic unchanged
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, lecturerOrAdmin, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";
import { buildS3Key, uploadToS3, getPresignedDownloadUrl, isS3Configured } from "@/lib/s3";

const router: import("express").Router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

const assignmentSchema = z.object({
  title:           z.string().min(1).max(255),
  description:     z.string().optional().nullable(),
  instructions:    z.string().optional().nullable(),
  courseId:        z.number().int().positive(),
  schoolId:        z.number().int().positive().optional().nullable(),
  dueDate:         z.string().datetime(),
  maxMarks:        z.number().int().positive().default(100),
  allowLateSubmit: z.boolean().default(false),
  latePenaltyPct:  z.number().int().min(0).max(100).default(0),
  maxAttempts:     z.number().int().positive().default(1),
  isPublished:     z.boolean().default(false),
});

// GET /assignments
router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);
  const where: any = { institutionId, isActive: true };
  if (req.query.courseId)    where.courseId   = Number(req.query.courseId);
  if (req.query.isPublished !== undefined)
    where.isPublished = req.query.isPublished === "true";
  if (r.user!.role === ROLES.STUDENT) where.isPublished = true;
  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where, skip, take: limit,
      orderBy: { dueDate: "asc" },
      include: {
        course:  { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, name: true } },
        _count:  { select: { submissions: true } },
      },
    }),
    prisma.assignment.count({ where }),
  ]);
  let data: any[] = assignments;
  if (r.user!.role === ROLES.STUDENT) {
    const subs = await prisma.submission.findMany({
      where:   { studentId: r.user!.id, assignmentId: { in: assignments.map(a => a.id) } },
      orderBy: { attempt: "desc" },
    });
    const subMap = new Map(subs.map(s => [s.assignmentId, s]));
    data = assignments.map(a => ({ ...a, mySubmission: subMap.get(a.id) ?? null }));
  }
  res.json({ success: true, ...paginate(data, total, page, limit) });
}));

// POST /assignments
router.post("/", lecturerOrAdmin, upload.single("brief"), asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = assignmentSchema.safeParse(
    typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body
  );
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  let attachmentKey: string | undefined;
  if (req.file) {
    if (!isS3Configured()) throw new AppError(ErrorCodes.INTERNAL_ERROR, "S3 not configured", 500);
    const inst = await prisma.institution.findUnique({ where: { id: institutionId } });
    attachmentKey = buildS3Key(inst?.slug ?? String(institutionId), "assignments", req.file.originalname);
    await uploadToS3(attachmentKey, req.file.buffer, req.file.mimetype);
  }
  const assignment = await prisma.assignment.create({
    data: {
      ...body.data,
      dueDate: new Date(body.data.dueDate),
      institutionId, createdBy: r.user!.id,
      ...(attachmentKey && { attachmentKey }),
    },
  });
  res.status(201).json({ success: true, assignment });
}));

// GET /assignments/:id
router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const id = Number(req.params.id);
  const assignment = await prisma.assignment.findFirst({
    where:   { id, institutionId: getInstId(req), isActive: true },
    include: {
      course:  { select: { id: true, name: true, code: true } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!assignment) throw new AppError(ErrorCodes.NOT_FOUND, "Assignment not found", 404);
  let attachmentUrl: string | null = null;
  if (assignment.attachmentKey) attachmentUrl = await getPresignedDownloadUrl(assignment.attachmentKey);
  let mySubmission = null;
  if (r.user!.role === ROLES.STUDENT) {
    mySubmission = await prisma.submission.findFirst({
      where:   { assignmentId: id, studentId: r.user!.id },
      orderBy: { attempt: "desc" },
    });
  }
  res.json({ success: true, assignment: { ...assignment, attachmentUrl }, mySubmission });
}));

// PUT /assignments/:id
router.put("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = assignmentSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const data: any = { ...body.data };
  if (data.dueDate) data.dueDate = new Date(data.dueDate);
  const assignment = await prisma.assignment.update({ where: { id: Number(req.params.id) }, data });
  res.json({ success: true, assignment });
}));

// DELETE /assignments/:id — soft delete
router.delete("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  await prisma.assignment.update({
    where: { id: Number(req.params.id) },
    data:  { isActive: false },
  });
  res.json({ success: true });
}));

// GET /assignments/:id/submissions — lecturer sees all
router.get("/:id/submissions", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const assignmentId = Number(req.params.id);
  const { page, limit, skip } = parsePagination(req.query as any);
  const where: any = { assignmentId };
  if (req.query.status) where.status = req.query.status as string;
  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where, skip, take: limit,
      orderBy: { submittedAt: "desc" },
      include: { student: { select: { id: true, name: true, email: true } } },
    }),
    prisma.submission.count({ where }),
  ]);
  res.json({ success: true, ...paginate(submissions, total, page, limit) });
}));

// GET /assignments/:id/submissions/my
router.get("/:id/submissions/my", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r = req as RequestWithAuth;
  const submissions = await prisma.submission.findMany({
    where:   { assignmentId: Number(req.params.id), studentId: r.user!.id },
    orderBy: { attempt: "desc" },
  });
  res.json({ success: true, data: submissions });
}));

// POST /assignments/:id/submissions — FIX 2: auto-progress on submit
router.post("/:id/submissions", anyRole, upload.array("files", 10), asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const assignmentId  = Number(req.params.id);
  const institutionId = getInstId(req);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, institutionId, isActive: true },
  });
  if (!assignment) throw new AppError(ErrorCodes.NOT_FOUND, "Assignment not found", 404);
  if (!assignment.isPublished)
    throw new AppError(ErrorCodes.FORBIDDEN, "Assignment is not published", 403);

  const now    = new Date();
  const isLate = now > assignment.dueDate;
  if (isLate && !assignment.allowLateSubmit)
    throw new AppError(ErrorCodes.FORBIDDEN, `Submission deadline was ${assignment.dueDate.toLocaleString()}`, 403);

  const prevAttempts = await prisma.submission.count({ where: { assignmentId, studentId: r.user!.id } });
  if (prevAttempts >= assignment.maxAttempts)
    throw new AppError(ErrorCodes.FORBIDDEN, `Maximum ${assignment.maxAttempts} attempt(s) allowed`, 403);

  const files    = req.files as Express.Multer.File[] | undefined;
  const fileKeys: string[] = [];
  if (files?.length) {
    if (!isS3Configured()) throw new AppError(ErrorCodes.INTERNAL_ERROR, "S3 not configured", 500);
    const inst = await prisma.institution.findUnique({ where: { id: institutionId } });
    const slug = inst?.slug ?? String(institutionId);
    for (const file of files) {
      const key = buildS3Key(slug, `submissions/assignment-${assignmentId}`, file.originalname);
      await uploadToS3(key, file.buffer, file.mimetype);
      fileKeys.push(key);
    }
  }

  const submission = await prisma.submission.create({
    data: {
      assignmentId, studentId: r.user!.id,
      attempt:      prevAttempts + 1,
      status:       isLate ? "late" : "submitted",
      fileKeys,
      textResponse: (req.body.textResponse as string) ?? null,
      submittedAt:  now,
      institutionId,
    },
  });

  // FIX 2: Auto-update student progress to "completed"
  try {
    await prisma.studentProgress.upsert({
      where:  { studentId_itemType_itemId: { studentId: r.user!.id, itemType: "assignment", itemId: assignmentId } },
      update: { status: "completed", completedAt: now },
      create: {
        studentId:    r.user!.id,
        courseId:     assignment.courseId,
        itemType:     "assignment",
        itemId:       assignmentId,
        status:       "completed",
        viewedAt:     now,
        completedAt:  now,
        institutionId,
      },
    });
  } catch {
    // Non-fatal — submission already succeeded
  }

  res.status(201).json({ success: true, submission });
}));

// PUT /assignments/:assignmentId/submissions/:submissionId/grade
router.put("/:assignmentId/submissions/:submissionId/grade", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r            = req as RequestWithAuth;
  const submissionId = Number(req.params.submissionId);
  const body = z.object({
    grade:    z.number().min(0),
    feedback: z.string().optional().nullable(),
  }).safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId }, include: { assignment: true },
  });
  if (!submission) throw new AppError(ErrorCodes.NOT_FOUND, "Submission not found", 404);
  let marks = body.data.grade;
  if (submission.status === "late" && submission.assignment.latePenaltyPct > 0) {
    const daysDiff = Math.ceil(
      (submission.submittedAt!.getTime() - submission.assignment.dueDate.getTime()) / 86400000
    );
    const penalty = Math.min(marks, (submission.assignment.latePenaltyPct / 100) * submission.assignment.maxMarks * daysDiff);
    marks = Math.max(0, marks - penalty);
  }
  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data:  { marks, feedback: body.data.feedback ?? null, status: "graded", gradedAt: new Date(), gradedBy: r.user!.id },
    include: { assignment: { select: { title: true, maxMarks: true } } },
  });
  try {
    await prisma.notification.create({
      data: {
        userId:        submission.studentId,
        institutionId: submission.institutionId,
        channel:       "in_app",
        subject:       `Assignment graded: ${updated.assignment.title}`,
        body:          `Your submission received ${marks}/${updated.assignment.maxMarks} marks.${body.data.feedback ? ` Feedback: ${body.data.feedback.slice(0, 150)}` : ""}`,
        sentAt:        new Date(),
      },
    });
  } catch { /* non-fatal */ }
  res.json({ success: true, submission: updated });
}));

// GET /assignments/:assignmentId/submissions/:submissionId/download-files
router.get("/:assignmentId/submissions/:submissionId/download-files", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const sub = await prisma.submission.findUnique({ where: { id: Number(req.params.submissionId) } });
  if (!sub) throw new AppError(ErrorCodes.NOT_FOUND, "Submission not found", 404);
  const urls = await Promise.all(sub.fileKeys.map(k => getPresignedDownloadUrl(k)));
  res.json({ success: true, files: sub.fileKeys.map((key, i) => ({ key, url: urls[i] })) });
}));

export { router as assignmentsRouter };