export const ErrorCodes = {
  BAD_REQUEST:      "BAD_REQUEST",
  UNAUTHORIZED:     "UNAUTHORIZED",
  FORBIDDEN:        "FORBIDDEN",
  NOT_FOUND:        "NOT_FOUND",
  CONFLICT:         "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED:     "RATE_LIMITED",
  INTERNAL_ERROR:   "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
