"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireSuperAdmin,
  requireSubLevel,
  type SuperAdminSubLevel,
  type PlatformActor,
} from "@/lib/platform";
import { logPlatform, headerMeta, type PlatformAuditAction } from "@/lib/platform-audit";
import { validateSuperAdminPassword } from "@/lib/super-admin-password";
import {
  generateTotpSecret,
  verifyTotp,
  totpUri,
  generateBackupCodes,
} from "@/lib/totp";
import { ok, fail } from "@/types";

const BCRYPT_ROUNDS = 12;
const SUB_LEVELS: SuperAdminSubLevel[] = ["SUPER_ADMIN", "SUPPORT", "FINANCE"];
const BACKUP_CODE_COUNT = 10;

async function log(
  actor: PlatformActor,
  action: PlatformAuditAction,
  target: { id?: string; label?: string | null },
  detail?: unknown
) {
  const meta = await headerMeta();
  await logPlatform({
    actorId: actor.id,
    actorName: actor.name,
    actorSubLevel: actor.subLevel,
    action,
    targetType: "SuperAdmin",
    targetId: target.id ?? null,
    targetLabel: target.label ?? null,
    detail,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/** Berapa akun SUPER_ADMIN aktif yang tersisa (untuk cegah mengunci diri sendiri keluar). */
async function activeSuperAdminCount(): Promise<number> {
  return prisma.superAdmin.count({ where: { active: true, role: "SUPER_ADMIN" } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Daftar & kelola akun
// ─────────────────────────────────────────────────────────────────────────────

/** Daftar akun Super Admin + info aktor saat ini (untuk menyembunyikan aksi tak berhak di UI). */
export async function listSuperAdmins() {
  try {
    const me = await requireSuperAdmin();
    const admins = await prisma.superAdmin.findMany({ orderBy: { created_at: "asc" } });
    const now = new Date();
    return ok({
      me: { id: me.id, subLevel: me.subLevel },
      admins: admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        subLevel: a.role,
        active: a.active,
        mfaEnabled: a.totp_enabled,
        locked: !!(a.locked_until && a.locked_until > now),
        lastLoginAt: a.last_login_at,
        createdAt: a.created_at,
      })),
    });
  } catch (e) {
    console.error("listSuperAdmins:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat daftar Super Admin.");
  }
}

export async function createSuperAdmin(input: {
  name: string;
  email: string;
  password: string;
  subLevel: SuperAdminSubLevel;
}) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name) return fail("Nama wajib diisi.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Email tidak valid.");
    if (!SUB_LEVELS.includes(input.subLevel)) return fail("Sub-level tidak dikenal.");
    const pwErr = validateSuperAdminPassword(input.password);
    if (pwErr) return fail(pwErr);

    const exists = await prisma.superAdmin.findUnique({ where: { email } });
    if (exists) return fail("Email sudah dipakai akun Super Admin lain.");

    const created = await prisma.superAdmin.create({
      data: {
        name,
        email,
        password_hash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        role: input.subLevel,
        active: true,
      },
    });
    await log(actor, "SUPER_ADMIN_CREATED", { id: created.id, label: email }, { subLevel: input.subLevel });

    revalidatePath("/platform/admins");
    return ok({ id: created.id });
  } catch (e) {
    console.error("createSuperAdmin:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat akun Super Admin.");
  }
}

export async function setSuperAdminActive(id: string, active: boolean) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const target = await prisma.superAdmin.findUnique({ where: { id } });
    if (!target) return fail("Akun tidak ditemukan.");
    if (target.active === active) return fail(`Akun sudah ${active ? "aktif" : "nonaktif"}.`);
    if (!active && id === actor.id) return fail("Tidak bisa menonaktifkan akun Anda sendiri.");
    if (!active && target.role === "SUPER_ADMIN" && (await activeSuperAdminCount()) <= 1) {
      return fail("Ini satu-satunya SUPER_ADMIN aktif — tidak bisa dinonaktifkan.");
    }

    await prisma.superAdmin.update({
      where: { id },
      data: active
        ? { active: true, failed_login_count: 0, locked_until: null }
        : { active: false },
    });
    await log(actor, active ? "SUPER_ADMIN_ACTIVATED" : "SUPER_ADMIN_DEACTIVATED", {
      id,
      label: target.email,
    });

    revalidatePath("/platform/admins");
    return ok({ active });
  } catch (e) {
    console.error("setSuperAdminActive:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengubah status akun.");
  }
}

export async function changeSuperAdminSubLevel(id: string, subLevel: SuperAdminSubLevel) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    if (!SUB_LEVELS.includes(subLevel)) return fail("Sub-level tidak dikenal.");
    const target = await prisma.superAdmin.findUnique({ where: { id } });
    if (!target) return fail("Akun tidak ditemukan.");
    if (target.role === subLevel) return fail("Sub-level tidak berubah.");
    if (
      target.role === "SUPER_ADMIN" &&
      subLevel !== "SUPER_ADMIN" &&
      target.active &&
      (await activeSuperAdminCount()) <= 1
    ) {
      return fail("Ini satu-satunya SUPER_ADMIN aktif — turunkan akun lain dulu.");
    }

    await prisma.superAdmin.update({ where: { id }, data: { role: subLevel } });
    await log(actor, "SUPER_ADMIN_SUBLEVEL_CHANGED", { id, label: target.email }, {
      from: target.role,
      to: subLevel,
    });

    revalidatePath("/platform/admins");
    return ok({ subLevel });
  } catch (e) {
    console.error("changeSuperAdminSubLevel:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengubah sub-level.");
  }
}

