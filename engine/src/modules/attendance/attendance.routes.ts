import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, lecturerOrAdmin, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";

const router: import("express").Router = Router();

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

const recordSchema = z.object({
  userId:     z.number().int().positive(),
  sessionRef: z.string().min(1),
  sessionTopic: z.string().optional().nullable(),
  sessionDate: z.string().datetime().optional().nullable(),
  source:     z.enum(["manual", "biometric", "qr_code", "online"]).default("manual"),
  verified:   z.boolean().default(false),
});

// GET /attendance
router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);

  const where: any = { institutionId };

  if (r.user!.role === ROLES.STUDENT) {
    where.userId = r.user!.id;
  }

  if (req.query.sessionRef) where.sessionRef = req.query.sessionRef as string;
  if (req.query.userId)     where.userId     = Number(req.query.userId);
  if (req.query.source)     where.source     = req.query.source as string;
  if (req.query.verified !== undefined) where.verified = req.query.verified === "true";

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  res.json({ success: true, ...paginate(records, total, page, limit) });
}));

// POST /attendance — single record
router.post("/", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const body = recordSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  // Prevent duplicate for same user + session
  const existing = await prisma.attendanceRecord.findFirst({
    where: { userId: body.data.userId, sessionRef: body.data.sessionRef },
  });
  if (existing) {
    res.json({ success: true, record: existing, duplicate: true });
    return;
  }

  const record = await prisma.attendanceRecord.create({
    data: {
      ...body.data,
      sessionDate: body.data.sessionDate ? new Date(body.data.sessionDate) : null,
      institutionId,
    },
  });
  res.status(201).json({ success: true, record });
}));

// POST /attendance/bulk — mark whole class at once
router.post("/bulk", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const body = z.object({
    sessionRef:   z.string().min(1),
    sessionTopic: z.string().optional().nullable(),
    sessionDate:  z.string().datetime().optional().nullable(),
    records:      z.array(z.object({
      userId: z.number().int().positive(),
      source: z.enum(["manual", "biometric", "qr_code", "online"]).default("manual"),
    })),
  }).safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const { sessionRef, sessionTopic, sessionDate, records } = body.data;

  const existing = await prisma.attendanceRecord.findMany({
    where:  { sessionRef, userId: { in: records.map((r) => r.userId) } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e) => e.userId));

  const toCreate = records
    .filter((r) => !existingIds.has(r.userId))
    .map((r) => ({
      userId: r.userId,
      sessionRef,
      sessionTopic: sessionTopic ?? null,
      sessionDate: sessionDate ? new Date(sessionDate) : null,
      source: r.source,
      institutionId,
      verified: false,
    }));

  if (toCreate.length > 0) {
    await prisma.attendanceRecord.createMany({ data: toCreate });
  }

  res.json({ success: true, created: toCreate.length, skipped: records.length - toCreate.length });
}));

// PUT /attendance/:id/override
router.put("/:id/override", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r    = req as RequestWithAuth;
  const body = z.object({ verified: z.boolean() }).safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "verified required", 400);

  const record = await prisma.attendanceRecord.update({
    where: { id: Number(req.params.id) },
    data:  { verified: body.data.verified, overrideById: r.user!.id },
  });
  res.json({ success: true, record });
}));

// GET /attendance/summary/:studentId
router.get("/summary/:studentId", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r         = req as RequestWithAuth;
  const studentId = Number(req.params.studentId);
  if (isNaN(studentId)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid student id", 400);

  const isSelf  = r.user!.id === studentId;
  const isAdmin = ["platform_admin", "institution_admin", "lecturer"].includes(r.user!.role);
  if (!isSelf && !isAdmin)
    throw new AppError(ErrorCodes.FORBIDDEN, "Access denied", 403);

  const records = await prisma.attendanceRecord.findMany({
    where:   { userId: studentId, institutionId: getInstId(req) },
    orderBy: { createdAt: "desc" },
  });

  const total   = records.length;
  const present = records.filter((r) => r.verified).length;
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

  const bySource = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      studentId,
      total,
      present,
      absent:          total - present,
      rate,
      attendanceRate:  total > 0 ? rate.toFixed(1) + "%" : "N/A",
      bySource,
      records:         records.map((r) => ({
        id:           r.id,
        sessionRef:   r.sessionRef,
        sessionTopic: r.sessionTopic,
        sessionDate:  r.sessionDate,
        source:       r.source,
        verified:     r.verified,
        createdAt:    r.createdAt,
      })),
    },
  });
}));

// POST /attendance/biometric — device webhook
// FIX TS2322: payload field is Json — cast Record<string,unknown> to Prisma.InputJsonValue
router.post("/biometric", asyncHandler(async (req: Request, res: Response) => {
  const body = z.object({
    deviceId:   z.string().optional(),
    externalId: z.string().optional(),
    payload:    z.record(z.unknown()),
  }).safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid biometric payload", 400);

  await prisma.biometricEvent.create({
    data: {
      deviceId:   body.data.deviceId   ?? null,
      externalId: body.data.externalId ?? null,
      // FIX: cast to Prisma.InputJsonValue — Prisma JSON fields reject plain Record<string,unknown>
      payload:    body.data.payload as Prisma.InputJsonValue,
    },
  });
  res.json({ success: true, message: "Biometric event received" });
}));

export { router as attendanceRouter };