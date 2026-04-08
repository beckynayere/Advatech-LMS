import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { asyncHandler, authRateLimiter, anyRole } from "@/common/middleware";
import { AppError, ErrorCodes } from "@/common/errors";
import type { RequestWithAuth } from "@/common/types";
import {
  register, login, refresh, logout, logoutAll,
  forgotPassword, resetPassword, verifyEmail, getMe,
} from "./auth.service";

const router: import("express").Router = Router();

const registerSchema = z.object({
  email:           z.string().email(),
  password:        z.string().min(8, "Min 8 chars").regex(/[A-Z]/, "Needs uppercase").regex(/[0-9]/, "Needs number"),
  name:            z.string().min(2).max(120),
  institutionSlug: z.string().optional(),
});
const loginSchema    = z.object({ email: z.string().email(), password: z.string().min(1) });
const refreshSchema  = z.object({ refreshToken: z.string().min(1) });
const logoutSchema   = z.object({ refreshToken: z.string().min(1) });
const forgotSchema   = z.object({ email: z.string().email() });
const resetSchema    = z.object({ token: z.string().min(1), newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/) });
const verifySchema   = z.object({ token: z.string().min(1) });

router.post("/register", authRateLimiter, asyncHandler(async (req, res) => {
  const body = registerSchema.safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const { user, tokens } = await register(body.data);
  res.status(201).json({ success: true, user, ...tokens });
}));

router.post("/login", authRateLimiter, asyncHandler(async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  const { user, tokens } = await login(body.data.email, body.data.password);
  res.json({ success: true, user, ...tokens });
}));

router.post("/refresh", asyncHandler(async (req, res) => {
  const body = refreshSchema.safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "refreshToken required", 400);
  const tokens = await refresh(body.data.refreshToken);
  res.json({ success: true, ...tokens });
}));

router.post("/logout", asyncHandler(async (req, res) => {
  const body = logoutSchema.safeParse(req.body);
  if (body.success) await logout(body.data.refreshToken);
  res.json({ success: true, message: "Logged out" });
}));

router.post("/logout-all", anyRole, asyncHandler(async (req, res) => {
  const r = req as RequestWithAuth;
  await logoutAll(r.user!.id);
  res.json({ success: true, message: "All sessions revoked" });
}));

// SEC-07: authRateLimiter already applied — rate limiting confirmed on this route
router.post("/forgot-password", authRateLimiter, asyncHandler(async (req, res) => {
  const body = forgotSchema.safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "Valid email required", 400);
  await forgotPassword(body.data.email);
  // Always 200 — never leak whether the email exists
  res.json({ success: true, message: "If that email is registered, a reset link has been sent" });
}));

router.post("/reset-password", authRateLimiter, asyncHandler(async (req, res) => {
  const body = resetSchema.safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);
  await resetPassword(body.data.token, body.data.newPassword);
  res.json({ success: true, message: "Password updated. Please log in again." });
}));

router.post("/verify-email", asyncHandler(async (req, res) => {
  const body = verifySchema.safeParse(req.body);
  if (!body.success) throw new AppError(ErrorCodes.VALIDATION_ERROR, "Token required", 400);
  await verifyEmail(body.data.token);
  res.json({ success: true, message: "Email verified. You can now log in." });
}));

router.get("/me", anyRole, asyncHandler(async (req, res) => {
  const r = req as RequestWithAuth;
  const user = await getMe(r.user!.id);
  res.json({ success: true, user });
}));

export { router as authRouter };
