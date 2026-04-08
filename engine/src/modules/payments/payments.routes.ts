// DESTINATION: engine/src/modules/payments/payments.routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes } from "@/common/errors";
import { asyncHandler, anyRole } from "@/common/middleware";
import { parsePagination, paginate, ROLES, type RequestWithAuth } from "@/common/types";
import { config } from "@/config";
import { logger } from "@/common/logging";

const router: import("express").Router = Router();

function getInstId(req: Request): number {
  const r = req as RequestWithAuth;
  return r.institutionId ?? r.user!.institutionId!;
}

// ── SEC-03: Safaricom IP allowlist ────────────────────────────────────────────
const SAFARICOM_IPS = [
  "196.201.214.200", "196.201.214.206", "196.201.214.207",
  "196.201.214.208", "196.201.214.209", "196.201.214.210",
  "196.201.214.211", "196.201.214.212", "196.201.214.213",
  "196.201.214.214", "196.201.214.215", "196.201.214.216",
  "185.12.29.0",     "185.12.29.1",     "185.12.29.2",
  "127.0.0.1", "::1", "::ffff:127.0.0.1",
];

function isAllowedSafaricomIp(req: Request): boolean {
  if (config.MPESA_ENV !== "production") return true;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : (req.ip ?? "");
  return SAFARICOM_IPS.some((allowed) => ip.startsWith(allowed));
}

// ── M-Pesa helpers ─────────────────────────────────────────────────────────────

async function getMpesaAccessToken(): Promise<string> {
  const { MPESA_CONSUMER_KEY: key, MPESA_CONSUMER_SECRET: secret, MPESA_ENV: env } = config;
  if (!key || !secret) throw new AppError(ErrorCodes.INTERNAL_ERROR, "M-Pesa not configured", 500);
  const base = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64") },
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new AppError(ErrorCodes.INTERNAL_ERROR, "Failed to get M-Pesa token", 500);
  return data.access_token;
}

function getMpesaPassword(shortcode: string, passkey: string): { password: string; timestamp: string } {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return { password: Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64"), timestamp };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

const initiateSchema = z.object({
  amount:   z.number().positive(),
  currency: z.string().length(3).default("KES"),
  phone:    z.string().min(9).max(15).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// FIX TS: `res.json(...)` inside asyncHandler → res.json(); return;
// FIX TS2322: metadata is Json — cast Record<string,unknown> to Prisma.InputJsonValue
router.post("/initiate", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const institutionId = getInstId(req);
  const body = initiateSchema.safeParse(req.body);
  if (!body.success)
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid input", 400, body.error.flatten() as any);

  const tx = await prisma.paymentTransaction.create({
    data: {
      userId: r.user!.id, institutionId,
      amount: new Decimal(body.data.amount),
      currency: body.data.currency,
      status: "pending", provider: "mpesa",
      // FIX: cast to Prisma.InputJsonValue — Prisma rejects plain Record<string,unknown>
      metadata: body.data.metadata !== undefined
        ? (body.data.metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });

  if (body.data.phone && config.MPESA_CONSUMER_KEY && config.MPESA_SHORTCODE && config.MPESA_PASSKEY) {
    try {
      const token = await getMpesaAccessToken();
      const { password, timestamp } = getMpesaPassword(config.MPESA_SHORTCODE, config.MPESA_PASSKEY);
      const base  = config.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
      const phone = body.data.phone.replace(/^(\+?254|0)/, "254");

      const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: config.MPESA_SHORTCODE, Password: password, Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline", Amount: Math.ceil(body.data.amount),
          PartyA: phone, PartyB: config.MPESA_SHORTCODE, PhoneNumber: phone,
          CallBackURL: config.MPESA_CALLBACK_URL ?? `${config.FRONTEND_URL}/api/v1/payments/callback/mpesa`,
          AccountReference: `TXN-${tx.id}`,
          TransactionDesc: `AdvaTech Payment #${tx.id}`,
        }),
      });
      const stkData = await stkRes.json() as any;
      if (stkData.ResponseCode === "0") {
        await prisma.paymentTransaction.update({ where: { id: tx.id }, data: { externalId: stkData.CheckoutRequestID } });
        // FIX TS: was `res.json(...)` — split to res.json(); return;
        res.status(201).json({
          success: true,
          transaction: { ...tx, externalId: stkData.CheckoutRequestID },
          mpesa: { checkoutRequestId: stkData.CheckoutRequestID, message: stkData.CustomerMessage },
        });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "M-Pesa STK push failed — returning pending transaction");
    }
  }

  res.status(201).json({ success: true, transaction: tx, message: "Payment initiated" });
}));

