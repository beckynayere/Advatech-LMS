import http from "http";
import app from "./app";
import { config } from "@/config";
import { logger } from "@/common/logging";
import { startWorkers, stopWorkers } from "@/queues";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { moduleCache } from "@/lib/cache";

const server = http.createServer(app);

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Verify DB before accepting traffic
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Database connection verified");
  } catch (err) {
    logger.fatal({ err }, "Cannot connect to database — aborting");
    process.exit(1);
  }

  // ✅ START CACHE CLEANUP (Fix 8)
  moduleCache.startCleanup();
  logger.info("Module cache cleanup started");

  startWorkers();

  server.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV, redis: !!getRedis() },
      "AdvaTech LMS Engine started"
    );
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully...");
  stopWorkers();

  server.close(async () => {
    logger.info("HTTP server closed");
    try {
      await prisma.$disconnect();
      logger.info("Database disconnected");
    } catch (err) {
      logger.error({ err }, "Error disconnecting database");
    }
    const redis = getRedis();
    if (redis) {
      try { await redis.quit(); logger.info("Redis disconnected"); } catch { /* ignore */ }
    }
    logger.info("Shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Graceful shutdown timeout — forcing exit");
    process.exit(1);
  }, 15_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — exiting");
  process.exit(1);
});

start();
