"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/types";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mail";

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/**
 * Consume a signup verification link exactly once. The conditional update is
 * intentionally inside the same transaction as the user update so two browser
 * tabs cannot both activate or reuse one token.
 */
export async function verifyRegistrationEmail(
  rawToken: string
): Promise<ActionResult<{ slug: string }>> {
  try {
    const token = rawToken?.trim();
    if (!token || token.length < 32) return fail("Tautan verifikasi tidak valid.");

    const record = await prisma.emailVerificationToken.findUnique({
      where: { token_hash: sha256(token) },
      include: { user: { include: { tenant: { select: { slug: true } } } } },
    });
    if (!record || record.used_at || record.expires_at <= new Date() || !record.user.active) {
      return fail("Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
    }

    const now = new Date();
    const slug = record.user.tenant.slug;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, used_at: null, expires_at: { gt: now } },
        data: { used_at: now },
      });
      if (claimed.count !== 1) throw new Error("EMAIL_VERIFICATION_TOKEN_ALREADY_USED");

      await tx.user.update({
        where: { id: record.user_id },
        data: { email_verified_at: now },
      });
      await tx.emailVerificationToken.deleteMany({
        where: { user_id: record.user_id, id: { not: record.id }, used_at: null },
      });
    });

    return ok({ slug });
  } catch (error) {
    console.error("verifyRegistrationEmail failed:", error);
    return fail("Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
  }
}

/** Reissue a pending verification link without revealing whether an account exists. */
export async function resendRegistrationVerification(
  email: string,
  workspace: string,
): Promise<ActionResult<null>> {
  const normalized = email?.trim().toLowerCase();
  const slug = workspace?.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !/^[a-z0-9]{3,30}$/.test(slug)) {
    return fail("Email atau workspace tidak valid.");
  }
  const limit = rateLimit(`email-verification:${normalized}:${slug}`, 3, 60 * 60_000);
  if (!limit.ok) return fail("Terlalu banyak permintaan. Coba lagi nanti.");

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    const user = tenant
      ? await prisma.user.findFirst({ where: { tenant_id: tenant.id, email: normalized, active: true, email_verified_at: null }, include: { role: true } })
      : null;
    if (user?.role.name === "owner") {
      const raw = crypto.randomBytes(32).toString("hex");
      const hash = sha256(raw);
      await prisma.$transaction(async (tx) => {
        await tx.emailVerificationToken.deleteMany({ where: { user_id: user.id, used_at: null } });
        await tx.emailVerificationToken.create({ data: { user_id: user.id, token_hash: hash, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      });
      const link = `${process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/verify-email?token=${raw}`;
      const mailed = await sendEmail({ to: normalized, subject: "Tautan verifikasi email Print Pilot", body: `Gunakan tautan berikut (berlaku 24 jam):\n\n${link}` });
      if (!mailed.ok) return fail("Email verifikasi belum dapat dikirim. Coba lagi nanti.");
    }
    return ok(null);
  } catch (error) {
    console.error("resendRegistrationVerification failed:", error);
    return ok(null);
  }
}
