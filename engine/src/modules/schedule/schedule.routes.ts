import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, adminOnly, lecturerOrAdmin, anyRole } from "@/common/middleware";
import { type RequestWithAuth } from "@/common/types";

const router: import("express").Router = Router();

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

// ══════════════════════════════════════════════════════════════
//  TIMETABLE
// ══════════════════════════════════════════════════════════════

const slotSchema = z.object({
  courseId:   z.number().int().positive(),
  lecturerId: z.number().int().positive(),
  roomRef:    z.string().optional().nullable(),
  startAt:    z.string().datetime(),
  endAt:      z.string().datetime(),
  recurrence: z.string().optional().nullable(),
});

router.get("/timetable", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const where: any    = { institutionId };
  if (req.query.courseId)   where.courseId   = Number(req.query.courseId);
  if (req.query.lecturerId) where.lecturerId = Number(req.query.lecturerId);
  if (req.query.weekStart) {
    const weekStart = new Date(req.query.weekStart as string);
    const weekEnd   = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    where.startAt = { gte: weekStart, lt: weekEnd };
  }
  if (r.user!.role === "student") where.published = true;
  const slots = await prisma.timetableSlot.findMany({
    where, orderBy: { startAt: "asc" },
    include: {
      course:   { select: { id: true, name: true, code: true } },
      lecturer: { select: { id: true, name: true } },
    },
  });
  res.json({ success: true, data: slots });
}));

router.post("/timetable", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const body = slotSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const start = new Date(body.data.startAt);
  const end   = new Date(body.data.endAt);
  if (end <= start) throw new AppError(ErrorCodes.BAD_REQUEST, "endAt must be after startAt", 400);
  const conflict = await prisma.timetableSlot.findFirst({
    where: { lecturerId: body.data.lecturerId, institutionId, AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }] },
  });
  if (conflict)
    throw new AppError(ErrorCodes.CONFLICT, `Lecturer already has a slot ${conflict.startAt.toLocaleTimeString()}–${conflict.endAt.toLocaleTimeString()}`, 409);
  const slot = await prisma.timetableSlot.create({
    data: { ...body.data, startAt: start, endAt: end, institutionId },
    include: { course: { select: { id: true, name: true, code: true } }, lecturer: { select: { id: true, name: true } } },
  });
  res.status(201).json({ success: true, data: slot });
}));

router.put("/timetable/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const body = slotSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const data: any = { ...body.data };
  if (data.startAt) data.startAt = new Date(data.startAt);
  if (data.endAt)   data.endAt   = new Date(data.endAt);
  const slot = await prisma.timetableSlot.update({ where: { id: Number(req.params.id) }, data });
  res.json({ success: true, data: slot });
}));

router.delete("/timetable/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  await prisma.timetableSlot.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
}));

router.post("/timetable/:id/publish", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const slot = await prisma.timetableSlot.update({ where: { id: Number(req.params.id) }, data: { published: true } });
  res.json({ success: true, data: slot });
}));

// ══════════════════════════════════════════════════════════════
//  ONLINE CLASSES
// ══════════════════════════════════════════════════════════════

const sessionSchema = z.object({
  courseId:    z.number().int().positive(),
  title:       z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  startAt:     z.string().datetime(),
  endAt:       z.string().datetime(),
  provider:    z.enum(["zoom", "teams", "meet", "google_meet", "bbb", "custom"]).default("zoom"),
  joinUrl:     z.string().url(),
});

router.get("/online-classes", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const where: any    = { institutionId };
  if (req.query.courseId) where.courseId = Number(req.query.courseId);
  if (req.query.status)   where.status   = req.query.status as string;
  if (req.query.upcoming === "true") where.startAt = { gte: new Date() };
  const sessions = await prisma.onlineClassSession.findMany({
    where, orderBy: { startAt: "asc" },
    include: {
      course:     { select: { id: true, name: true, code: true } },
      lecturer:   { select: { id: true, name: true } },
      recordings: { select: { id: true, title: true, availableAt: true } },
    },
  });
  res.json({ success: true, data: sessions });
}));

router.post("/online-classes", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = sessionSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const session = await prisma.onlineClassSession.create({
    data: { ...body.data, startAt: new Date(body.data.startAt), endAt: new Date(body.data.endAt), lecturerId: r.user!.id, institutionId },
    include: { course: { select: { id: true, name: true, code: true } }, lecturer: { select: { id: true, name: true } } },
  });
  res.status(201).json({ success: true, data: session });
}));

