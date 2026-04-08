import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, adminOnly, anyRole } from "@/common/middleware";
import { type RequestWithAuth } from "@/common/types";

const router: import("express").Router = Router();

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

// ══════════════════════════════════════════════════════════════
//  SCHOOLS
//  FIX ENG-R02: router is mounted at /api/v1/schools
//  All routes use "/" and "/:id" — NOT "/schools" and "/schools/:id"
// ══════════════════════════════════════════════════════════════

const schoolCreateSchema = z.object({
  name:        z.string().min(2).max(200),
  code:        z.string().min(1).max(20).toUpperCase(),
  description: z.string().optional().nullable(),
  type:        z.enum(["school", "faculty", "college"]).default("school"),
  deanId:      z.number().int().positive().optional().nullable(),
});
const schoolUpdateSchema = schoolCreateSchema.partial();

// GET /api/v1/schools
router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const schools = await prisma.school.findMany({
    where:   { institutionId, isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { departments: true, courses: true } },
      dean:   { select: { id: true, name: true, email: true } },
    },
  });
  res.json({ success: true, data: schools });
}));

// POST /api/v1/schools
router.post("/", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const body = schoolCreateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  // FIX ENG-L01: scope unique check to institution, not global
  const exists = await prisma.school.findFirst({ where: { code: body.data.code, institutionId } });
  if (exists) throw new AppError(ErrorCodes.CONFLICT, "School code already exists for this institution", 409);

  const school = await prisma.school.create({ data: { ...body.data, institutionId } });
  res.status(201).json({ success: true, school });
}));

// GET /api/v1/schools/:id
router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const school = await prisma.school.findFirst({
    where:   { id, institutionId: getInstId(req) },
    include: {
      departments: { where: { isActive: true }, orderBy: { name: "asc" } },
      dean:        { select: { id: true, name: true, email: true } },
      _count:      { select: { courses: true } },
    },
  });
  if (!school) throw new AppError(ErrorCodes.NOT_FOUND, "School not found", 404);
  res.json({ success: true, school });
}));

// PUT /api/v1/schools/:id
router.put("/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const id   = Number(req.params.id);
  const body = schoolUpdateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const school = await prisma.school.update({ where: { id }, data: body.data });
  res.json({ success: true, school });
}));

// DELETE /api/v1/schools/:id — soft delete
router.delete("/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  await prisma.school.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ success: true });
}));

// ══════════════════════════════════════════════════════════════
//  DEPARTMENTS — mounted at /api/v1/schools/departments
// ══════════════════════════════════════════════════════════════

const deptCreateSchema = z.object({
  name:        z.string().min(2).max(200),
  code:        z.string().min(1).max(20).toUpperCase(),
  description: z.string().optional().nullable(),
  schoolId:    z.number().int().positive(),
  headId:      z.number().int().positive().optional().nullable(),
});
const deptUpdateSchema = deptCreateSchema.partial();

router.get("/departments", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const schoolId      = req.query.schoolId ? Number(req.query.schoolId) : undefined;
  const departments   = await prisma.department.findMany({
    where:   { institutionId, isActive: true, ...(schoolId && { schoolId }) },
    orderBy: { name: "asc" },
    include: {
      head:   { select: { id: true, name: true } },
      school: { select: { id: true, name: true, code: true } },
      _count: { select: { courses: true } },
    },
  });
  res.json({ success: true, data: departments });
}));

router.post("/departments", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const institutionId = getInstId(req);
  const body = deptCreateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  // FIX ENG-L01: scope to institution
  const exists = await prisma.department.findFirst({ where: { code: body.data.code, institutionId } });
  if (exists) throw new AppError(ErrorCodes.CONFLICT, "Department code already exists for this institution", 409);

  const dept = await prisma.department.create({ data: { ...body.data, institutionId } });
  res.status(201).json({ success: true, department: dept });
}));

router.put("/departments/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const body = deptUpdateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const dept = await prisma.department.update({ where: { id: Number(req.params.id) }, data: body.data });
  res.json({ success: true, department: dept });
}));

router.delete("/departments/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  await prisma.department.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ success: true });
}));

export { router as schoolsRouter };
