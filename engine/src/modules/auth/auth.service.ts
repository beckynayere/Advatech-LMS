import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { sendMail, passwordResetEmail, emailVerificationEmail } from "@/lib/email";
import { config } from "@/config";
import {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  generateOpaqueToken,
  verifyRefreshToken,
} from "./token.service";

const BCRYPT_ROUNDS       = 12;
const RESET_EXPIRES_HOURS = 1;
const VERIFY_EXPIRES_HOURS = 24;

export interface AuthUser {
  id:            number;
  email:         string;
  name:          string;
  role:          string;
  institutionId: number | null;
  emailVerified: boolean;
}

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getPrimaryRole(userId: number): Promise<string> {
  const ur = await prisma.userRole.findFirst({
    where:   { userId },
    include: { role: true },
    orderBy: { role: { id: "asc" } }, // lowest id = highest privilege
  });
  return ur?.role.name ?? "student";
}

function buildUser(
  u: { id: number; email: string | null; name: string; institutionId: number | null; emailVerified: boolean },
  role: string
): AuthUser {
  return { id: u.id, email: u.email ?? "", name: u.name, role, institutionId: u.institutionId, emailVerified: u.emailVerified };
}

function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Register ──────────────────────────────────────────────────────────────────

export async function register(data: {
  email: string;
  password: string;
  name: string;
  institutionSlug?: string;
}): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(ErrorCodes.CONFLICT, "An account with this email already exists", 409);

  let institutionId: number | null = null;
  if (data.institutionSlug) {
    const inst = await prisma.institution.findUnique({ where: { slug: data.institutionSlug } });
    if (!inst || !inst.isActive)
      throw new AppError(ErrorCodes.NOT_FOUND, "Institution not found or inactive", 404);
    institutionId = inst.id;
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const studentRole  = await prisma.role.findUnique({ where: { name: "student" } });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: data.name.trim(),
      institutionId,
      ...(studentRole && {
        userRoles: { create: { roleId: studentRole.id, institutionId } },
      }),
    },
  });

  // FIX SEC-05: store token with type="email_verification"
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFY_EXPIRES_HOURS * 3600 * 1000);
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash, expiresAt, type: "email_verification" },
  });

  const verifyUrl = `${config.FRONTEND_URL}/auth/verify-email?token=${rawToken}`;
  await sendMail({ ...emailVerificationEmail(user.name, verifyUrl), to: email });

  const role = "student";
  const accessToken  = signAccessToken({ sub: String(user.id), email, name: user.name, role, institutionId });
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { user: buildUser(user, role), tokens: { accessToken, refreshToken } };
}

// ─── Login ─────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const normalised = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalised } });
  // Deliberately vague error — don't leak whether the email exists
  if (!user || !user.isActive)
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid email or password", 401);

  const valid = await bcrypt.compare(password, user.passwordHash ?? "");
  if (!valid)
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid email or password", 401);

  // FIX SEC-06: block unverified emails
  // Exception: seeded / admin-created accounts have emailVerified=true at creation
  if (!user.emailVerified) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "Please verify your email address before logging in. Check your inbox for a verification link.",
      403
    );
  }

  const role = await getPrimaryRole(user.id);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken  = signAccessToken({
    sub: String(user.id), email: user.email ?? normalised,
    name: user.name, role, institutionId: user.institutionId,
  });
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { user: buildUser(user, role), tokens: { accessToken, refreshToken } };
}

// ─── Refresh ───────────────────────────────────────────────────────────────────

export async function refresh(oldRefreshToken: string): Promise<TokenPair> {
  let payload: { sub: string; type: string };
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid or expired refresh token", 401);
  }

  if (payload.type !== "refresh")
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid token type", 401);

  const userId = Number(payload.sub);

  let newRefreshToken: string;
  try {
    newRefreshToken = await rotateRefreshToken(oldRefreshToken, userId);
  } catch {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Refresh token revoked or reused", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive)
    throw new AppError(ErrorCodes.UNAUTHORIZED, "User not found or inactive", 401);

  const role = await getPrimaryRole(userId);
  const accessToken = signAccessToken({
    sub: String(user.id), email: user.email ?? "",
    name: user.name, role, institutionId: user.institutionId,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

// ─── Logout ────────────────────────────────────────────────────────────────────

export async function logout(refreshToken: string): Promise<void> {
  await revokeRefreshToken(refreshToken);
}

export async function logoutAll(userId: number): Promise<void> {
  await revokeAllUserTokens(userId);
}

// ─── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  const normalised = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalised } });
  if (!user) return; // Always 200 — don't leak email existence

  // Invalidate any existing unused tokens
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data:  { usedAt: new Date() },
  });

  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_EXPIRES_HOURS * 3600 * 1000);

  // FIX SEC-05: explicit type="password_reset"
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash, expiresAt, type: "password_reset" },
  });

  const resetUrl = `${config.FRONTEND_URL}/auth/reset-password?token=${rawToken}`;
  await sendMail({ ...passwordResetEmail(user.name, resetUrl), to: normalised });
}

// ─── Reset password ────────────────────────────────────────────────────────────

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);

  const record = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date())
    throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid or expired reset token", 400);

  // FIX SEC-05: verify token is a password_reset token, not email_verification
  if (record.type !== "password_reset")
    throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid token type", 400);

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await revokeAllUserTokens(record.userId);
}

// ─── Verify email ──────────────────────────────────────────────────────────────

export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);

  const record = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date())
    throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid or expired verification token", 400);

  // FIX SEC-05: verify this is an email_verification token
  if (record.type !== "email_verification")
    throw new AppError(ErrorCodes.BAD_REQUEST, "Invalid token type", 400);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

// ─── Get /me ───────────────────────────────────────────────────────────────────

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: {
      userRoles:       { include: { role: true } },
      lecturerProfile: { select: { id: true, employeeId: true, specialization: true, department: true } },
      studentProfile:  { select: { id: true, registrationNo: true, yearOfStudy: true, admissionYear: true } },
    },
  });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User not found", 404);

  const roles = user.userRoles.map((ur) => ur.role.name);
  const role  = roles[0] ?? "student";

  return {
    id:              user.id,
    email:           user.email ?? "",
    name:            user.name,
    role,
    roles,
    institutionId:   user.institutionId,
    emailVerified:   user.emailVerified,
    phone:           user.phone,
    avatarUrl:       user.avatarUrl,
    lastLoginAt:     user.lastLoginAt,
    lecturerProfile: user.lecturerProfile,
    studentProfile:  user.studentProfile,
  };
}
