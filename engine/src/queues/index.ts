// DESTINATION: engine/src/queues/index.ts
import { Queue, Worker, type Job } from "bullmq";
import { getRedis, hasRedis } from "@/lib/redis";
import { logger } from "@/common/logging";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { sendMail, announcementEmail } from "@/lib/email";
import { cleanupExpiredTokens } from "@/modules/auth/token.service";

// ─── Queue names ──────────────────────────────────────────────────────────────

export const QUEUE = {
  NOTIFICATIONS: "notifications",
  AUDIT:         "audit",
} as const;

// ─── Job payload types ────────────────────────────────────────────────────────

export interface NotificationJobData {
  type:         "announcement" | "grade_posted" | "assignment_due" | "payment_received" | "generic";
  userId:       number;
  institutionId?: number;
  subject:      string;
  body:         string;
  channel:      "in_app" | "email" | "both";
  email?:       string;
  courseName?:  string;
}

export interface AuditJobData {
  institutionId?: number;
  actorId?:       number;
  action:         string;
  resourceType:   string;
  resourceId?:    string;
  payload?:       Record<string, unknown>;
  ip?:            string;
}

// ─── Default job options ──────────────────────────────────────────────────────

const DEFAULT_OPTS = {
  attempts: 3,
  backoff:  { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 500 },
  removeOnFail:     { count: 200 },
};

// ─── Queue singletons ─────────────────────────────────────────────────────────

let notificationsQueue: Queue<NotificationJobData> | null = null;
let auditQueue:         Queue<AuditJobData>         | null = null;

function connection() {
  const redis = getRedis();
  if (!redis) return null;
  return { connection: redis as any };
}

export function getNotificationsQueue(): Queue<NotificationJobData> | null {
  if (!hasRedis()) return null;
  const conn = connection();
  if (!conn) return null;
  if (!notificationsQueue) {
    notificationsQueue = new Queue<NotificationJobData>(QUEUE.NOTIFICATIONS, {
      ...conn,
      defaultJobOptions: DEFAULT_OPTS,
    });
  }
  return notificationsQueue;
}

export function getAuditQueue(): Queue<AuditJobData> | null {
  if (!hasRedis()) return null;
  const conn = connection();
  if (!conn) return null;
  if (!auditQueue) {
    auditQueue = new Queue<AuditJobData>(QUEUE.AUDIT, {
      ...conn,
      defaultJobOptions: DEFAULT_OPTS,
    });
  }
  return auditQueue;
}

// ─── Enqueue helpers ──────────────────────────────────────────────────────────

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  const q = getNotificationsQueue();
  if (q) {
    await q.add("send", data);
  } else {
    await processNotification(data);
  }
}

export async function enqueueNotificationBatch(
  userIds: number[],
  base: Omit<NotificationJobData, "userId">
): Promise<void> {
  const q = getNotificationsQueue();
  if (q) {
    await q.addBulk(userIds.map((userId) => ({ name: "send", data: { ...base, userId } })));
  } else {
    await Promise.allSettled(userIds.map((userId) => processNotification({ ...base, userId })));
  }
}

export async function enqueueAuditLog(data: AuditJobData): Promise<void> {
  const q = getAuditQueue();
  if (q) {
    await q.add("log", data);
  } else {
    await processAuditLog(data);
  }
}

// ─── Processors ───────────────────────────────────────────────────────────────

async function processNotification(data: NotificationJobData): Promise<void> {
  try {
    if (data.channel === "in_app" || data.channel === "both") {
      await prisma.notification.create({
        data: {
          userId:        data.userId,
          institutionId: data.institutionId ?? null,
          channel:       "in_app",
          subject:       data.subject,
          body:          data.body,
          sentAt:        new Date(),
        },
      });
    }

    if ((data.channel === "email" || data.channel === "both") && data.email) {
      if (data.type === "announcement" && data.courseName) {
        const opts = announcementEmail(data.courseName, data.subject, data.body);
        await sendMail({ ...opts, to: data.email });
      } else {
        await sendMail({
          to:      data.email,
          subject: data.subject,
          html:    `<div>${data.body}</div>`,
          text:    data.body,
        });
      }
    }
  } catch (err) {
    logger.error({ err, userId: data.userId }, "Failed to process notification");
    throw err;
  }
}

// FIX TS2322: AuditLog.payload and AuditLog.institutionId have strict Prisma types.
// payload: Json?  — cannot accept `null` or `Record<string,unknown>` directly; cast to InputJsonValue.
// institutionId: Int? — cannot accept `null` when using relation input; use the scalar directly.
async function processAuditLog(data: AuditJobData): Promise<void> {
  await prisma.auditLog.create({
    data: {
      // FIX: institutionId is Int? scalar — pass directly, null is fine for optional scalar field
      institutionId: data.institutionId ?? null,
      actorId:       data.actorId       ?? null,
      action:        data.action,
      resourceType:  data.resourceType,
      resourceId:    data.resourceId    ?? null,
      // FIX TS2322: payload is Json? — Prisma rejects `null` and plain Record<string,unknown>.
      // Use Prisma.DbNull for explicit null, cast Record to InputJsonValue otherwise.
      payload:       data.payload !== undefined
                       ? (data.payload as Prisma.InputJsonValue)
                       : Prisma.DbNull,
      ip:            data.ip ?? null,
    },
  });
}

// ─── Cleanup: remove expired refresh tokens ────────────────────────────────────

let _cleanupInterval: NodeJS.Timeout | null = null;

function scheduleTokenCleanup(): void {
  const run = async () => {
    try {
      const deleted = await cleanupExpiredTokens();
      if (deleted > 0) logger.info({ deleted }, "Cleaned up expired refresh tokens");
    } catch (err) {
      logger.error({ err }, "Refresh token cleanup failed");
    }
  };

  // Run once 30s after startup, then every 24h
  setTimeout(run, 30_000);
  _cleanupInterval = setInterval(run, 24 * 60 * 60 * 1000);
}

// ─── Workers ──────────────────────────────────────────────────────────────────

export function startWorkers(): void {
  if (process.env.NODE_ENV !== "test") scheduleTokenCleanup();

  if (!hasRedis()) {
    logger.warn("Redis not configured — queues running inline (no background workers)");
    return;
  }

  const conn = connection();
  if (!conn) return;

  const notifWorker = new Worker<NotificationJobData>(
    QUEUE.NOTIFICATIONS,
    async (job: Job<NotificationJobData>) => { await processNotification(job.data); },
    { ...conn, concurrency: 10 }
  );

  const auditWorker = new Worker<AuditJobData>(
    QUEUE.AUDIT,
    async (job: Job<AuditJobData>) => { await processAuditLog(job.data); },
    { ...conn, concurrency: 20 }
  );

  notifWorker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err }, "Notification job failed")
  );
  auditWorker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err }, "Audit job failed")
  );
  notifWorker.on("completed", (job) =>
    logger.debug({ jobId: job.id }, "Notification job completed")
  );

  logger.info("BullMQ workers started (notifications, audit)");
}

export function stopWorkers(): void {
  if (_cleanupInterval) {
    clearInterval(_cleanupInterval);
    _cleanupInterval = null;
  }
}