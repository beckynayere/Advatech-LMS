// DESTINATION: engine/src/app.ts
// CHANGED: Added modulesRouter import and mount

import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "@/config";
import {
  correlationIdMiddleware,
  requestLoggerMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
  authMiddleware,
  apiRateLimiter,
} from "@/common/middleware";

// ── Routers ───────────────────────────────────────────────────────────────────
import { authRouter }         from "@/modules/auth/auth.routes";
import { usersRouter }        from "@/modules/users/users.routes";
import { institutionsRouter } from "@/modules/institutions/institutions.routes";
import { schoolsRouter }      from "@/modules/schools/schools.routes";
import { cohortsRouter }      from "@/modules/cohorts/cohorts.routes";
import { coursesRouter }      from "@/modules/courses/courses.routes";
import { modulesRouter }      from "@/modules/modules/modules.routes";  // NEW
import { assignmentsRouter }  from "@/modules/assignments/assignments.routes";
import { quizzesRouter }      from "@/modules/quizzes/quizzes.routes";
import { gradesRouter }       from "@/modules/grades/grades.routes";
import { scheduleRouter }     from "@/modules/schedule/schedule.routes";
import { attendanceRouter }   from "@/modules/attendance/attendance.routes";
import { paymentsRouter }     from "@/modules/payments/payments.routes";
import { semestersRouter }    from "@/modules/semesters/semesters.routes";
import {
  notificationsRouter,
  announcementsRouter,
  auditRouter,
  analyticsRouter,
} from "@/modules/ops/ops.routes";

const app: Express = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = config.FRONTEND_URL
  ? config.FRONTEND_URL.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || config.NODE_ENV !== "production") {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Trace-Id",
      "Idempotency-Key",
    ],
    exposedHeaders: ["X-Trace-Id"],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Observability ──────────────────────────────────────────────────────────────
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

// ── Health check (public) ──────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status:    "ok",
    service:   "advatech-lms-engine",
    version:   "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ── Public auth routes ─────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRouter);

// ── M-Pesa callback (public webhook) ──────────────────────────────────────────
app.use("/api/v1/payments/callback", paymentsRouter);

// ── Global rate limiter + JWT auth for all other /api/v1 routes ───────────────
app.use("/api/v1", apiRateLimiter);
app.use("/api/v1", authMiddleware);

// ── Protected routes ───────────────────────────────────────────────────────────
app.use("/api/v1/users",         usersRouter);
app.use("/api/v1/institutions",  institutionsRouter);
app.use("/api/v1/schools",       schoolsRouter);
app.use("/api/v1/cohorts",       cohortsRouter);
app.use("/api/v1/courses",       coursesRouter);
app.use("/api/v1/modules",       modulesRouter);       // NEW — must be before /courses catches /:id
app.use("/api/v1/assignments",   assignmentsRouter);
app.use("/api/v1/quizzes",       quizzesRouter);
app.use("/api/v1/grades",        gradesRouter);
app.use("/api/v1/schedule",      scheduleRouter);
app.use("/api/v1/attendance",    attendanceRouter);
app.use("/api/v1/payments",      paymentsRouter);
app.use("/api/v1/semesters",     semestersRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/announcements", announcementsRouter);
app.use("/api/v1/audit",         auditRouter);
app.use("/api/v1/analytics",     analyticsRouter);

// ── Catch-all ──────────────────────────────────────────────────────────────────
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export default app;
