"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mail";
import { logPlatform, headerMeta } from "@/lib/platform-audit";
import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  OTP_REQUESTS_PER_WINDOW,
  OTP_REQUEST_WINDOW_MS,
} from "@/lib/platform-otp";

const LOCKOUT_THRESHOLD = 5;

/**
 * Step 1 login Super Admin: verifikasi email + password, lalu kirim kode 6 digit
 * ke email. Step 2 (kirim email+password+kode) ditangani CredentialsProvider.
 *
 * Endpoint ini TANPA sesi (dipanggil dari halaman login publik) — jadi:
 *  - rate-limit ketat per email
 *  - password salah tetap dihitung ke lockout akun (biar tidak bisa brute-force
 *    lewat jalur ini tanpa memicu kunci)
 */
export async function requestPlatformLoginOtp(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; note?: string }> {
  const id = (email ?? "").trim().toLowerCase();
  if (!id || !password) return { ok: false, error: "Email dan kata sandi wajib diisi." };

  if (!rateLimit(`platform-otp:${id}`, OTP_REQUESTS_PER_WINDOW, OTP_REQUEST_WINDOW_MS).ok) {
    return { ok: false, error: "Terlalu banyak permintaan kode. Coba lagi dalam beberapa menit." };
  }

  const meta = await headerMeta();
  const sa = await prisma.superAdmin.findFirst({ where: { email: id } });

  // Jawaban seragam untuk email tak dikenal / password salah — plus catat.
  const genericFail = { ok: false as const, error: "Email atau kata sandi salah." };
  if (!sa) return genericFail;

  const audit = {
    actorId: sa.id,
    actorName: sa.name,
    actorSubLevel: sa.role,
    targetType: "SuperAdmin" as const,
    targetId: sa.id,
    targetLabel: sa.email,
    ip: meta.ip,
    userAgent: meta.userAgent,
  };

  if (!sa.active) {
    await logPlatform({ ...audit, action: "LOGIN_FAILED", detail: { reason: "account_inactive", step: "otp_request" } });
    return genericFail;
  }
  if (sa.locked_until && sa.locked_until > new Date()) {
    await logPlatform({ ...audit, action: "LOGIN_LOCKED", detail: { until: sa.locked_until, step: "otp_request" } });
    return { ok: false, error: "Akun terkunci sementara. Coba lagi nanti." };
  }

  const passwordOk = await bcrypt.compare(password, sa.password_hash);
  if (!passwordOk) {
    const nextCount = sa.failed_login_count + 1;
    const lockMinutes =
      nextCount >= LOCKOUT_THRESHOLD ? Math.min(60, (nextCount - LOCKOUT_THRESHOLD + 1) * 15) : 0;
    await prisma.superAdmin.update({
      where: { id: sa.id },
      data: {
        failed_login_count: nextCount,
        locked_until: lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60_000) : sa.locked_until,
      },
    });
    await logPlatform({ ...audit, action: "LOGIN_FAILED", detail: { reason: "bad_password", step: "otp_request" } });
    return genericFail;
  }

  const code = generateOtp();
  await prisma.superAdmin.update({
    where: { id: sa.id },
    data: {
      login_otp_hash: hashOtp(code),
      login_otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
      login_otp_attempts: 0,
    },
  });

  const minutes = Math.round(OTP_TTL_MS / 60000);
  const sent = await sendEmail({
    to: sa.email,
    subject: `Kode masuk Print Pilot Platform: ${code}`,
    body:
      `Kode masuk panel Super Admin Anda: ${code}\n\n` +
      `Berlaku ${minutes} menit. Jangan bagikan ke siapa pun.\n` +
      `Jika Anda tidak mencoba masuk, abaikan email ini dan ganti kata sandi.\n` +
      (meta.ip ? `\nIP peminta: ${meta.ip}` : ""),
  });

  await logPlatform({
    ...audit,
    action: "LOGIN_OTP_SENT",
    detail: { emailOk: sent.ok, error: sent.ok ? undefined : sent.error },
  });

  if (!sent.ok) {
    // Break-glass untuk self-hosting: kalau provider email belum siap, kode bisa
    // diambil dari log server dengan PLATFORM_OTP_DEBUG=1 (default mati).
    if (process.env.PLATFORM_OTP_DEBUG === "1") {
      console.warn(`[PLATFORM_OTP_DEBUG] kode untuk ${sa.email}: ${code} (email gagal: ${sent.error})`);
      return { ok: true, note: "Pengiriman email gagal — kode ditulis ke log server (mode debug)." };
    }
    return {
      ok: false,
      error: "Kode tidak bisa dikirim: layanan email belum dikonfigurasi. Hubungi admin server.",
    };
  }

  return { ok: true };
}
