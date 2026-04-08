import { Router, type Request, type Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, anyRole, adminOnly } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";

const router: import("express").Router = Router();

// ─── GET /users — list ─────────────────────────────────────────────────────────

router.get("/", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const r = req as RequestWithAuth;
  const { page, limit, skip } = parsePagination(req.query as any);
  const role   = req.query.role   as string | undefined;
  const search = req.query.search as string | undefined;

  const institutionId =
    r.user!.role === ROLES.PLATFORM_ADMIN
      ? (req.query.institutionId ? Number(req.query.institutionId) : undefined)
      : r.user!.institutionId ?? undefined;

  const where: any = { isActive: true };
  if (institutionId) where.institutionId = institutionId;
  if (search) {
    where.OR = [
      { name:  { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role) where.userRoles = { some: { role: { name: role } } };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take:     limit,
      orderBy:  { name: "asc" },
      include: {
        studentProfile:  true,
        lecturerProfile: true,
        userRoles:       { include: { role: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const data = users.map((u) => ({
    id:              u.id,
    email:           u.email,
    name:            u.name,
    phone:           u.phone,
    avatarUrl:       u.avatarUrl,
    emailVerified:   u.emailVerified,
    isActive:        u.isActive,
    lastLoginAt:     u.lastLoginAt,
    institutionId:   u.institutionId,
    createdAt:       u.createdAt,
    role:            u.userRoles[0]?.role.name ?? "student",
    roles:           u.userRoles.map((ur) => ur.role.name),
    studentProfile:  u.studentProfile,
    lecturerProfile: u.lecturerProfile,
  }));

  res.json({ success: true, ...paginate(data, total, page, limit) });
}));

// ─── GET /users/me ─────────────────────────────────────────────────────────────

router.get("/me", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r = req as RequestWithAuth;

  const user = await prisma.user.findUnique({
    where:   { id: r.user!.id },
    include: {
      userRoles:       { include: { role: true } },
      lecturerProfile: { select: { id: true, employeeId: true, specialization: true, department: true } },
      studentProfile:  { select: { id: true, registrationNo: true, yearOfStudy: true, admissionYear: true } },
    },
  });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User not found", 404);

  res.json({
    success: true,
    data: {
      id:              user.id,
      email:           user.email,
      name:            user.name,
      phone:           user.phone,
      avatarUrl:       user.avatarUrl,
      emailVerified:   user.emailVerified,
      institutionId:   user.institutionId,
      role:            r.user!.role,
      roles:           user.userRoles.map((ur) => ur.role.name),
      lecturerProfile: user.lecturerProfile,
      studentProfile:  user.studentProfile,
    },
  });
}));

// ─── GET /users/:id ────────────────────────────────────────────────────────────

router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid user id", 400);

  const isSelf  = r.user!.id === id;
  const isAdmin = ["platform_admin", "institution_admin"].includes(r.user!.role);
  if (!isSelf && !isAdmin)
    throw new AppError(ErrorCodes.FORBIDDEN, "Cannot view another user's profile", 403);

  const user = await prisma.user.findUnique({
    where:   { id },
    include: {
      userRoles:       { include: { role: true } },
      lecturerProfile: true,
      studentProfile:  true,
    },
  });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User not found", 404);

  if (r.user!.role === ROLES.INSTITUTION_ADMIN && user.institutionId !== r.user!.institutionId)
    throw new AppError(ErrorCodes.FORBIDDEN, "User belongs to a different institution", 403);

  res.json({
    success: true,
    user: {
      id:              user.id,
      email:           user.email,
      name:            user.name,
      phone:           user.phone,
      avatarUrl:       user.avatarUrl,
      emailVerified:   user.emailVerified,
      isActive:        user.isActive,
      institutionId:   user.institutionId,
      lastLoginAt:     user.lastLoginAt,
      role:            user.userRoles[0]?.role.name ?? "student",
      roles:           user.userRoles.map((ur) => ur.role.name),
      lecturerProfile: user.lecturerProfile,
      studentProfile:  user.studentProfile,
      createdAt:       user.createdAt,
    },
  });
}));

// ─── PUT /users/:id — update profile ──────────────────────────────────────────

const updateSchema = z.object({
  name:      z.string().min(2).max(120).optional(),
  phone:     z.string().max(20).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

router.put("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid user id", 400);

  const isSelf  = r.user!.id === id;
  const isAdmin = ["platform_admin", "institution_admin"].includes(r.user!.role);
  if (!isSelf && !isAdmin)
    throw new AppError(ErrorCodes.FORBIDDEN, "Cannot edit another user's profile", 403);

  const body = updateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const user = await prisma.user.update({
    where:  { id },
    data:   body.data,
    select: { id: true, email: true, name: true, phone: true, avatarUrl: true, updatedAt: true },
  });
  res.json({ success: true, user });
}));

// ─── PUT /users/:id/password ───────────────────────────────────────────────────

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

router.put("/:id/password", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const id = Number(req.params.id);
  if (r.user!.id !== id)
    throw new AppError(ErrorCodes.FORBIDDEN, "Can only change your own password", 403);

  const body = changePwSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User not found", 404);

  const valid = await bcrypt.compare(body.data.currentPassword, user.passwordHash ?? "");
  if (!valid) throw new AppError(ErrorCodes.UNAUTHORIZED, "Current password is incorrect", 401);

  const passwordHash = await bcrypt.hash(body.data.newPassword, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  res.json({ success: true, message: "Password updated" });
}));

// ─── DELETE /users/:id — soft deactivate ──────────────────────────────────────

router.delete("/:id", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid user id", 400);
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  res.json({ success: true, message: "User deactivated" });
}));

// ─── POST /users/:id/roles — assign role ──────────────────────────────────────

const roleSchema = z.object({
  role:          z.enum(["platform_admin", "institution_admin", "lecturer", "student"]),
  institutionId: z.number().int().positive().optional(),
});

router.post("/:id/roles", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const r      = req as RequestWithAuth;
  const userId = Number(req.params.id);
  if (isNaN(userId)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid user id", 400);

  const body = roleSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid role", 400, body.error.flatten() as any);

  if (r.user!.role === ROLES.INSTITUTION_ADMIN && body.data.role === ROLES.PLATFORM_ADMIN)
    throw new AppError(ErrorCodes.FORBIDDEN, "Cannot assign platform_admin role", 403);

  const role = await prisma.role.findUnique({ where: { name: body.data.role } });
  if (!role) throw new AppError(ErrorCodes.NOT_FOUND, "Role not found", 404);

  const institutionId = body.data.institutionId ?? r.user!.institutionId ?? undefined;

  await prisma.userRole.upsert({
    where:  { userId_roleId: { userId, roleId: role.id } },
    update: { institutionId: institutionId ?? null },
    create: { userId, roleId: role.id, institutionId: institutionId ?? null },
  });

  // Sync institutionId on the user record if assigning to an institution role
  if (institutionId && body.data.role !== "platform_admin") {
    await prisma.user.update({ where: { id: userId }, data: { institutionId } });
  }

  res.json({ success: true, message: `Role '${body.data.role}' assigned` });
}));

// ─── DELETE /users/:id/roles/:role ────────────────────────────────────────────

router.delete("/:id/roles/:role", adminOnly, asyncHandler(async (req: Request, res: Response) => {
  const userId   = Number(req.params.id);
  const roleName = req.params.role;

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new AppError(ErrorCodes.NOT_FOUND, "Role not found", 404);

  await prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
  res.json({ success: true, message: `Role '${roleName}' removed` });
}));

export { router as usersRouter };