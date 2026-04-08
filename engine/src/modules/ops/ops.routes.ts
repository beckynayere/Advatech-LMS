import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, lecturerOrAdmin, adminOnly, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";

// ══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export const notificationsRouter: import("express").Router = Router();

notificationsRouter.get(
  "/",
  anyRole,
  asyncHandler(async (req: Request, res: Response) => {
    const r = req as RequestWithAuth;
    const { page, limit, skip } = parsePagination(req.query as any);
    const unreadOnly = req.query.unread === "true";

    const where: any = { userId: r.user!.id };
    if (unreadOnly) where.readAt = null;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, channel: true, subject: true,
          body: true, sentAt: true, readAt: true, createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: r.user!.id, readAt: null } }),
    ]);

    res.json({ success: true, ...paginate(notifications, total, page, limit), unreadCount });
  })
);

// /read-all MUST be registered BEFORE /:id/read
notificationsRouter.put(
  "/read-all",
  anyRole,
  asyncHandler(async (req: Request, res: Response) => {
    const r = req as RequestWithAuth;
    const { count } = await prisma.notification.updateMany({
      where: { userId: r.user!.id, readAt: null },
      data:  { readAt: new Date() },
    });
    res.json({ success: true, updated: count });
  })
);

notificationsRouter.put(
  "/:id/read",
  anyRole,
  asyncHandler(async (req: Request, res: Response) => {
    const r = req as RequestWithAuth;
    await prisma.notification.updateMany({
      where: { id: Number(req.params.id), userId: r.user!.id },
      data:  { readAt: new Date() },
    });
    res.json({ success: true });
  })
);

// ══════════════════════════════════════════════════════════════
//  ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════════

export const announcementsRouter: import("express").Router = Router();

const announcementSchema = z.object({
  title:     z.string().min(1).max(255),
  body:      z.string().min(1),
  courseId:  z.number().int().positive().optional().nullable(),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// GET /announcements?courseId=
announcementsRouter.get(
  "/",
  anyRole,
  asyncHandler(async (req: Request, res: Response) => {
    const r = req as RequestWithAuth;
    const institutionId = r.institutionId ?? r.user!.institutionId;
    const { page, limit, skip } = parsePagination(req.query as any);
    const now = new Date();

    const where: any = {
      institutionId,
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    };

    if (req.query.courseId) {
      where.courseId = Number(req.query.courseId);
    }

    const [rawAnnouncements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishAt: "desc" },
      }),
      prisma.announcement.count({ where }),
    ]);

    // Enrich with creator names
    const creatorIds = [...new Set(rawAnnouncements.map(a => a.createdBy).filter(Boolean))];
    let creatorMap: Record<number, string> = {};

    if (creatorIds.length > 0) {
      const creators = await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true },
      });
      creatorMap = Object.fromEntries(creators.map(c => [c.id, c.name]));
    }

    const announcements = rawAnnouncements.map(a => ({
      ...a,
      createdBy: a.createdBy
        ? { id: a.createdBy, name: creatorMap[a.createdBy] ?? "" }
        : null,
    }));

    res.json({ success: true, ...paginate(announcements, total, page, limit) });
  })
);

// POST /announcements
announcementsRouter.post(
  "/",
  lecturerOrAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const r = req as RequestWithAuth;
    const institutionId = r.institutionId ?? r.user!.institutionId!;

    const body = announcementSchema.safeParse(req.body);
    if (!body.success)
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

    const announcement = await prisma.announcement.create({
      data: {
        ...body.data,
        publishAt: body.data.publishAt ? new Date(body.data.publishAt) : new Date(),
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
        institutionId,
        createdBy: r.user!.id,
      },
    });

    // Fan out in-app notifications to course students when courseId is set
    if (body.data.courseId) {
      const cohortCourses = await prisma.cohortCourse.findMany({
        where: { courseId: body.data.courseId },
        include: {
          cohort: {
            include: {
              enrollments: { where: { isActive: true }, select: { studentId: true } },
            },
          },
        },
      });

      const studentIds = [
        ...new Set(cohortCourses.flatMap((cc) => cc.cohort.enrollments.map((e) => e.studentId))),
      ];

      if (studentIds.length > 0) {
        await prisma.notification.createMany({
          data: studentIds.map((userId) => ({
            userId,
            institutionId,
            channel: "in_app",
            subject: announcement.title,
            body:    announcement.body.slice(0, 300),
            sentAt:  new Date(),
          })),
          skipDuplicates: true,
        });
      }
    }

    res.status(201).json({ success: true, announcement });
  })
);

