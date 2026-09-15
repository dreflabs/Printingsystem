"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/types";
import { validateTenantPassword } from "@/lib/password-policy";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Self-serve password reset. Restricted to Owner accounts by design — employees
 * must ask their Owner to reset (see /forgot-password copy).
 *
 * Email delivery is NOT wired (no mail provider). In dev the reset link is
 * written to the server console. When a provider is added, replace the
 * console.log in `deliverResetLink` with a real send.
 */

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 menit, sesuai kebijakan reset tenant
const APP_URL = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function deliverResetLink(email: string, link: string) {
  // Belum ada provider email. Di dev, tautan ditulis ke konsol server; di produksi
  // JANGAN bocorkan ke log — kirim lewat provider transaksional saat sudah ada.
  if (process.env.NODE_ENV === "production") {
    console.error(`[password-reset] Provider email belum dikonfigurasi — reset untuk ${email} tidak terkirim.`);
    return;
  }
  console.log(`\n[password-reset] Reset link for ${email}:\n  ${link}\n`);
}

export async function requestPasswordReset(
  email: string,
  workspace: string
): Promise<ActionResult<null>> {
  try {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return fail("Alamat email tidak valid.");
    }

    // Email hanya unik PER TENANT (@@unique([tenant_id, email])), jadi alamat yang
    // sama boleh dipakai Owner di dua percetakan berbeda. Tanpa menyebut workspace,
    // `findFirst` bisa menerbitkan token untuk akun percetakan LAIN: pemintanya tak
    // pernah bisa masuk ke workspace-nya sendiri, sementara akun orang lain yang
    // kata sandinya berubah.
    const slug = workspace?.trim().toLowerCase();
    if (!slug || !/^[a-z0-9]{3,30}$/.test(slug)) {
      return fail("Workspace tidak valid.", { workspace: "Isi subdomain workspace Anda." });
    }
    const resetLimit = rateLimit(`password-reset:${normalized}:${slug}`, 5, 60 * 60_000);
    if (!resetLimit.ok) return fail("Terlalu banyak permintaan reset. Coba lagi nanti.");

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    // Workspace tidak ada → tetap balas ok di bawah, jangan bocorkan mana yang terdaftar.
    const user = tenant
      ? await prisma.user.findFirst({
          where: { tenant_id: tenant.id, email: normalized, active: true },
          include: { role: true },
        })
      : null;

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
    const passwordError = validateTenantPassword(newPassword ?? "");
    if (passwordError) return fail(passwordError);

    const record = await prisma.passwordResetToken.findUnique({
      where: { token_hash: sha256(token.trim()) },
    });

    if (!record || record.used_at || record.expires_at < new Date()) {
      return fail("Tautan reset tidak valid atau sudah kedaluwarsa.");
    }

    const password_hash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(async (tx) => {
      // Conditional update menjadikan token benar-benar single-use ketika dua
      // request reset yang sama tiba bersamaan.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, used_at: null, expires_at: { gt: new Date() } },
        data: { used_at: new Date() },
      });
      if (claimed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");

      await tx.user.update({
        where: { id: record.user_id },
        data: {
          password_hash,
          password_changed_at: new Date(),
          failed_login_count: 0,
          locked_until: null,
          must_change_password: false,
        },
      }),
      // Burn any other outstanding tokens for this user.
      await tx.passwordResetToken.deleteMany({
        where: { user_id: record.user_id, used_at: null },
      });
    });

    return ok(null);
  } catch (e) {
    console.error("resetPassword failed:", e);
    return fail("Gagal mereset kata sandi. Coba lagi.");
  }
}
