import IORedis from "ioredis";
import { config } from "@/config";
import { logger } from "@/common/logging";

let _redis: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (!config.REDIS_URL) return null;
  if (!_redis) {
    _redis = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    _redis.on("error", (err) => logger.error({ err }, "Redis connection error"));
    _redis.on("connect", () => logger.info("Redis connected"));
  }
  return _redis;
}

export function hasRedis(): boolean {
  return !!config.REDIS_URL;
}
