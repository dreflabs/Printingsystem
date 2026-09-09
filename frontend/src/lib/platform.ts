import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Sub-level DINONAKTIFKAN — semua Super Admin satu level (akses penuh).
// Tipe & kolom `SuperAdmin.role` dibiarkan agar mudah dikembalikan bila perlu;
// getPlatformActor selalu mengembalikan "SUPER_ADMIN" apa pun isi kolomnya.
export type SuperAdminSubLevel = "SUPER_ADMIN" | "SUPPORT" | "FINANCE";

/** Batas umur sesi platform. Setelah ini, Super Admin harus login ulang (+ MFA). */
export const PLATFORM_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface PlatformActor {
  id: string;
  name: string;
  subLevel: SuperAdminSubLevel;
}

/**
 * Sesi platform (Super Admin) yang sedang login, atau null.
 * Selalu divalidasi ulang ke DB (bukan hanya klaim JWT) supaya akun yang
 * dinonaktifkan (active: false) atau di-turunkan sub-level-nya langsung
 * kehilangan akses tanpa menunggu token JWT lama kedaluwarsa.
 *
 * Juga menolak sesi platform yang lebih tua dari PLATFORM_SESSION_MAX_AGE_MS —
 * jendela pencurian token jauh lebih kecil dari default NextAuth (30 hari).
 */
export async function getPlatformActor(): Promise<PlatformActor | null> {
  const session = await auth();
  const u = session?.user as
    | { id?: string; platform?: boolean; platformLoginAt?: number | null }
    | undefined;
  if (!u?.platform || !u.id) return null;

  if (u.platformLoginAt && Date.now() - u.platformLoginAt > PLATFORM_SESSION_MAX_AGE_MS) return null;

  const record = await prisma.superAdmin.findUnique({ where: { id: u.id } });
  if (!record || !record.active) return null;

  // Sub-level dinonaktifkan: setiap Super Admin aktif = akses penuh.
  return {
    id: record.id,
    name: record.name ?? "Super Admin",
    subLevel: "SUPER_ADMIN",
  };
}

export async function requireSuperAdmin(): Promise<PlatformActor> {
  const actor = await getPlatformActor();
  if (!actor) throw new Error("Butuh sesi Super Admin.");
  return actor;
}

/** Batasi ke sub-level tertentu (mis. hanya SUPER_ADMIN untuk suspend/delete). */
export async function requireSubLevel(...allowed: SuperAdminSubLevel[]): Promise<PlatformActor> {
  const actor = await requireSuperAdmin();
  if (!allowed.includes(actor.subLevel)) {
    throw new Error(`Aksi ini butuh sub-level ${allowed.join(" / ")}. Anda: ${actor.subLevel}.`);
  }
  return actor;
}

export const IMPERSONATE_COOKIE = "pp_impersonate";
