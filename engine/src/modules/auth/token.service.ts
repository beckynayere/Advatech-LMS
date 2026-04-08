import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { config } from "@/config";
import { prisma } from "@/lib/db";
import type { JwtPayload } from "@/common/types";

// ─── Sign ──────────────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(userId: number): string {
  return jwt.sign(
    { sub: String(userId), type: "refresh" },
    config.JWT_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
}

// ─── Verify ────────────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { sub: string; type: string } {
  return jwt.verify(token, config.JWT_SECRET) as { sub: string; type: string };
}

// ─── Storage ───────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function storeRefreshToken(
  userId: number,
  token: string,
  expiresInDays = 7
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInDays * 86400 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
}

export async function rotateRefreshToken(
  oldToken: string,
  userId: number
): Promise<string> {
  const hash = hashToken(oldToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    // Possible token reuse — revoke ALL sessions for this user
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    throw new Error("REFRESH_TOKEN_INVALID");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data:  { revokedAt: new Date() },
  });

  const newToken = signRefreshToken(userId);
  await storeRefreshToken(userId, newToken);
  return newToken;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const hash = hashToken(token);
  await prisma.refreshToken
    .update({ where: { tokenHash: hash }, data: { revokedAt: new Date() } })
    .catch(() => {}); // ignore if not found
}

export async function revokeAllUserTokens(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

export function generateOpaqueToken(): string {
  return randomBytes(40).toString("hex");
}

// ─── Cleanup job (run daily) ────────────────────────────────────────────────────
// FIX ENG-L06: prevents refresh_tokens table from growing unboundedly

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          revokedAt: { not: null, lt: new Date(Date.now() - 7 * 86400000) },
        },
      ],
    },
  });
  return result.count;
}