router.get("/online-classes/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const session = await prisma.onlineClassSession.findUnique({
    where:   { id: Number(req.params.id) },
    include: { course: true, lecturer: { select: { id: true, name: true, email: true } }, recordings: { orderBy: { createdAt: "desc" } } },
  });
  if (!session) throw new AppError(ErrorCodes.NOT_FOUND, "Session not found", 404);
  res.json({ success: true, data: session });
}));

router.patch("/online-classes/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id            = Number(req.params.id);
  const institutionId = getInstId(req);
  const session = await prisma.onlineClassSession.findFirst({ where: { id, institutionId } });
  if (!session) throw new AppError(ErrorCodes.NOT_FOUND, "Session not found", 404);
  const updateSchema = z.object({
    title:       z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    startAt:     z.string().datetime().optional(),
    endAt:       z.string().datetime().optional(),
    provider:    z.string().optional(),
    joinUrl:     z.string().url().optional(),
    status:      z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
  });
  const body = updateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const data: any = { ...body.data };
  if (data.startAt) data.startAt = new Date(data.startAt);
  if (data.endAt)   data.endAt   = new Date(data.endAt);
  const updated = await prisma.onlineClassSession.update({ where: { id }, data });
  res.json({ success: true, data: updated });
}));

// FIX TS2345: `return res.json(...)` → res.json(); return;  — asyncHandler expects Promise<void>
router.post("/online-classes/:id/start", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id            = Number(req.params.id);
  const institutionId = getInstId(req);
  const session = await prisma.onlineClassSession.findFirst({ where: { id, institutionId } });
  if (!session) throw new AppError(ErrorCodes.NOT_FOUND, "Session not found", 404);
  if (session.status === "live") {
    res.json({ success: true, data: session });
    return;
  }
  if (!["scheduled", "live"].includes(session.status))
    throw new AppError(ErrorCodes.BAD_REQUEST, `Cannot start a '${session.status}' session`, 400);
  const updated = await prisma.onlineClassSession.update({
    where: { id },
    data:  { status: "live", actualStartAt: new Date() },
    include: { course: { select: { id: true, name: true, code: true } }, lecturer: { select: { id: true, name: true } } },
  });
  res.json({ success: true, data: updated });
}));

// FIX TS2345: same pattern
router.post("/online-classes/:id/end", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id            = Number(req.params.id);
  const institutionId = getInstId(req);
  const session = await prisma.onlineClassSession.findFirst({ where: { id, institutionId } });
  if (!session) throw new AppError(ErrorCodes.NOT_FOUND, "Session not found", 404);
  if (session.status === "ended") {
    res.json({ success: true, data: session });
    return;
  }
  if (!["live", "scheduled"].includes(session.status))
    throw new AppError(ErrorCodes.BAD_REQUEST, `Cannot end a '${session.status}' session`, 400);
  const updated = await prisma.onlineClassSession.update({
    where: { id },
    data:  { status: "ended", actualEndAt: new Date() },
    include: { course: { select: { id: true, name: true, code: true } }, lecturer: { select: { id: true, name: true } } },
  });
  res.json({ success: true, data: updated });
}));

router.delete("/online-classes/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  await prisma.onlineClassSession.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
}));

// ══════════════════════════════════════════════════════════════
//  RECORDINGS
// ══════════════════════════════════════════════════════════════

router.get("/online-classes/:sessionId/recordings", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r          = req as RequestWithAuth;
  const now        = new Date();
  const isInst     = ["platform_admin", "institution_admin", "lecturer"].includes(r.user!.role);
  const where: any = { sessionId: Number(req.params.sessionId) };
  if (!isInst) where.OR = [{ availableAt: null }, { availableAt: { lte: now } }];
  const recordings = await prisma.classRecording.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ success: true, data: recordings });
}));

// FIX: Accept both "url" and "s3Key"
router.post("/online-classes/:sessionId/recordings", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const bodySchema = z.object({
    title:       z.string().optional().nullable(),
    url:         z.string().optional().nullable(),
    s3Key:       z.string().optional().nullable(),
    durationSec: z.number().int().positive().optional().nullable(),
    availableAt: z.string().datetime().optional().nullable(),
  }).refine(data => data.url || data.s3Key, {
    message: "Either 'url' or 's3Key' must be provided",
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const s3Key = body.data.s3Key ?? body.data.url; // If url is provided, treat as s3Key
  const recording = await prisma.classRecording.create({
    data: {
      title:       body.data.title ?? null,
      s3Key:       s3Key!,
      durationSec: body.data.durationSec ?? null,
      availableAt: body.data.availableAt ? new Date(body.data.availableAt) : null,
      sessionId:   Number(req.params.sessionId),
    },
  });
  res.status(201).json({ success: true, data: recording });
}));

router.delete("/online-classes/:sessionId/recordings/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  await prisma.classRecording.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
}));

export { router as scheduleRouter };