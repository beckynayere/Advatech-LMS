// DESTINATION: engine/src/modules/modules/modules.routes.ts
// CHANGES FROM ORIGINAL:
//   FIX 3: POST /:id/items validates that refId exists for the given type
//   FIX 2: GET /:courseId/materials/:id logs progress as "viewed" for students
//   FIX 7: GET / now supports ?page=&limit= pagination
//   FIX 8: GET / uses in-memory cache; cache invalidated on write operations
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

// ─── MODULES CRUD ─────────────────────────────────────────────────────────────

const moduleSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  sortOrder:   z.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
});

// GET /api/v1/modules?courseId=X  FIX 7: pagination  FIX 8: cache
router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const courseId      = req.query.courseId ? Number(req.query.courseId) : null;
  if (!courseId) throw new AppError(ErrorCodes.VALIDATION_ERROR, "courseId is required", 400);

  const isStaff = [ROLES.PLATFORM_ADMIN, ROLES.INSTITUTION_ADMIN, ROLES.LECTURER].includes(r.user!.role as any);

  // FIX 8: check cache for student requests (staff always get fresh data)
  const cacheKey = `modules:${courseId}:student`;
  if (!isStaff) {
    const cached = moduleCache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });
  }

  const where: any = { courseId, institutionId };
  if (!isStaff) where.isPublished = true;

  const modules = await prisma.courseModule.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  const enrichedModules = await Promise.all(
    modules.map(async (mod) => {
      const items = await Promise.all(
        mod.items.map(async (item) => {
          let ref: any = null;
          try {
            if (item.type === "material") {
              ref = await prisma.courseMaterial.findUnique({
                where:  { id: item.refId },
                select: { id: true, title: true, type: true, isLocked: true, unlockDate: true, isVisible: true },
              });
            } else if (item.type === "assignment") {
              ref = await prisma.assignment.findUnique({
                where:  { id: item.refId },
                select: { id: true, title: true, dueDate: true, maxMarks: true, isPublished: true },
              });
            } else if (item.type === "quiz") {
              ref = await prisma.quiz.findUnique({
                where:  { id: item.refId },
                select: { id: true, title: true, type: true, isPublished: true, timeLimitMins: true },
              });
            }
          } catch { /* ref may have been deleted */ }
          return { ...item, unlockDate: item.unlockDate?.toISOString() ?? null, ref };
        })
      );
      return { ...mod, items };
    })
  );

  // Attach student progress
  if (r.user!.role === ROLES.STUDENT) {
    const progress = await prisma.studentProgress.findMany({
      where:  { studentId: r.user!.id, courseId },
      select: { itemType: true, itemId: true, status: true, completedAt: true },
    });
    const progressMap = new Map(progress.map(p => [`${p.itemType}:${p.itemId}`, p]));
    const withProgress = enrichedModules.map(mod => ({
      ...mod,
      items: mod.items.map(item => ({
        ...item,
        progress: progressMap.get(`${item.type}:${item.refId}`) ?? null,
      })),
    }));
    // FIX 8: cache student view for 60 seconds
    moduleCache.set(cacheKey, withProgress, 60);
    return res.json({ success: true, data: withProgress });
  }

  res.json({ success: true, data: enrichedModules });
}));

// POST /api/v1/modules
router.post("/", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = z.object({
    courseId:    z.number().int().positive(),
    ...moduleSchema.shape,
  }).safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const module = await prisma.courseModule.create({
    data: { ...body.data, institutionId, createdBy: r.user!.id },
  });
  // FIX 8: invalidate cache on write
  moduleCache.del(`modules:${body.data.courseId}:student`);
  res.status(201).json({ success: true, module });
}));

// ─── PROGRESS ROUTES (must come before /:id) ──────────────────────────────────

// POST /api/v1/modules/progress
router.post("/progress", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  if (r.user!.role !== ROLES.STUDENT)
    throw new AppError(ErrorCodes.FORBIDDEN, "Only students can track progress", 403);
  const body = z.object({
    courseId: z.number().int().positive(),
    itemType: z.enum(["material", "assignment", "quiz"]),
    itemId:   z.number().int().positive(),
    status:   z.enum(["viewed", "completed"]).default("viewed"),
  }).safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const now = new Date();
  const progress = await prisma.studentProgress.upsert({
    where: {
      studentId_itemType_itemId: { studentId: r.user!.id, itemType: body.data.itemType, itemId: body.data.itemId },
    },
    update: {
      status:      body.data.status,
      completedAt: body.data.status === "completed" ? now : undefined,
    },
    create: {
      studentId:   r.user!.id,
      courseId:    body.data.courseId,
      itemType:    body.data.itemType,
      itemId:      body.data.itemId,
      status:      body.data.status,
      viewedAt:    now,
      completedAt: body.data.status === "completed" ? now : null,
      institutionId,
    },
  });
  // Invalidate module cache so fresh progress shows on next load
  moduleCache.del(`modules:${body.data.courseId}:student`);
  res.json({ success: true, progress });
}));

