import { z } from "zod";
import { config as loadEnv } from "dotenv";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT:     z.coerce.number().default(12345),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL:    z.string().url().optional().or(z.literal("")),

  JWT_SECRET:             z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN:  z.string().default("24h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("noreply@advatech.ac.ke"),

  AWS_ACCESS_KEY_ID:     z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION:            z.string().default("eu-west-1"),
  S3_BUCKET:             z.string().optional(),
  S3_URL_EXPIRES_SEC:    z.coerce.number().default(3600),

  DEFAULT_INSTITUTION_ID: z.coerce.number().default(1),
  FRONTEND_URL:           z.string().default("http://localhost:3000"),

  RATE_LIMIT_WINDOW_MS:  z.coerce.number().default(900000),
  RATE_LIMIT_MAX:        z.coerce.number().default(200),
  AUTH_RATE_LIMIT_MAX:   z.coerce.number().default(20),

  MPESA_CONSUMER_KEY:    z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE:       z.string().optional(),
  MPESA_PASSKEY:         z.string().optional(),
  MPESA_CALLBACK_URL:    z.string().optional(),
  MPESA_ENV:             z.enum(["sandbox", "production"]).default("sandbox"),

  ZOOM_ACCOUNT_ID:    z.string().optional(),
  ZOOM_CLIENT_ID:     z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const msg = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment configuration:\n${JSON.stringify(msg, null, 2)}`);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
