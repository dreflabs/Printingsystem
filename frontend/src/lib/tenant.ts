import { headers, cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { IMPERSONATE_COOKIE } from "@/lib/platform";

// In development/production, you should use the global prisma instance, 
// but for simplicity here we assume you export one from lib/prisma.ts or auth.ts
// I'll create a standalone prisma client for tenant resolution if one doesn't exist yet, 
// but ideally we should import from a centralized file.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Gets the current tenant slug from the x-tenant-slug header injected by middleware
 */
export async function getTenantSlug(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-tenant-slug");
}

/**
 * Gets the current Tenant object from the database based on the subdomain
 */
export async function getCurrentTenant() {
  // Super Admin impersonation: a valid pp_impersonate cookie overrides subdomain resolution.
  try {
    const imp = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (imp) {
      const t = await prisma.tenant.findUnique({ where: { slug: imp } });
      if (t) return t;
    }
  } catch { /* cookies() unavailable outside request scope */ }

  const slug = await getTenantSlug();

  // DEVELOPMENT FALLBACK: If no slug on localhost, just use the first tenant
  if (!slug) {
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

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug }
    });
    return tenant;
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return null;
  }
}

/**
 * Requires a tenant to exist, otherwise throws an error (useful for API routes)
 */
export async function requireTenant() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("Tenant context is missing. Request must be made from a valid tenant subdomain.");
  }
  return tenant;
}
