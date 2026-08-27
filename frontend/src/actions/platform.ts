"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSubLevel, IMPERSONATE_COOKIE } from "@/lib/platform";
import { ok, fail } from "@/types";

const num = (v: unknown) => Number(v ?? 0);

async function logTenant(tenantId: string, actorId: string, action: string, detail?: unknown) {
  try {
    await prisma.tenantAuditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: actorId,
        actor_type: "SUPER_ADMIN",
        action,
        detail_json: detail ? JSON.stringify(detail) : null,
      },
    });
  } catch (e) {
    console.error("logTenant:", e);
  }
}

/** Metrics dashboard: MRR + jumlah tenant per status. */
export async function getPlatformMetrics() {
  try {
    await requireSuperAdmin();

    const [tenants, activeSubs] = await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.tenantSubscription.findMany({
        where: { status: "ACTIVE" },
        select: { plan: { select: { price_monthly: true } } },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const t of tenants) byStatus[t.status] = t._count._all;
    const mrr = activeSubs.reduce((s, x) => s + num(x.plan.price_monthly), 0);

    return ok({
      mrr,
      totalTenants: Object.values(byStatus).reduce((a, b) => a + b, 0),
      trial: byStatus.TRIAL ?? 0,
      active: byStatus.ACTIVE ?? 0,
      suspended: byStatus.SUSPENDED ?? 0,
      churned: byStatus.CHURNED ?? 0,
    });
  } catch (e) {
    console.error("getPlatformMetrics:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat metrics.");
  }
}

/** Daftar semua tenant + paket + jumlah user. */
export async function listTenants() {
  try {
    await requireSuperAdmin();
    const tenants = await prisma.tenant.findMany({
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { users: true, orders: true } },
        subscription_plans: {
          where: { status: "ACTIVE" },
          orderBy: { started_at: "desc" },
          take: 1,
          include: { plan: { select: { name: true, price_monthly: true } } },
        },
      },
    });

    return ok(
      tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        plan: t.plan,
        ownerName: t.owner_name,
        ownerPhone: t.owner_phone,
        userCount: t._count.users,
        orderCount: t._count.orders,
        activePlanName: t.subscription_plans[0]?.plan.name ?? null,
        mrr: t.subscription_plans[0] ? num(t.subscription_plans[0].plan.price_monthly) : 0,
        createdAt: t.created_at,
      }))
    );
  } catch (e) {
    console.error("listTenants:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat tenant.");
  }
}

/** Suspend / Activate tenant — hanya sub-level SUPER_ADMIN. */
export async function setTenantStatus(tenantId: string, action: "SUSPEND" | "ACTIVATE", reason?: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return fail("Tenant tidak ditemukan.");

    const nextStatus = action === "SUSPEND" ? "SUSPENDED" : "ACTIVE";
    if (tenant.status === nextStatus) return fail(`Tenant sudah berstatus ${nextStatus}.`);

    await prisma.tenant.update({ where: { id: tenantId }, data: { status: nextStatus } });
    await logTenant(tenantId, actor.id, action === "SUSPEND" ? "TENANT_SUSPENDED" : "TENANT_ACTIVATED", {
      from: tenant.status,
      to: nextStatus,
      reason,
    });

    revalidatePath("/platform");
    return ok({ status: nextStatus });
  } catch (e) {
    console.error("setTenantStatus:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengubah status tenant.");
  }
}

/** Mulai impersonate — SUPER_ADMIN (mode aktif) atau SUPPORT (read-only, belum di-enforce). */
export async function impersonateTenant(tenantId: string, reason: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "SUPPORT");
    if (!reason?.trim()) return fail("Alasan impersonate wajib diisi (untuk transparansi ke tenant).");

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return fail("Tenant tidak ditemukan.");

    (await cookies()).set(IMPERSONATE_COOKIE, tenant.slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 jam
    });
    await logTenant(tenantId, actor.id, "IMPERSONATE_START", {
      super_admin: actor.name,
      sub_level: actor.subLevel,
      reason: reason.trim(),
    });

    revalidatePath("/", "layout");
    return ok({ slug: tenant.slug });
  } catch (e) {
    console.error("impersonateTenant:", e);
    return fail(e instanceof Error ? e.message : "Gagal memulai impersonate.");
  }
}

export async function stopImpersonation() {
  try {
    const actor = await requireSuperAdmin();
    const slug = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    (await cookies()).delete(IMPERSONATE_COOKIE);
    if (slug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant) await logTenant(tenant.id, actor.id, "IMPERSONATE_END", { super_admin: actor.name });
    }
    revalidatePath("/", "layout");
    return ok(null);
  } catch (e) {
    console.error("stopImpersonation:", e);
    return fail(e instanceof Error ? e.message : "Gagal menghentikan impersonate.");
  }
}

/** Cek apakah sesi sedang impersonate (untuk banner). */
export async function getImpersonationState() {
  const slug = (await cookies()).get(IMPERSONATE_COOKIE)?.value ?? null;
  return ok({ impersonating: !!slug, slug });
}
