import { headers, cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { IMPERSONATE_COOKIE, getPlatformActor } from "@/lib/platform";
import { auth } from "@/lib/auth";

// In development/production, you should use the global prisma instance,
// but for simplicity here we assume you export one from lib/prisma.ts or auth.ts
// I'll create a standalone prisma client for tenant resolution if one doesn't exist yet,
// but ideally we should import from a centralized file.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Bentuk slug tenant yang sah (samakan dengan aturan di registerTenant).
const SLUG_RE = /^[a-z0-9]{3,30}$/;

/**
 * Gets the current tenant slug from the x-tenant-slug header injected by middleware.
 * Hanya mengembalikan nilai yang berbentuk slug valid — host non-subdomain
 * (mis. preview *.sslip.io) yang lolos ke header diabaikan.
 */
export async function getTenantSlug(): Promise<string | null> {
  const headersList = await headers();
  const raw = headersList.get("x-tenant-slug");
  return raw && SLUG_RE.test(raw) ? raw : null;
}

/**
 * tenant_id milik user tenant (non-platform) yang sedang login, atau null.
 * Inilah konteks tenant yang mengikat sesi saat aplikasi diakses tanpa
 * subdomain per-tenant (satu origin bersama).
 */
async function getSessionTenantId(): Promise<string | null> {
  try {
    const session = await auth();
    const u = session?.user as { id?: string; platform?: boolean } | undefined;
    if (!u?.id || u.platform) return null;
    const rec = await prisma.user.findUnique({
      where: { id: u.id },
      select: { tenant_id: true },
    });
    return rec?.tenant_id ?? null;
  } catch {
    return null; // di luar request scope
  }
}

/**
 * Resolusi Tenant untuk request saat ini. Urutan prioritas:
 *  1. Super Admin yang sedang impersonate (cookie pp_impersonate).
 *  2. Subdomain (x-tenant-slug dari middleware) — dengan penjagaan lintas-tenant:
 *     user tenant A yang membuka subdomain tenant B ditolak.
 *  3. Tenant milik user yang sedang login (deploy tanpa subdomain per-tenant).
 *  4. Dev-fallback (non-produksi, belum login) → tenant pertama.
 */
export async function getCurrentTenant() {
  // ── 1. Super Admin impersonation ───────────────────────────────────
  // Cookie pp_impersonate menang atas subdomain — tapi hanya bila sesi ini
  // memang milik user platform (Super Admin). Cookie basi pada browser user
  // biasa tidak boleh membocorkan data tenant yang pernah di-impersonate.
  try {
    const imp = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (imp) {
      // Re-validasi ke DB (bukan hanya klaim JWT) supaya Super Admin yang
      // dinonaktifkan langsung kehilangan akses impersonate.
      const actor = await getPlatformActor();
      if (actor) {
        const t = await prisma.tenant.findUnique({ where: { slug: imp } });
        if (t) return t;
      }
    }
  } catch { /* cookies() unavailable outside request scope */ }

  const sessionTenantId = await getSessionTenantId();

  // ── 2. Subdomain ──────────────────────────────────────────────────
  const slug = await getTenantSlug();
  if (slug) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return null;
      // Cegah akses lintas-tenant: sesi user tenant A membuka <tenantB>.printpilot.id.
      if (sessionTenantId && tenant.id !== sessionTenantId) return null;
      return tenant;
    } catch (error) {
      console.error("Error fetching tenant by slug:", error);
      return null;
    }
  }

  // ── 3. Tenant milik sesi user yang login ──────────────────────────
  if (sessionTenantId) {
    try {
      return await prisma.tenant.findUnique({ where: { id: sessionTenantId } });
    } catch (error) {
      console.error("Error fetching tenant by session:", error);
      return null;
    }
  }

  // ── 4. Dev-fallback: belum login, non-produksi → tenant pertama ────
  if (process.env.NODE_ENV !== "production") {
    try {
      const firstTenant = await prisma.tenant.findFirst();
      if (firstTenant) {
        console.warn("⚠️ Using DEVELOPMENT FALLBACK for tenant:", firstTenant.slug);
        return firstTenant;
      }
    } catch (err) {
      console.error("Failed to find fallback tenant", err);
    }
  }

  return null;
}

/**
 * Requires a tenant to exist, otherwise throws an error (useful for API routes)
 */
export async function requireTenant() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("Tenant context is missing. Request must be made from a valid tenant subdomain.");
  }

  // Tenant di-suspend / churned → blokir semua akses, KECUALI Super Admin
  // yang sedang impersonate (untuk investigasi / pemulihan).
  if (tenant.status === "SUSPENDED" || tenant.status === "CHURNED") {
    let impersonating = false;
    try {
      const imp = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
      if (imp) {
        impersonating = (await getPlatformActor()) !== null;
      }
    } catch {
      /* cookies() unavailable outside request scope */
    }
    if (!impersonating) {
      const label = tenant.status === "SUSPENDED" ? "dinonaktifkan sementara" : "tidak aktif";
      throw new Error(`TENANT_SUSPENDED: Akun percetakan ini ${label}. Silakan hubungi tim Print Pilot.`);
    }
  }

  return tenant;
}