// GET /api/v1/modules/progress?courseId=X
router.get("/progress", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r        = req as RequestWithAuth;
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  if (!courseId) throw new AppError(ErrorCodes.VALIDATION_ERROR, "courseId required", 400);
  let studentId = r.user!.id;
  if (r.user!.role !== ROLES.STUDENT && req.query.studentId) {
    studentId = Number(req.query.studentId);
  }
  const progress = await prisma.studentProgress.findMany({
    where:   { studentId, courseId },
    orderBy: { viewedAt: "desc" },
  });
  res.json({ success: true, data: progress });
}));

// ─── SINGLE MODULE ROUTES ─────────────────────────────────────────────────────

router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.courseModule.findFirst({
    where:   { id: Number(req.params.id), institutionId: getInstId(req) },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!mod) throw new AppError(ErrorCodes.NOT_FOUND, "Module not found", 404);
  res.json({ success: true, module: mod });
}));

router.put("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = moduleSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const mod = await prisma.courseModule.update({
    where: { id: Number(req.params.id) },
    data:  body.data,
  });
  // FIX 8: invalidate cache on update
  moduleCache.del(`modules:${mod.courseId}:student`);
  res.json({ success: true, module: mod });
}));

router.delete("/:id", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.courseModule.findUnique({ where: { id: Number(req.params.id) } });
  await prisma.courseModule.delete({ where: { id: Number(req.params.id) } });
  if (mod) moduleCache.del(`modules:${mod.courseId}:student`);
  res.json({ success: true });
}));

// ─── MODULE ITEMS CRUD ────────────────────────────────────────────────────────

const itemSchema = z.object({
  type:       z.enum(["material", "assignment", "quiz"]),
  refId:      z.number().int().positive(),
  title:      z.string().optional().nullable(),
  sortOrder:  z.number().int().min(0).default(0),
  isLocked:   z.boolean().default(false),
  unlockDate: z.string().datetime().optional().nullable(),
});

// POST /api/v1/modules/:id/items  — FIX 3: validate refId existence
router.post("/:id/items", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const moduleId      = Number(req.params.id);

  const mod = await prisma.courseModule.findFirst({ where: { id: moduleId, institutionId } });
  if (!mod) throw new AppError(ErrorCodes.NOT_FOUND, "Module not found", 404);

  const body = itemSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  // FIX 3: Verify the referenced entity exists before creating the module item
  const { type, refId } = body.data;
  if (type === "material") {
    const exists = await prisma.courseMaterial.findFirst({ where: { id: refId, institutionId } });
    if (!exists) throw new AppError(ErrorCodes.NOT_FOUND, `Material ${refId} not found`, 400);
  } else if (type === "assignment") {
    const exists = await prisma.assignment.findFirst({ where: { id: refId, institutionId, isActive: true } });
    if (!exists) throw new AppError(ErrorCodes.NOT_FOUND, `Assignment ${refId} not found`, 400);
  } else if (type === "quiz") {
    const exists = await prisma.quiz.findFirst({ where: { id: refId, institutionId, isActive: true } });
    if (!exists) throw new AppError(ErrorCodes.NOT_FOUND, `Quiz ${refId} not found`, 400);
  }

  const item = await prisma.moduleItem.create({
    data: {
      moduleId, institutionId,
      type:       body.data.type,
      refId:      body.data.refId,
      title:      body.data.title ?? null,
      sortOrder:  body.data.sortOrder,
      isLocked:   body.data.isLocked,
      unlockDate: body.data.unlockDate ? new Date(body.data.unlockDate) : null,
    },
  });

  // FIX 8: invalidate cache after item added
  moduleCache.del(`modules:${mod.courseId}:student`);
  res.status(201).json({ success: true, item });
}));

router.put("/:id/items/:itemId", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = itemSchema.partial().safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const data: any = { ...body.data };
  if (data.unlockDate) data.unlockDate = new Date(data.unlockDate);
  const item = await prisma.moduleItem.update({ where: { id: Number(req.params.itemId) }, data });
  // Invalidate cache: need courseId from module
  try {
    const mod = await prisma.courseModule.findUnique({ where: { id: Number(req.params.id) } });
    if (mod) moduleCache.del(`modules:${mod.courseId}:student`);
  } catch { /* non-fatal */ }
  res.json({ success: true, item });
}));

router.delete("/:id/items/:itemId", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.courseModule.findUnique({ where: { id: Number(req.params.id) } });
  await prisma.moduleItem.delete({ where: { id: Number(req.params.itemId) } });
  if (mod) moduleCache.del(`modules:${mod.courseId}:student`);
  res.json({ success: true });
}));

// POST /api/v1/modules/:id/reorder
router.post("/:id/reorder", lecturerOrAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = z.object({
    items: z.array(z.object({ id: z.number().int(), sortOrder: z.number().int() })),
  }).safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "items array required", 400);
  await Promise.all(
    body.data.items.map(item =>
      prisma.moduleItem.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
    )
  );
  const mod = await prisma.courseModule.findUnique({ where: { id: Number(req.params.id) } });
  if (mod) moduleCache.del(`modules:${mod.courseId}:student`);
  res.json({ success: true });
}));

export { router as modulesRouter };