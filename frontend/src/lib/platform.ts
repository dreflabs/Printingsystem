import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SuperAdminSubLevel = "SUPER_ADMIN" | "SUPPORT" | "FINANCE";

export interface PlatformActor {
  id: string;
  name: string;
  subLevel: SuperAdminSubLevel;
}

/**
 * Sesi platform (Super Admin) yang sedang login, atau null.
 * Selalu divalidasi ulang ke DB (bukan hanya klaim JWT) supaya akun yang
 * dinonaktifkan (active: false) langsung kehilangan akses tanpa menunggu
 * token JWT lama kedaluwarsa.
 */
export async function getPlatformActor(): Promise<PlatformActor | null> {
  const session = await auth();
  const u = session?.user as
    | { id?: string; name?: string | null; platform?: boolean; subLevel?: SuperAdminSubLevel }
    | undefined;
  if (!u?.platform || !u.id) return null;

  const record = await prisma.superAdmin.findUnique({ where: { id: u.id } });
  if (!record || !record.active) return null;

  return { id: record.id, name: record.name ?? "Super Admin", subLevel: (record.role as SuperAdminSubLevel) ?? "SUPPORT" };
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
