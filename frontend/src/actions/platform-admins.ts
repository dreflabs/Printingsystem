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
import { ok, fail } from "@/types";

const BCRYPT_ROUNDS = 12;
const SUB_LEVELS: SuperAdminSubLevel[] = ["SUPER_ADMIN", "SUPPORT", "FINANCE"];

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

// MFA panel Super Admin memakai kode OTP email (verifikasi di src/lib/auth.ts).
// Tidak ada enrollment / perangkat / kode cadangan — jadi tidak ada aksi
// "reset MFA" atau self-service di sini. Pemulihan akun = SUPER_ADMIN lain
// reset password, atau `npm run bootstrap:superadmin` di server.