router.get("/", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r             = req as RequestWithAuth;
  const { page, limit, skip } = parsePagination(req.query as any);
  const institutionId = getInstId(req);
  const isAdmin       = ["platform_admin", "institution_admin"].includes(r.user!.role);
  const where: any    = isAdmin ? { institutionId } : { userId: r.user!.id };
  if (req.query.status) where.status = req.query.status as string;
  if (req.query.studentId && isAdmin) where.userId = Number(req.query.studentId);

  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: isAdmin ? { user: { select: { id: true, name: true, email: true } } } : undefined,
    }),
    prisma.paymentTransaction.count({ where }),
  ]);
  res.json({ success: true, ...paginate(transactions, total, page, limit) });
}));

router.get("/:id", anyRole, asyncHandler(async (req: Request, res: Response) => {
  const r  = req as RequestWithAuth;
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: Number(req.params.id) } });
  if (!tx) throw new AppError(ErrorCodes.NOT_FOUND, "Transaction not found", 404);
  const isAdmin = ["platform_admin", "institution_admin"].includes(r.user!.role);
  if (!isAdmin && tx.userId !== r.user!.id)
    throw new AppError(ErrorCodes.FORBIDDEN, "Access denied", 403);
  res.json({ success: true, transaction: tx });
}));

// ── POST /callback/mpesa ───────────────────────────────────────────────────────
// FIX TS: `res.json(...)` → res.json(); return;
router.post("/callback/mpesa", asyncHandler(async (req: Request, res: Response) => {
  if (!isAllowedSafaricomIp(req)) {
    logger.warn({ ip: req.ip, path: req.path }, "M-Pesa callback rejected: IP not in Safaricom allowlist");
    res.status(403).json({ ResultCode: 1, ResultDesc: "Forbidden" });
    return;
  }

  const body        = req.body;
  const stkCallback = body?.Body?.stkCallback;
  if (!stkCallback) {
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  const checkoutRequestId: string = stkCallback.CheckoutRequestID;
  const resultCode: number        = stkCallback.ResultCode;

  const tx = await prisma.paymentTransaction.findFirst({ where: { externalId: checkoutRequestId } });
  if (!tx) {
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  // Idempotency guard
  if (tx.callbackReceivedAt) {
    logger.info({ txId: tx.id, checkoutRequestId }, "M-Pesa callback: duplicate, already processed");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  const status = resultCode === 0 ? "completed" : "failed";

  let mpesaReceiptNumber: string | null = null;
  const items: any[] = stkCallback.CallbackMetadata?.Item ?? [];
  for (const item of items) {
    if (item.Name === "MpesaReceiptNumber") mpesaReceiptNumber = item.Value;
  }

  const idempotencyKey = createHash("sha256")
    .update(`mpesa:${checkoutRequestId}:${resultCode}`)
    .digest("hex");

  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data:  {
      status, idempotencyKey, callbackReceivedAt: new Date(),
      ...(mpesaReceiptNumber && { externalId: mpesaReceiptNumber }),
    },
  });

  await prisma.auditLog.create({
    data: {
      institutionId: tx.institutionId,
      action:        "payment.callback.mpesa",
      resourceType:  "PaymentTransaction",
      resourceId:    String(tx.id),
      // FIX: cast to Prisma.InputJsonValue
      payload:       { resultCode, checkoutRequestId, status } as Prisma.InputJsonValue,
      ip:            req.ip ?? null,
    },
  });

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
}));

export { router as paymentsRouter };