// PUT /announcements/:id
announcementsRouter.put(
  "/:id",
  lecturerOrAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const r  = req as RequestWithAuth;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid id", 400);

    const existing = await prisma.announcement.findFirst({
      where: { id, institutionId: r.user!.institutionId ?? undefined },
    });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, "Announcement not found", 404);

    if (r.user!.role === "lecturer" && existing.createdBy !== r.user!.id)
      throw new AppError(ErrorCodes.FORBIDDEN, "You can only edit your own announcements", 403);

    const body = announcementSchema.partial().safeParse(req.body);
    if (!body.success)
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

    const data: any = { ...body.data };
    if (data.publishAt) data.publishAt = new Date(data.publishAt);
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);

    const announcement = await prisma.announcement.update({ where: { id }, data });
    res.json({ success: true, announcement });
  })
);

// DELETE /announcements/:id
announcementsRouter.delete(
  "/:id",
  lecturerOrAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const r  = req as RequestWithAuth;
    const id = Number(req.params.id);

    const existing = await prisma.announcement.findFirst({
      where: { id, institutionId: r.user!.institutionId ?? undefined },
    });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, "Announcement not found", 404);

    if (r.user!.role === "lecturer" && existing.createdBy !== r.user!.id)
      throw new AppError(ErrorCodes.FORBIDDEN, "You can only delete your own announcements", 403);

    await prisma.announcement.delete({ where: { id } });
    res.json({ success: true });
  })
);

// ══════════════════════════════════════════════════════════════
//  AUDIT LOG
// ══════════════════════════════════════════════════════════════

export const auditRouter: import("express").Router = Router();

auditRouter.get(
  "/",
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const r = req as RequestWithAuth;
    const { page, limit, skip } = parsePagination(req.query as any);

    const where: any = {};
    if (r.user!.role !== ROLES.PLATFORM_ADMIN) {
      where.institutionId = r.user!.institutionId;
    }
    if (req.query.action)
      where.action = { contains: req.query.action as string, mode: "insensitive" };
    if (req.query.actorId)       where.actorId       = Number(req.query.actorId);
    if (req.query.resourceType)  where.resourceType  = req.query.resourceType as string;
    if (req.query.from || req.query.to) {
      where.at = {};
      if (req.query.from) where.at.gte = new Date(req.query.from as string);
      if (req.query.to)   where.at.lte = new Date(req.query.to   as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { at: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, ...paginate(logs, total, page, limit) });
  })
);

