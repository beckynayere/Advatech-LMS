import { Router, type Request, type Response } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, adminOnly, lecturerOrAdmin, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";
import { buildS3Key, uploadToS3, getPresignedDownloadUrl, deleteFromS3, isS3Configured } from "@/lib/s3";
import { moduleCache } from "@/lib/cache";
 
const router: import("express").Router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
 
function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

// Helper to resolve userId to lecturerProfile.id
async function resolveLecturerId(userId: number): Promise<number> {
  const profile = await prisma.lecturerProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new AppError(ErrorCodes.BAD_REQUEST, "User is not a lecturer", 400);
  }
  return profile.id;
}
 
const courseCreateSchema = z.object({
  name:         z.string().min(2).max(200),
  code:         z.string().min(1).max(20).toUpperCase(),
  description:  z.string().optional().nullable(),
  credits:      z.number().int().min(1).max(30).default(3),
  semester:     z.string().optional().nullable(),
  academicYear: z.string().optional().nullable(),
  maxStudents:  z.number().int().positive().default(50),
  schoolId:     z.number().int().positive().optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
});
 
// GET /courses
router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);
  const where: any = { isActive: true };
  if (institutionId)          where.institutionId  = institutionId;
  if (req.query.semester)     where.semester       = req.query.semester;
  if (req.query.academicYear) where.academicYear   = req.query.academicYear;
  if (req.query.schoolId)     where.schoolId       = Number(req.query.schoolId);
  if (req.query.departmentId) where.departmentId   = Number(req.query.departmentId);
  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search as string, mode: "insensitive" } },
      { code: { contains: req.query.search as string, mode: "insensitive" } },
    ];
  }
  if (r.user!.role === ROLES.STUDENT) {
    const enrolled = await prisma.cohortEnrollment.findMany({
      where:  { studentId: r.user!.id, isActive: true },
      select: { cohortId: true },
    });
    where.cohorts = { some: { cohortId: { in: enrolled.map(e => e.cohortId) } } };
  }
  if (r.user!.role === ROLES.LECTURER) {
    const profile = await prisma.lecturerProfile.findUnique({ where: { userId: r.user!.id } });
    if (!profile) {
      res.json({ success: true, data: [], total: 0, page: 1, limit, totalPages: 0 });
      return;
    }
    where.lecturers = { some: { lecturerId: profile.id } };
  }
  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where, skip, take: limit, orderBy: { name: "asc" },
      include: {
        school:     { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        lecturers:  { include: { lecturer: { include: { user: { select: { id: true, name: true } } } } } },
        _count:     { select: { materials: true, assignments: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);
  res.json({ success: true, ...paginate(courses, total, page, limit) });
}));
 
// POST /courses
router.post("/", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = courseCreateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const exists = await prisma.course.findFirst({ where: { code: body.data.code, institutionId } });
  if (exists) throw new AppError(ErrorCodes.CONFLICT, "Course code already exists for this institution", 409);
  const course = await prisma.course.create({ data: { ...body.data, institutionId, createdBy: r.user!.id } });
  res.status(201).json({ success: true, course });
}));
 
// GET /courses/:id
router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const id = Number(req.params.id);
  const course = await prisma.course.findFirst({
    where:   { id, institutionId: getInstId(req) },
    include: {
      school:     { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      lecturers:  { include: { lecturer: { include: { user: { select: { id: true, name: true, email: true } } } } } },
      _count:     { select: { materials: true, assignments: true, quizzes: true, exams: true } },
      modules: {
        where:   r.user!.role === ROLES.STUDENT ? { isPublished: true } : undefined,
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!course) throw new AppError(ErrorCodes.NOT_FOUND, "Course not found", 404);
  res.json({ success: true, course });
}));
 
// PUT /courses/:id
router.put("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = courseCreateSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const course = await prisma.course.update({ where: { id: Number(req.params.id) }, data: body.data });
  res.json({ success: true, course });
}));
 
// DELETE /courses/:id — soft
router.delete("/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  await prisma.course.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ success: true });
}));
 
// POST /courses/:id/lecturers
router.post("/:id/lecturers", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const courseId      = Number(req.params.id);
  const institutionId = getInstId(req);
  const body = z.object({ lecturerId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "lecturerId required", 400);

  // Map userId to lecturer profile ID
  const lecturerProfileId = await resolveLecturerId(body.data.lecturerId);

  await prisma.courseLecturer.upsert({
    where:  { courseId_lecturerId: { courseId, lecturerId: lecturerProfileId } },
    update: {},
    create: { courseId, lecturerId: lecturerProfileId, institutionId },
  });
  res.status(201).json({ success: true });
}));
 
// DELETE /courses/:id/lecturers/:lecturerId
router.delete("/:id/lecturers/:lecturerId", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  await prisma.courseLecturer.delete({
    where: { courseId_lecturerId: { courseId: Number(req.params.id), lecturerId: Number(req.params.lecturerId) } },
  });
  res.json({ success: true });
}));
 
// ─── MATERIALS ────────────────────────────────────────────────────────────────
 
const materialCreateSchema = z.object({
  title:        z.string().min(1).max(255),
  description:  z.string().optional().nullable(),
  type:         z.enum(["document", "video", "link", "embed"]).default("document"),type:         z.enum(["document", "video", "link", "embed", "page"]).default("document"),
  externalUrl:  z.string().url().optional().nullable(),
  content:      z.string().optional().nullable(),
  weekNumber:   z.number().int().min(1).max(52).optional().nullable(),
  isLocked:     z.boolean().default(false),
  unlockDate:   z.string().datetime().optional().nullable(),
  isVisible:    z.boolean().default(true),
  sortOrder:    z.number().int().default(0),
  schoolId:     z.number().int().positive(),
  departmentId: z.number().int().positive().optional().nullable(),
});
 
