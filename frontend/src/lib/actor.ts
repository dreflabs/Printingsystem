import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { IMPERSONATE_COOKIE, getPlatformActor } from "@/lib/platform";

export interface Actor {
  id: string;
  name: string;
  /** Peran utama (untuk redirect default & kompat lama). */
  role: string;
  /** Semua peran yang dimiliki: utama + tambahan (`extra_roles`), unik. Dipakai RBAC action. */
  roles: string[];
  /** true = sesi Super Admin yang sedang impersonate tenant ini */
  impersonated?: boolean;
  /** true = aktor hanya boleh baca (Super Admin sub-level SUPPORT saat impersonate) */
  readOnly?: boolean;
  /** Id akun Super Admin sebenarnya (hanya diisi saat `impersonated`). */
  platformActorId?: string;
  /** Nama akun Super Admin sebenarnya (hanya diisi saat `impersonated`). */
  platformActorName?: string;
}

/**
 * Catatan untuk audit log ketika aksi tenant sebenarnya dijalankan oleh Super
 * Admin yang sedang impersonate. `logAction` menyimpan `actor.id` = user Owner
 * tenant, jadi tanpa ini jejak audit tenant tampak seolah Owner sendiri yang
 * menghapus pegawai / mereset password. Kembalikan `undefined` untuk aktor
 * tenant biasa (tidak menambah noise).
 */
export function impersonationNote(actor: Actor): string | undefined {
  if (!actor.impersonated) return undefined;
  const who = actor.platformActorName ?? "Super Admin";
  const id = actor.platformActorId ? ` #${actor.platformActorId}` : "";
  return `Dijalankan oleh Super Admin ${who}${id} (mode impersonate)`;
}

/** Prioritas peran — yang tertinggi jadi primary. */
const ROLE_PRIORITY = ["owner", "admin", "designer_sales", "operator", "gudang"];

function orderRoles(names: string[]): string[] {
  const uniq = Array.from(new Set(names.filter(Boolean)));
  return uniq.sort((a, b) => {
    const ia = ROLE_PRIORITY.indexOf(a);
    const ib = ROLE_PRIORITY.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/**
 * true bila aktor punya SALAH SATU peran yang disebut — dari peran utama MAUPUN
 * peran tambahan. Ini pengganti `actor.role === "x"` di RBAC action supaya user
 * multi-peran (Solo Mode / UMKM) benar-benar bisa menjalankan tiap tahap.
 */
export function actorHasRole(actor: Actor, ...names: string[]): boolean {
  return actor.roles.some((r) => names.includes(r));
}

const USER_WITH_ROLES = {
  role: true,
  extra_roles: { select: { role: { select: { name: true } } } },
} as const;

function rolesOf(u: { role: { name: string }; extra_roles: { role: { name: string } }[] }): string[] {
  return orderRoles([u.role.name, ...u.extra_roles.map((er) => er.role.name)]);
}

/**
 * User yang sedang menjalankan aksi.
 *
 * Urutan sumber:
 *  1. Sesi Super Admin + cookie impersonate → aktor = Owner tenant target
 *     (readOnly kalau sub-level bukan SUPER_ADMIN).
 *  2. Sesi NextAuth tenant biasa.
 *  3. Dev-fallback (owner/admin pertama) selama AUTH_BYPASS aktif.
 */
export async function getCurrentUser(): Promise<Actor | null> {
  const session = await auth();
  const su = session?.user;

  // ── 1. Super Admin sedang impersonate ────────────────────────────────
  if (su?.platform) {
    // Re-validasi ke DB (bukan hanya klaim JWT) supaya Super Admin yang
    // dinonaktifkan atau di-downgrade sub-level langsung kehilangan hak
    // impersonate, tanpa menunggu JWT lama kedaluwarsa.
    const actor = await getPlatformActor();
    if (!actor) return null;

    let slug: string | undefined;
    try {
      slug = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    } catch {
      /* di luar request scope */
    }
    if (!slug) return null; // Super Admin tanpa impersonate tidak punya aktor tenant

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return null;
    const owner = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, active: true, role: { name: "owner" } },
      include: USER_WITH_ROLES,
      orderBy: { created_at: "asc" },
    });
    if (!owner) return null;

    // Sub-level dinonaktifkan: subLevel selalu "SUPER_ADMIN" → impersonate = mode aktif.
    const readOnly = actor.subLevel !== "SUPER_ADMIN";
    return {
      id: owner.id,
      name: `${actor.name} (Super Admin)`,
      role: owner.role.name,
      roles: rolesOf(owner),
      impersonated: true,
      readOnly,
      platformActorId: actor.id,
      platformActorName: actor.name,
    };
  }

  // ── 2. Sesi tenant biasa ─────────────────────────────────────────────
  const sid = su?.id;
  if (sid) {
    const u = await prisma.user.findUnique({ where: { id: sid }, include: USER_WITH_ROLES });
    if (u) {
      // Revoke sesi lama: token yang terbit sebelum password terakhir diganti ditolak.
      const tokenPw = session!.user.pwChangedAt ?? 0;
      if (u.password_changed_at && u.password_changed_at.getTime() > tokenPw) return null;
      return { id: u.id, name: u.name, role: u.role.name, roles: rolesOf(u) };
    }
  }

  // ── 3. Dev-fallback ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const tenant = await requireTenant();
    const fallback = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, active: true, role: { name: { in: ["owner", "admin"] } } },
      include: USER_WITH_ROLES,
      orderBy: { created_at: "asc" },
    });
    if (fallback) {
      console.warn("⚠️ actor: DEVELOPMENT FALLBACK user:", fallback.username);
      return { id: fallback.id, name: fallback.name, role: fallback.role.name, roles: rolesOf(fallback) };
    }
  }

  return null;
}

export async function requireUser(): Promise<Actor> {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Sesi tidak valid. Silakan login ulang.");
  return actor;
}

/**
 * Seperti `requireUser()`, tapi menolak aktor read-only (Super Admin SUPPORT
 * yang sedang impersonate). Dipakai di aksi yang mengubah data penting
 * (uang, pembatalan, koreksi, manajemen user).
 *
 * CATATAN SCOPE (sengaja, bukan bug): SUPPORT yang impersonate HANYA diblokir
 * dari action yang memanggil requireMutableActor() secara eksplisit — bukan
 * dari semua mutasi. Action operasional non-finansial (stok material, desain,
 * produksi, absensi, dll.) yang memakai requireUser() biasa TETAP bisa
 * dijalankan SUPPORT saat impersonate, karena SUPPORT dimaksudkan untuk bisa
 * membantu operasional tenant, hanya dilarang menyentuh uang/pembatalan/
 * koreksi. Kalau kebijakan berubah jadi "SUPPORT = view-only penuh", balik
 * default-nya: pakai requireMutableActor() di semua action lalu whitelist
 * action yang boleh SUPPORT jalankan.
 */
export async function requireMutableActor(): Promise<Actor> {
  const actor = await requireUser();
  if (actor.readOnly) {
    throw new Error("Mode dukungan (SUPPORT) bersifat lihat-saja — aksi yang mengubah data tidak diizinkan.");
  }
  return actor;
}
