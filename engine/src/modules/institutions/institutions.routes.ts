// DESTINATION: engine/src/modules/institutions/institutions.routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, platformAdminOnly, adminOnly, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";

const router: import("express").Router = Router();

const createSchema = z.object({
  name:         z.string().min(2).max(200),
  slug:         z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase alphanumeric + hyphens only"),
  domain:       z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

const updateSchema = z.object({
  name:         z.string().min(2).max(200).optional(),
  domain:       z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  logoUrl:      z.string().url().optional().nullable(),
  smtpConfig:   z.record(z.unknown()).optional().nullable(),
  isActive:     z.boolean().optional(),
});

router.get("/", platformAdminOnly, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const search = req.query.search as string | undefined;

  const where: any = {};
  if (search) where.OR = [
    { name: { contains: search, mode: "insensitive" } },
    { slug: { contains: search, mode: "insensitive" } },
  ];

  const [institutions, total] = await Promise.all([
    prisma.institution.findMany({
      where, skip, take: limit, orderBy: { name: "asc" },
      include: { _count: { select: { users: true, courses: true, cohorts: true } } },
    }),
    prisma.institution.count({ where }),
  ]);

  res.json({ success: true, ...paginate(institutions, total, page, limit) });
}));

router.post("/", platformAdminOnly, asyncHandler(async (req: Request, res: Response) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const existing = await prisma.institution.findUnique({ where: { slug: body.data.slug } });
  if (existing) throw new AppError(ErrorCodes.CONFLICT, "Slug already taken", 409);

  const institution = await prisma.institution.create({ data: body.data });
  res.status(201).json({ success: true, institution });
}));

router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid id", 400);

  if (r.user!.role !== ROLES.PLATFORM_ADMIN && r.user!.institutionId !== id)
    throw new AppError(ErrorCodes.FORBIDDEN, "Access denied", 403);

  const inst = await prisma.institution.findUnique({
    where:   { id },
    include: {
      _count:  { select: { users: true, courses: true, cohorts: true } },
      schools: { where: { isActive: true }, orderBy: { name: "asc" } },
    },
  });
  if (!inst) throw new AppError(ErrorCodes.NOT_FOUND, "Institution not found", 404);
  res.json({ success: true, institution: inst });
}));

router.put("/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid id", 400);

  if (r.user!.role !== ROLES.PLATFORM_ADMIN && r.user!.institutionId !== id)
    throw new AppError(ErrorCodes.FORBIDDEN, "Cannot update another institution", 403);

  const body = updateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  // FIX TS2322: smtpConfig is a Prisma Json field.
  // `null` from zod is not assignable to NullableJsonNullValueInput directly —
  // must use Prisma.JsonNull sentinel for explicit null, or omit the field.
  const { smtpConfig, ...rest } = body.data;
  const data: Prisma.InstitutionUpdateInput = {
    ...rest,
    ...(smtpConfig !== undefined && {
      smtpConfig: smtpConfig === null ? Prisma.JsonNull : (smtpConfig as Prisma.InputJsonValue),
    }),
  };

  const inst = await prisma.institution.update({ where: { id }, data });
  res.json({ success: true, institution: inst });
}));

router.delete("/:id", platformAdminOnly, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid id", 400);
  await prisma.institution.update({ where: { id }, data: { isActive: false } });
  res.json({ success: true, message: "Institution deactivated" });
}));

export { router as institutionsRouter };