export async function writeAuditLog(data: {
  institutionId?: number | null;
  actorId?:       number | null;
  action:         string;
  resourceType:   string;
  resourceId?:    string | null;
  payload?:       unknown;
  ip?:            string | null;
}): Promise<void> {
  const { institutionId, actorId, payload, ...rest } = data;
  await prisma.auditLog.create({
    data: {
      ...rest,
      ...(institutionId != null ? { institutionId } : {}),
      ...(actorId        != null ? { actorId }        : {}),
      ...(payload !== undefined
        ? { payload: payload as Prisma.InputJsonValue }
        : {}),
    },
  }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════════════

export const analyticsRouter: import("express").Router = Router();

analyticsRouter.get(
  "/overview",
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const r = req as RequestWithAuth;
    const institutionId =
      r.user!.role === ROLES.PLATFORM_ADMIN
        ? req.query.institutionId ? Number(req.query.institutionId) : undefined
        : r.user!.institutionId ?? undefined;

    const instFilter = institutionId ? { institutionId } : {};

    const [
      totalStudents,
      totalLecturers,
      totalCourses,
      activeCohorts,
      pendingSubmissions,
      activeUsersLast7Days,
    ] = await Promise.all([
      prisma.user.count({
        where: { ...instFilter, isActive: true, userRoles: { some: { role: { name: "student" } } } },
      }),
      prisma.user.count({
        where: { ...instFilter, isActive: true, userRoles: { some: { role: { name: "lecturer" } } } },
      }),
      prisma.course.count({ where: { ...instFilter, isActive: true } }),
      prisma.cohort.count({ where: { ...instFilter, isActive: true } }),
      prisma.submission.count({ where: { status: { in: ["submitted", "late"] } } }),
      prisma.user.count({
        where: { ...instFilter, lastLoginAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
    ]);

    // Additional aggregations for charts
    // enrollmentByDepartment: group students by department (via studentProfile.department)
    const enrollmentByDepartment = await prisma.$queryRaw<{ department: string; count: number }[]>`
      SELECT d.name as department, COUNT(sp.user_id) as count
      FROM "student_profiles" sp
      JOIN "departments" d ON d.name = sp.department
      WHERE sp.institution_id = ${institutionId ?? 1}
      GROUP BY d.id
      ORDER BY count DESC
      LIMIT 5
    `;

    // gradeDistribution: aggregate grades from exam grades
    const gradeDistribution = await prisma.$queryRaw<{ grade: string; count: number }[]>`
      SELECT
        CASE
          WHEN g.marks / e.max_marks >= 0.7 THEN 'A'
          WHEN g.marks / e.max_marks >= 0.6 THEN 'B'
          WHEN g.marks / e.max_marks >= 0.5 THEN 'C'
          WHEN g.marks / e.max_marks >= 0.4 THEN 'D'
          ELSE 'F'
        END as grade,
        COUNT(*) as count
      FROM grades g
      JOIN exams e ON e.id = g.exam_id
      WHERE e.institution_id = ${institutionId ?? 1}
      GROUP BY grade
      ORDER BY grade ASC
    `;

    // enrollmentTrend: count of enrollments per month for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const enrollmentTrend = await prisma.$queryRaw<{ month: string; count: number }[]>`
      SELECT
        TO_CHAR(ce.enrolled_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM cohort_enrollments ce
      WHERE ce.institution_id = ${institutionId ?? 1}
        AND ce.enrolled_at >= ${sixMonthsAgo}
      GROUP BY month
      ORDER BY month ASC
    `;

    res.json({
      success: true,
      overview: {
        totalStudents,
        totalLecturers,
        totalCourses,
        activeCohorts,
        pendingSubmissions,
        activeUsersLast7Days,
        passRate: 0, // Not yet computed
      },
      enrollmentByDepartment,
      gradeDistribution,
      enrollmentTrend,
    });
  })
);

analyticsRouter.get(
  "/course/:courseId",
  lecturerOrAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const courseId = Number(req.params.courseId);

    const [totalEnrolled, totalAssignments, totalSubmissions, gradedSubmissions] =
      await Promise.all([
        prisma.cohortEnrollment.count({
          where: { cohort: { courses: { some: { courseId } } }, isActive: true },
        }),
        prisma.assignment.count({ where: { courseId, isActive: true } }),
        prisma.submission.count({ where: { assignment: { courseId } } }),
        prisma.submission.count({ where: { assignment: { courseId }, status: "graded" } }),
      ]);

    res.json({
      success: true,
      analytics: {
        courseId,
        totalEnrolled,
        totalAssignments,
        submissionRate:
          totalAssignments > 0 && totalEnrolled > 0
            ? ((totalSubmissions / (totalAssignments * totalEnrolled)) * 100).toFixed(1) + "%"
            : "N/A",
        gradedSubmissions,
      },
    });
  })
);