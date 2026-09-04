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

const PLANS = ["STARTER", "PRO", "ENTERPRISE"] as const;
export type PlanName = (typeof PLANS)[number];

/** Detail satu tenant: profil, langganan, onboarding, audit log terakhir. */
export async function getTenantDetail(tenantId: string) {
  try {
    await requireSuperAdmin();

    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: { select: { users: true, orders: true, customers: true } },
        users: {
          orderBy: { created_at: "asc" },
          select: { id: true, name: true, username: true, email: true, active: true, role: { select: { name: true } }, last_login_at: true },
        },
        subscription_plans: {
          orderBy: { started_at: "desc" },
          include: { plan: { select: { name: true, price_monthly: true } } },
        },
        onboarding_steps: { orderBy: { completed_at: "asc" } },
        tenant_audit_logs: {
          orderBy: { created_at: "desc" },
          take: 50,
          include: { actor: { select: { name: true, role: true } } },
        },
      },
    });
    if (!t) return fail("Tenant tidak ditemukan.");

    return ok({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      plan: t.plan,
      maxUsers: t.max_users,
      trialEndsAt: t.trial_ends_at,
      currentPeriodStart: t.current_period_start,
      currentPeriodEnd: t.current_period_end,
      billingEmail: t.billing_email,
      customDomain: t.custom_domain,
      waProvider: t.wa_provider,
      ownerName: t.owner_name,
      ownerPhone: t.owner_phone,
      createdAt: t.created_at,
      counts: { users: t._count.users, orders: t._count.orders, customers: t._count.customers },
      users: t.users.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role.name,
        active: u.active,
        lastLoginAt: u.last_login_at,
      })),
      subscriptions: t.subscription_plans.map((s) => ({
        id: s.id,
        planName: s.plan.name,
        priceMonthly: num(s.plan.price_monthly),
        status: s.status,
        startedAt: s.started_at,
        endsAt: s.ends_at,
      })),
      onboarding: t.onboarding_steps.map((o) => ({ step: o.step, completedAt: o.completed_at })),
      auditLogs: t.tenant_audit_logs.map((l) => ({
        id: l.id,
        action: l.action,
        actor: l.actor?.name ?? "Sistem",
        actorRole: l.actor?.role ?? l.actor_type,
        detail: l.detail_json,
        createdAt: l.created_at,
      })),
    });
  } catch (e) {
    console.error("getTenantDetail:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat detail tenant.");
  }
}

/** Ubah paket & batas user tenant — hanya sub-level SUPER_ADMIN. */
export async function updateTenantPlan(
  tenantId: string,
  input: { plan: PlanName; maxUsers?: number | null; reason?: string }
) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    if (!PLANS.includes(input.plan)) return fail("Paket tidak dikenal.");
    const maxUsers =
      input.maxUsers == null || Number.isNaN(input.maxUsers)
        ? null
        : Math.max(1, Math.round(input.maxUsers));

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return fail("Tenant tidak ditemukan.");
    if (tenant.plan === input.plan && tenant.max_users === maxUsers) {
      return fail("Tidak ada perubahan.");
    }

    const planChanged = tenant.plan !== input.plan;
    let newPlanRow: { id: string } | null = null;
    if (planChanged) {
      newPlanRow = await prisma.subscriptionPlan.findUnique({
        where: { slug: input.plan.toLowerCase() },
        select: { id: true },
      });
      if (!newPlanRow) {
        return fail(
          `Paket "${input.plan}" belum ada di katalog SubscriptionPlan (slug "${input.plan.toLowerCase()}"). Buat plan-nya dulu sebelum mengubah tenant ke paket ini.`
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { plan: input.plan, max_users: maxUsers },
      });

      // Keep TenantSubscription (and therefore MRR) in sync with Tenant.plan.
      if (planChanged && newPlanRow) {
        await tx.tenantSubscription.updateMany({
          where: { tenant_id: tenantId, status: "ACTIVE" },
          data: { status: "CANCELLED", ends_at: new Date() },
        });
        await tx.tenantSubscription.create({
          data: { tenant_id: tenantId, plan_id: newPlanRow.id, status: "ACTIVE" },
        });
      }
    });

    await logTenant(tenantId, actor.id, "PLAN_CHANGED", {
      from: { plan: tenant.plan, max_users: tenant.max_users },
      to: { plan: input.plan, max_users: maxUsers },
      reason: input.reason,
    });

    revalidatePath("/platform");
    return ok({ plan: input.plan, maxUsers });
  } catch (e) {
    console.error("updateTenantPlan:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengubah paket.");
  }
}

/** Daftar akun Super Admin (untuk halaman pengaturan platform). */
export async function listSuperAdmins() {
  try {
    await requireSuperAdmin();
    const admins = await prisma.superAdmin.findMany({ orderBy: { created_at: "asc" } });
    return ok(
      admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        active: a.active,
        lastLoginAt: a.last_login_at,
        createdAt: a.created_at,
      }))
    );
  } catch (e) {
    console.error("listSuperAdmins:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat daftar Super Admin.");
  }
}
