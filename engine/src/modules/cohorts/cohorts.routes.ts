import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, adminOnly, anyRole } from "@/common/middleware";
import { parsePagination, paginate, type RequestWithAuth } from "@/common/types";

const router: import("express").Router = Router();

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

const cohortCreateSchema = z.object({
  name:          z.string().min(2).max(200),
  code:          z.string().min(1).max(30).toUpperCase(),
  description:   z.string().optional().nullable(),
  academicYear:  z.string().min(4).max(10),
  semester:      z.string().min(1).max(30),
  maxStudents:   z.number().int().positive().default(50),
  startDate:     z.string().datetime(),
  endDate:       z.string().datetime(),
  coordinatorId: z.number().int().positive(), // This will be userId (from frontend)
});

// Helper to resolve userId to lecturerProfile.id
async function resolveCoordinatorId(userId: number): Promise<number> {
  const profile = await prisma.lecturerProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new AppError(ErrorCodes.BAD_REQUEST, "User is not a lecturer", 400);
  }
  return profile.id;
}

// GET /cohorts
router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);
  const isActive = req.query.isActive !== "false";

  const [cohorts, total] = await Promise.all([
    prisma.cohort.findMany({
      where:   { institutionId, isActive },
      skip, take: limit,
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
      include: {
        coordinator: { include: { user: { select: { id: true, name: true } } } },
        _count:      { select: { enrollments: true, courses: true } },
      },
    }),
    prisma.cohort.count({ where: { institutionId, isActive } }),
  ]);
  res.json({ success: true, ...paginate(cohorts, total, page, limit) });
}));

// POST /cohorts
router.post("/", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = cohortCreateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const exists = await prisma.cohort.findFirst({ where: { code: body.data.code, institutionId } });
  if (exists) throw new AppError(ErrorCodes.CONFLICT, "Cohort code already exists for this institution", 409);

  const coordinatorProfileId = await resolveCoordinatorId(body.data.coordinatorId);

  const cohort = await prisma.cohort.create({
    data: {
      ...body.data,
      coordinatorId: coordinatorProfileId,
      startDate: new Date(body.data.startDate),
      endDate:   new Date(body.data.endDate),
      institutionId,
      createdBy: r.user!.id,
    },
  });
  res.status(201).json({ success: true, cohort });
}));

// GET /cohorts/:id
router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const cohort = await prisma.cohort.findFirst({
    where:   { id, institutionId: getInstId(req) },
    include: {
      coordinator: { include: { user: { select: { id: true, name: true, email: true } } } },
      courses:     { include: { course: { select: { id: true, name: true, code: true, credits: true } } } },
      enrollments: {
        where:   { isActive: true },
        include: { student: { select: { id: true, name: true, email: true } } },
        orderBy: { student: { name: "asc" } },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!cohort) throw new AppError(ErrorCodes.NOT_FOUND, "Cohort not found", 404);
  res.json({ success: true, cohort });
}));

// PUT /cohorts/:id
router.put("/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = cohortCreateSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const data: any = { ...body.data };
  if (data.startDate) data.startDate = new Date(data.startDate);
  if (data.endDate)   data.endDate   = new Date(data.endDate);

  // If coordinatorId is provided, it's a userId, map to profile ID
  if (data.coordinatorId) {
    data.coordinatorId = await resolveCoordinatorId(data.coordinatorId);
  }

  const cohort = await prisma.cohort.update({ where: { id }, data });
  res.json({ success: true, cohort });
}));

// DELETE /cohorts/:id — soft delete
router.delete("/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  await prisma.cohort.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ success: true });
}));

// POST /cohorts/:id/enroll — FIX ENG-L02: capacity check in Serializable $transaction
router.post("/:id/enroll", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const cohortId      = Number(req.params.id);
  const institutionId = getInstId(req);
  const body = z.object({ studentId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "studentId required", 400);

  const cohort = await prisma.cohort.findFirst({ where: { id: cohortId, institutionId } });
  if (!cohort) throw new AppError(ErrorCodes.NOT_FOUND, "Cohort not found", 404);

  // FIX ENG-L02: wrap check + insert in Serializable transaction to prevent race condition
  // Two simultaneous enrollments can no longer both pass the capacity check
  const enrollment = await prisma.$transaction(async (tx) => {
    const count = await tx.cohortEnrollment.count({ where: { cohortId, isActive: true } });
    if (count >= cohort.maxStudents) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        `Cohort is at maximum capacity (${cohort.maxStudents} students)`,
        409
      );
    }
    return tx.cohortEnrollment.upsert({
      where:  { cohortId_studentId: { cohortId, studentId: body.data.studentId } },
      update: { isActive: true },
      create: { cohortId, studentId: body.data.studentId, institutionId },
    });
  }, { isolationLevel: "Serializable" });

  res.status(201).json({ success: true, enrollment });
}));

// DELETE /cohorts/:id/enroll/:studentId
router.delete("/:id/enroll/:studentId", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const cohortId  = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  await prisma.cohortEnrollment.update({
    where: { cohortId_studentId: { cohortId, studentId } },
    data:  { isActive: false },
  });
  res.json({ success: true });
}));

// POST /cohorts/:id/courses
router.post("/:id/courses", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const cohortId      = Number(req.params.id);
  const institutionId = getInstId(req);
  const body = z.object({ courseId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "courseId required", 400);

  await prisma.cohortCourse.upsert({
    where:  { cohortId_courseId: { cohortId, courseId: body.data.courseId } },
    update: {},
    create: { cohortId, courseId: body.data.courseId, institutionId },
  });
  res.status(201).json({ success: true });
}));

// DELETE /cohorts/:id/courses/:courseId
router.delete("/:id/courses/:courseId", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  await prisma.cohortCourse.delete({
    where: { cohortId_courseId: { cohortId: Number(req.params.id), courseId: Number(req.params.courseId) } },
  });
  res.json({ success: true });
}));

export { router as cohortsRouter };