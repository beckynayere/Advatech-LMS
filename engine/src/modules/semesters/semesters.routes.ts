// DESTINATION: engine/src/modules/semesters/semesters.routes.ts
// NEW FILE — Semesters CRUD
// Mount in app.ts: app.use("/api/v1/semesters", semestersRouter);

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, adminOnly, anyRole } from "@/common/middleware";
import { parsePagination, paginate, type RequestWithAuth } from "@/common/types";

export const semestersRouter: import("express").Router = Router();

// ─── The engine doesn't have a Semester model in the Prisma schema,
//     so we store semesters as Cohort records filtered by a naming convention,
//     OR we use the Course's semester/academicYear string fields.
//
//     Since there is no dedicated Semester table, we implement semesters as
//     a virtual resource backed by distinct (semester, academicYear) combos
//     from the courses table, plus custom creation stored in institution metadata.
//
//     For the frontend admin page to work we need GET (list) + POST (create).
//     We store semester records in Cohort with a special prefix "SEM::" so they
//     don't conflict with actual cohorts — OR better: we use the courses table
//     aggregation for reading and create cohorts as the backing store.
//
//     SIMPLEST CORRECT APPROACH: Use cohorts table with type="semester" flag.
//     Since the Cohort model requires coordinatorId, we use the institution admin.
//     We'll virtualize: create a special cohort with code "SEM-<year>-<sem>"
//     and name = the semester name. GET returns these records normalized as semesters.
// ─────────────────────────────────────────────────────────────────────────────

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

function normalizeSemester(cohort: any) {
  const now = new Date();
  let status: "upcoming" | "active" | "completed" = "upcoming";
  if (cohort.startDate <= now && cohort.endDate >= now) status = "active";
  else if (cohort.endDate < now) status = "completed";
  return {
    id:            cohort.id,
    name:          cohort.name,
    code:          cohort.code,
    startDate:     cohort.startDate,
    endDate:       cohort.endDate,
    status,
    academicYear:  cohort.academicYear,
    semester:      cohort.semester,
    totalStudents: cohort._count?.enrollments ?? 0,
    totalCourses:  cohort._count?.courses ?? 0,
  };
}

const semesterSchema = z.object({
  name:      z.string().min(2).max(200),
  startDate: z.string().datetime(),
  endDate:   z.string().datetime(),
  academicYear: z.string().optional().nullable(),
});

// GET /api/v1/semesters
semestersRouter.get(
  "/",
  anyRole,
  asyncHandler(async (req: Request, res: Response) => {
    const institutionId = getInstId(req);
    const { page, limit, skip } = parsePagination(req.query as any);

    // We store semesters as cohorts whose code starts with "SEM-"
    const where: any = {
      institutionId,
      code: { startsWith: "SEM-" },
    };

    const [semesters, total] = await Promise.all([
      prisma.cohort.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: "desc" },
        include: {
          _count: { select: { enrollments: true, courses: true } },
        },
      }),
      prisma.cohort.count({ where }),
    ]);

    res.json({
      success: true,
      ...paginate(semesters.map(normalizeSemester), total, page, limit),
    });
  })
);

// POST /api/v1/semesters
semestersRouter.post(
  "/",
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const r             = req as RequestWithAuth;
    const institutionId = getInstId(req);

    const body = semesterSchema.safeParse(req.body);
    if (!body.success)
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

    const start = new Date(body.data.startDate);
    const end   = new Date(body.data.endDate);
    if (end <= start)
      throw new AppError(ErrorCodes.BAD_REQUEST, "End date must be after start date", 400);

    // Derive a unique code from the name + year
    const code = "SEM-" + body.data.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);

    const existing = await prisma.cohort.findFirst({
      where: { code, institutionId },
    });
    if (existing)
      throw new AppError(ErrorCodes.CONFLICT, "A semester with this name already exists", 409);

    // Need a coordinator — use any lecturer profile, or skip with institution admin
    // We'll find the first active lecturer profile, or use a fallback
    const anyLecturer = await prisma.lecturerProfile.findFirst({
      where: { institutionId, isActive: true },
    });
    if (!anyLecturer)
      throw new AppError(
        ErrorCodes.BAD_REQUEST,
        "At least one lecturer must exist before creating semesters",
        400
      );

    const semester = await prisma.cohort.create({
      data: {
        name:         body.data.name,
        code,
        academicYear: body.data.academicYear ?? String(start.getFullYear()),
        semester:     body.data.name,
        maxStudents:  9999, // unlimited for a semester container
        startDate:    start,
        endDate:      end,
        isActive:     true,
        coordinatorId: anyLecturer.id,
        institutionId,
        createdBy:    r.user!.id,
      },
      include: {
        _count: { select: { enrollments: true, courses: true } },
      },
    });

    res.status(201).json({ success: true, semester: normalizeSemester(semester) });
  })
);

// GET /api/v1/semesters/:id
semestersRouter.get(
  "/:id",
  anyRole,
  asyncHandler(async (req: Request, res: Response) => {
    const institutionId = getInstId(req);
    const cohort = await prisma.cohort.findFirst({
      where: { id: Number(req.params.id), institutionId, code: { startsWith: "SEM-" } },
      include: { _count: { select: { enrollments: true, courses: true } } },
    });
    if (!cohort) throw new AppError(ErrorCodes.NOT_FOUND, "Semester not found", 404);
    res.json({ success: true, semester: normalizeSemester(cohort) });
  })
);

// PUT /api/v1/semesters/:id
semestersRouter.put(
  "/:id",
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const institutionId = getInstId(req);
    const existing = await prisma.cohort.findFirst({
      where: { id: Number(req.params.id), institutionId },
    });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, "Semester not found", 404);

    const body = semesterSchema.partial().safeParse(req.body);
    if (!body.success)
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

    const data: any = {};
    if (body.data.name)      data.name      = body.data.name;
    if (body.data.startDate) data.startDate = new Date(body.data.startDate);
    if (body.data.endDate)   data.endDate   = new Date(body.data.endDate);

    const updated = await prisma.cohort.update({
      where:   { id: Number(req.params.id) },
      data,
      include: { _count: { select: { enrollments: true, courses: true } } },
    });
    res.json({ success: true, semester: normalizeSemester(updated) });
  })
);

// DELETE /api/v1/semesters/:id
semestersRouter.delete(
  "/:id",
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const institutionId = getInstId(req);
    const existing = await prisma.cohort.findFirst({
      where: { id: Number(req.params.id), institutionId },
    });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, "Semester not found", 404);
    await prisma.cohort.update({
      where: { id: Number(req.params.id) },
      data:  { isActive: false },
    });
    res.json({ success: true });
  })
);