export async function resetSuperAdminPassword(id: string, newPassword: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const target = await prisma.superAdmin.findUnique({ where: { id } });
    if (!target) return fail("Akun tidak ditemukan.");
    const pwErr = validateSuperAdminPassword(newPassword);
    if (pwErr) return fail(pwErr);

    await prisma.superAdmin.update({
      where: { id },
      data: {
        password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        failed_login_count: 0,
        locked_until: null,
      },
    });
    await log(actor, "SUPER_ADMIN_PASSWORD_RESET", { id, label: target.email });

    revalidatePath("/platform/admins");
    return ok(null);
  } catch (e) {
    console.error("resetSuperAdminPassword:", e);
    return fail(e instanceof Error ? e.message : "Gagal reset kata sandi.");
  }
}

export async function unlockSuperAdmin(id: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const target = await prisma.superAdmin.findUnique({ where: { id } });
    if (!target) return fail("Akun tidak ditemukan.");

    await prisma.superAdmin.update({
      where: { id },
      data: { failed_login_count: 0, locked_until: null },
    });
    await log(actor, "SUPER_ADMIN_UNLOCKED", { id, label: target.email });

    revalidatePath("/platform/admins");
    return ok(null);
  } catch (e) {
    console.error("unlockSuperAdmin:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuka kunci akun.");
  }
}

/** Reset MFA akun lain (mis. HP hilang) — akun itu harus enroll ulang saat login berikutnya. */
export async function resetSuperAdminMfa(id: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const target = await prisma.superAdmin.findUnique({ where: { id } });
    if (!target) return fail("Akun tidak ditemukan.");

    await prisma.superAdmin.update({
      where: { id },
      data: { totp_secret: null, totp_enabled: false, totp_backup_codes: null, mfa_enrolled_at: null },
    });
    await log(actor, "MFA_RESET", { id, label: target.email });

    revalidatePath("/platform/admins");
    return ok(null);
  } catch (e) {
    console.error("resetSuperAdminMfa:", e);
    return fail(e instanceof Error ? e.message : "Gagal reset MFA.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MFA self-service (aktor bertindak untuk dirinya sendiri)
// ─────────────────────────────────────────────────────────────────────────────

/** Status MFA akun sendiri — untuk halaman /platform/mfa-setup. */
export async function getMyMfaState() {
  try {
    const actor = await requireSuperAdmin();
    const rec = await prisma.superAdmin.findUnique({
      where: { id: actor.id },
      select: { email: true, totp_enabled: true },
    });
    return ok({ email: rec?.email ?? "", enabled: !!rec?.totp_enabled });
  } catch (e) {
    console.error("getMyMfaState:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat status MFA.");
  }
}

/** Mulai / ulangi enrollment: buat secret baru, simpan (belum aktif), balikan URI untuk QR. */
export async function startMfaEnrollment() {
  try {
    const actor = await requireSuperAdmin();
    const rec = await prisma.superAdmin.findUnique({ where: { id: actor.id } });
    if (!rec) return fail("Akun tidak ditemukan.");
    if (rec.totp_enabled) return fail("MFA sudah aktif. Untuk mengganti perangkat, minta SUPER_ADMIN lain me-reset MFA Anda.");

    const secret = generateTotpSecret();
    await prisma.superAdmin.update({ where: { id: actor.id }, data: { totp_secret: secret } });
    await log(actor, "MFA_ENROLL_STARTED", { id: actor.id, label: rec.email });

    return ok({ secret, uri: totpUri(secret, rec.email) });
  } catch (e) {
    console.error("startMfaEnrollment:", e);
    return fail(e instanceof Error ? e.message : "Gagal memulai enrollment MFA.");
  }
}

/** Konfirmasi kode pertama → aktifkan MFA, balikan kode cadangan SEKALI SAJA. */
export async function confirmMfaEnrollment(code: string) {
  try {
    const actor = await requireSuperAdmin();
    const rec = await prisma.superAdmin.findUnique({ where: { id: actor.id } });
    if (!rec) return fail("Akun tidak ditemukan.");
    if (rec.totp_enabled) return fail("MFA sudah aktif.");
    if (!rec.totp_secret) return fail("Belum ada sesi enrollment. Mulai dari awal.");
    if (!verifyTotp(rec.totp_secret, code)) return fail("Kode salah atau kedaluwarsa. Coba kode terbaru dari aplikasi authenticator.");

    const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);
    const hashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c.replace("-", ""), BCRYPT_ROUNDS)));

    await prisma.superAdmin.update({
      where: { id: actor.id },
      data: {
        totp_enabled: true,
        mfa_enrolled_at: new Date(),
        totp_backup_codes: JSON.stringify(hashes),
      },
    });
    await log(actor, "MFA_ENABLED", { id: actor.id, label: rec.email });

    return ok({ backupCodes });
  } catch (e) {
    console.error("confirmMfaEnrollment:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengaktifkan MFA.");
  }
}
