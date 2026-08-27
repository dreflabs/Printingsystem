"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/types";

/**
 * Self-serve password reset. Restricted to Owner accounts by design — employees
 * must ask their Owner to reset (see /forgot-password copy).
 *
 * Email delivery is NOT wired (no mail provider). In dev the reset link is
 * written to the server console. When a provider is added, replace the
 * console.log in `deliverResetLink` with a real send.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const APP_URL = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function deliverResetLink(email: string, link: string) {
  // TODO: swap for real transactional email once a provider is configured.
  console.log(`\n[password-reset] Reset link for ${email}:\n  ${link}\n`);
}

export async function requestPasswordReset(email: string): Promise<ActionResult<null>> {
  try {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return fail("Alamat email tidak valid.");
    }

    const user = await prisma.user.findFirst({
      where: { email: normalized, active: true },
      include: { role: true },
    });

    // Only Owners may self-reset. Always return ok to avoid account enumeration.
    if (user && user.role.name === "owner") {
      const raw = crypto.randomBytes(32).toString("hex");
      const token_hash = sha256(raw);

      await prisma.$transaction([
        // Invalidate any outstanding tokens for this user.
        prisma.passwordResetToken.deleteMany({ where: { user_id: user.id, used_at: null } }),
        prisma.passwordResetToken.create({
          data: {
            user_id: user.id,
            token_hash,
            expires_at: new Date(Date.now() + TOKEN_TTL_MS),
          },
        }),
      ]);

      deliverResetLink(normalized, `${APP_URL}/reset-password?token=${raw}`);
    }

    return ok(null);
  } catch (e) {
    console.error("requestPasswordReset failed:", e);
    return fail("Gagal memproses permintaan. Coba lagi.");
  }
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ActionResult<null>> {
  try {
    if (!token?.trim()) return fail("Token tidak ada.");
    if (!newPassword || newPassword.length < 8) {
      return fail("Kata sandi baru minimal 8 karakter.");
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token_hash: sha256(token.trim()) },
    });

    if (!record || record.used_at || record.expires_at < new Date()) {
      return fail("Tautan reset tidak valid atau sudah kedaluwarsa.");
    }

    const password_hash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.user_id },
        data: {
          password_hash,
          failed_login_count: 0,
          locked_until: null,
          must_change_password: false,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used_at: new Date() },
      }),
      // Burn any other outstanding tokens for this user.
      prisma.passwordResetToken.deleteMany({
        where: { user_id: record.user_id, used_at: null },
      }),
    ]);

    return ok(null);
  } catch (e) {
    console.error("resetPassword failed:", e);
    return fail("Gagal mereset kata sandi. Coba lagi.");
  }
}
