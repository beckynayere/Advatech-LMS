import type { Response } from "express";
import { isAppError, ErrorCodes } from "../errors/index";

export function sendError(res: Response, err: unknown): void {
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }
  const msg = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({
    success: false,
    error: { code: ErrorCodes.INTERNAL_ERROR, message: msg },
  });
}
