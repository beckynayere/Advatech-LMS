import pino from "pino";
import { config } from "@/config";

export const logger = pino({
  level: config.LOG_LEVEL,
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: [
    "req.headers.authorization",
    "*.password",
    "*.passwordHash",
    "*.token",
    "*.secret",
  ],
});

export const withCorrelationId = (id: string) => logger.child({ correlationId: id });
