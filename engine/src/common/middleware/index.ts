import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";
import { withCorrelationId, logger } from "../logging/index";
import { sendError } from "../http/index";
import { AppError, ErrorCodes, isAppError } from "../errors/index";
import type { RequestWithAuth, Role } from "../types/index";
import { verifyAccessToken } from "@/modules/auth/token.service";
import { config } from "@/config";

// ─── Correlation ID ────────────────────────────────────────────────────────────

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers["x-trace-id"];
  const traceId  = typeof existing === "string" ? existing : randomUUID();
  (req as RequestWithAuth).traceId = traceId;
  res.setHeader("x-trace-id", traceId);
  next();
}

// ─── Request logger ────────────────────────────────────────────────────────────

export function requestLoggerMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const traceId = (req as RequestWithAuth).traceId ?? randomUUID();
  withCorrelationId(traceId).info({ method: req.method, path: req.path }, "→ request");
  next();
}

// ─── Error handler ─────────────────────────────────────────────────────────────

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const traceId = (req as RequestWithAuth).traceId;
  if (!isAppError(err) || (err as AppError).statusCode >= 500) {
    logger.error({ err, traceId }, err instanceof Error ? err.message : "Unhandled error");
  }
  if (res.headersSent) return;
  sendError(res, err);
}

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(ErrorCodes.NOT_FOUND, `Not found: ${req.method} ${req.path}`, 404));
}

// ─── JWT auth ──────────────────────────────────────────────────────────────────

const PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/(login|register|forgot-password|reset-password|verify-email|refresh)$/,
  /^\/api\/v1\/payments\/callback\/(mpesa|stripe)/,
  /^\/health$/,
];

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const isPublic = PUBLIC_PATTERNS.some((p) => p.test(req.path));
  if (isPublic) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(ErrorCodes.UNAUTHORIZED, "Missing Authorization header", 401));
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    (req as RequestWithAuth).user = {
      id:            Number(payload.sub),
      email:         payload.email,
      name:          payload.name,
      role:          payload.role,
      institutionId: payload.institutionId,
    };
    (req as RequestWithAuth).institutionId = payload.institutionId ?? undefined;
    next();
  } catch {
    next(new AppError(ErrorCodes.UNAUTHORIZED, "Invalid or expired token", 401));
  }
}

// ─── RBAC ──────────────────────────────────────────────────────────────────────

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const r = req as RequestWithAuth;
    if (!r.user) {
      return next(new AppError(ErrorCodes.UNAUTHORIZED, "Authentication required", 401));
    }
    if (!roles.includes(r.user.role as Role)) {
      return next(new AppError(
        ErrorCodes.FORBIDDEN,
        `Role '${r.user.role}' cannot access this resource`,
        403
      ));
    }
    next();
  };
}

export const adminOnly        = requireRoles("platform_admin", "institution_admin");
export const platformAdminOnly= requireRoles("platform_admin");
export const lecturerOrAdmin  = requireRoles("platform_admin", "institution_admin", "lecturer");
export const anyRole          = requireRoles("platform_admin", "institution_admin", "lecturer", "student");

// ─── Rate limiters ──────────────────────────────────────────────────────────────

export const apiRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max:      config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      config.AUTH_RATE_LIMIT_MAX,
  standardHeaders:      true,
  legacyHeaders:        false,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many auth attempts. Try again in 15 minutes." } },
});

// ─── Async wrapper ─────────────────────────────────────────────────────────────

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
