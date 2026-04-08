import nodemailer, { type Transporter } from "nodemailer";
import { config } from "@/config";
import { logger } from "@/common/logging";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!_transporter) {
    if (config.SMTP_HOST && config.SMTP_USER) {
      _transporter = nodemailer.createTransport({
        host:   config.SMTP_HOST,
        port:   config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth:   { user: config.SMTP_USER, pass: config.SMTP_PASS },
      });
    } else {
      _transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }
  return _transporter;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  try {
    const info = await getTransporter().sendMail({ from: config.SMTP_FROM, ...opts });
    if (config.NODE_ENV === "development") {
      logger.info({ preview: (info as any).message }, "📧 [DEV] Email logged");
    }
  } catch (err) {
    logger.error({ err, to: opts.to, subject: opts.subject }, "Failed to send email");
    // Never crash a request due to email failure
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────────

export function passwordResetEmail(name: string, resetUrl: string): MailOptions {
  return {
    subject: "Reset your AdvaTech password",
    to: "",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2>Hi ${name},</h2>
        <p>You requested a password reset. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Reset Password</a></p>
        <p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#888;font-size:11px">AdvaTech LMS</p>
      </div>`,
    text: `Hi ${name},\nReset your password: ${resetUrl}\nExpires in 1 hour.`,
  };
}

export function emailVerificationEmail(name: string, verifyUrl: string): MailOptions {
  return {
    subject: "Verify your AdvaTech account",
    to: "",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2>Welcome to AdvaTech, ${name}!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Verify Email</a></p>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#888;font-size:11px">AdvaTech LMS</p>
      </div>`,
    text: `Welcome ${name}! Verify your email: ${verifyUrl}`,
  };
}

export function announcementEmail(courseName: string, title: string, body: string): MailOptions {
  return {
    subject: `[${courseName}] ${title}`,
    to: "",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h3>${title}</h3>
        <div>${body}</div>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#888;font-size:11px">AdvaTech LMS — ${courseName}</p>
      </div>`,
    text: `${title}\n\n${body}`,
  };
}