// FIX 7: GET /:id/materials — pagination via ?page=&limit=
router.get("/:id/materials", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r        = req as RequestWithAuth;
  const courseId = Number(req.params.id);
  const now      = new Date();
  const isInst   = ["platform_admin", "institution_admin", "lecturer"].includes(r.user!.role);
  const { page, limit, skip } = parsePagination(req.query as any);
 
  const where: any = { courseId };
  if (!isInst) {
    where.isVisible = true;
    where.OR = [{ isLocked: false }, { isLocked: true, unlockDate: { lte: now } }];
  }
 
  const [materials, total] = await Promise.all([
    prisma.courseMaterial.findMany({
      where, skip, take: limit,
      orderBy: [{ weekNumber: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true, title: true, description: true, type: true,
        externalUrl: true, content: true, weekNumber: true,
        isLocked: true, unlockDate: true, isVisible: true, sortOrder: true,
        fileId: true, createdAt: true,
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.courseMaterial.count({ where }),
  ]);
  res.json({ success: true, ...paginate(materials, total, page, limit) });
}));
 
// POST /:id/materials
router.post("/:id/materials", lecturerOrAdmin, upload.single("file"), asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const courseId      = Number(req.params.id);
  const institutionId = getInstId(req);
  const body = materialCreateSchema.safeParse(
    typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body
  );
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  let fileId: string | undefined;
  if (req.file) {
    if (!isS3Configured()) throw new AppError(ErrorCodes.INTERNAL_ERROR, "File storage not configured", 500);
    const inst = await prisma.institution.findUnique({ where: { id: institutionId } });
    fileId = buildS3Key(inst?.slug ?? String(institutionId), "materials", req.file.originalname);
    await uploadToS3(fileId, req.file.buffer, req.file.mimetype);
  }
  const material = await prisma.courseMaterial.create({
    data: {
      ...body.data,
      unlockDate: body.data.unlockDate ? new Date(body.data.unlockDate) : null,
      courseId, institutionId, createdBy: r.user!.id,
      ...(fileId && { fileId }),
    },
  });
  // FIX 8: invalidate material cache
  moduleCache.del(`modules:${courseId}:student`);
  res.status(201).json({ success: true, material });
}));
 
// GET /:courseId/materials/:id  — FIX 2: auto-progress "viewed" for students
router.get("/:courseId/materials/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r          = req as RequestWithAuth;
  const materialId = Number(req.params.id);
  const courseId   = Number(req.params.courseId);
  const now        = new Date();
  const isInst     = ["platform_admin", "institution_admin", "lecturer"].includes(r.user!.role);
 
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
  if (!material) throw new AppError(ErrorCodes.NOT_FOUND, "Material not found", 404);
 
  if (!isInst && material.isLocked) {
    if (!material.unlockDate || material.unlockDate > now) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        material.unlockDate ? `Unlocks on ${material.unlockDate.toLocaleDateString()}` : "Locked",
        403
      );
    }
  }
 
  // Access log (non-fatal)
  prisma.materialAccessLog.create({
    data: {
      materialId, userId: r.user!.id,
      institutionId: getInstId(req),
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    },
  }).catch(() => {});
 
  // FIX 2: Auto-progress "viewed" for students — fire-and-forget, non-fatal
  if (r.user!.role === ROLES.STUDENT) {
    const institutionId = getInstId(req);
    prisma.studentProgress.upsert({
      where:  { studentId_itemType_itemId: { studentId: r.user!.id, itemType: "material", itemId: materialId } },
      // Don't downgrade "completed" back to "viewed" — only create if missing
      update: {},
      create: {
        studentId:    r.user!.id,
        courseId,
        itemType:     "material",
        itemId:       materialId,
        status:       "viewed",
        viewedAt:     now,
        completedAt:  null,
        institutionId,
      },
    }).catch(() => {});
  }
 
  if (material.fileId) {
    const url = await getPresignedDownloadUrl(material.fileId);
    res.json({ success: true, downloadUrl: url, material });
    return;
  }
  res.json({ success: true, material });
}));
 
// PUT /:courseId/materials/:id
router.put("/:courseId/materials/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const courseId = Number(req.params.courseId);
  const body = materialCreateSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const data: any = { ...body.data };
  if (data.unlockDate) data.unlockDate = new Date(data.unlockDate);
  const material = await prisma.courseMaterial.update({ where: { id: Number(req.params.id) }, data });
  // FIX 8: invalidate cache on material update
  moduleCache.del(`modules:${courseId}:student`);
  res.json({ success: true, material });
}));
 
// DELETE /:courseId/materials/:id — S3 cleanup already existed; preserved unchanged
router.delete("/:courseId/materials/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const courseId = Number(req.params.courseId);
  const material = await prisma.courseMaterial.findUnique({ where: { id: Number(req.params.id) } });
  if (material?.fileId) await deleteFromS3(material.fileId).catch(() => {});
  await prisma.courseMaterial.delete({ where: { id: Number(req.params.id) } });
  // FIX 8: invalidate cache on delete
  moduleCache.del(`modules:${courseId}:student`);
  res.json({ success: true });
}));
 
export { router as coursesRouter };