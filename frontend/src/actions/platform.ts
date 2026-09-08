"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSubLevel, IMPERSONATE_COOKIE, type PlatformActor } from "@/lib/platform";
import { churnTenant, purgeTenant, PURGE_GRACE_DAYS } from "@/lib/tenant-lifecycle";
import { logPlatform, headerMeta, type PlatformAuditAction } from "@/lib/platform-audit";
import { ok, fail } from "@/types";

const num = (v: unknown) => Number(v ?? 0);

/** Catat aksi Super Admin ke jejak audit tingkat-platform (best-effort). */
async function logActor(
  actor: PlatformActor,
  action: PlatformAuditAction,
  opts: { targetType?: "Tenant" | "SuperAdmin"; targetId?: string; targetLabel?: string | null; detail?: unknown } = {}
) {
  const meta = await headerMeta();
  await logPlatform({
    actorId: actor.id,
    actorName: actor.name,
    actorSubLevel: actor.subLevel,
    action,
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    targetLabel: opts.targetLabel ?? null,
    detail: opts.detail,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

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

    const [tenants, payingSubs, trialSubs] = await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
      // MRR = hanya langganan aktif milik tenant yang benar-benar berbayar
      // (status ACTIVE). Tenant TRIAL/SUSPENDED/CHURNED juga punya baris
      // TenantSubscription ACTIVE — tanpa filter ini MRR ikut menghitung mereka.
      prisma.tenantSubscription.findMany({
        where: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
        select: { plan: { select: { price_monthly: true } } },
      }),
      prisma.tenantSubscription.findMany({
        where: { status: "ACTIVE", tenant: { status: "TRIAL" } },
        select: { plan: { select: { price_monthly: true } } },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const t of tenants) byStatus[t.status] = t._count._all;
    const mrr = payingSubs.reduce((s, x) => s + num(x.plan.price_monthly), 0);
    const trialMrr = trialSubs.reduce((s, x) => s + num(x.plan.price_monthly), 0);

    return ok({
      mrr,
      trialMrr, // potensi pendapatan bila semua trial berjalan konversi
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
    const act = action === "SUSPEND" ? "TENANT_SUSPENDED" : "TENANT_ACTIVATED";
    await logTenant(tenantId, actor.id, act, { from: tenant.status, to: nextStatus, reason });
    await logActor(actor, act, {
      targetType: "Tenant",
      targetId: tenantId,
      targetLabel: tenant.slug,
      detail: { from: tenant.status, to: nextStatus, reason: reason ?? null },
    });

    revalidatePath("/platform");
    return ok({ status: nextStatus });
  } catch (e) {
    console.error("setTenantStatus:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengubah status tenant.");
  }
}

/**
 * Mulai impersonate. SUPER_ADMIN = mode aktif; SUPPORT = read-only (di-enforce
 * di src/lib/actor.ts lewat `readOnly = subLevel !== "SUPER_ADMIN"`).
 */
export async function impersonateTenant(tenantId: string, reason: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "SUPPORT");
    if (!reason?.trim()) return fail("Alasan impersonate wajib diisi (untuk transparansi ke tenant).");

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return fail("Tenant tidak ditemukan.");

    // `secure` mengikuti protokol permintaan yang sebenarnya, bukan NODE_ENV.
    // Di balik reverse-proxy (Coolify/Traefik) `next start` selalu production;
    // kalau panel diakses lewat http:// tanpa TLS, cookie `Secure` DIBUANG diam-
    // diam oleh browser → setelah "Login sebalik" tidak ada cookie impersonate →
    // middleware memantulkan balik ke /platform. `x-forwarded-proto` yang jadi
    // acuan; kalau header itu tak ada, jatuh ke NODE_ENV (perilaku lama).
    const proto = (await headers()).get("x-forwarded-proto");
    const secure = proto ? proto.split(",")[0]!.trim() === "https" : process.env.NODE_ENV === "production";

    (await cookies()).set(IMPERSONATE_COOKIE, tenant.slug, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 jam
    });
    await logTenant(tenantId, actor.id, "IMPERSONATE_START", {
      super_admin: actor.name,
      sub_level: actor.subLevel,
      reason: reason.trim(),
    });
    await logActor(actor, "IMPERSONATE_START", {
      targetType: "Tenant",
      targetId: tenantId,
      targetLabel: tenant.slug,
      detail: { mode: actor.subLevel === "SUPER_ADMIN" ? "active" : "read_only", reason: reason.trim() },
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
      await logActor(actor, "IMPERSONATE_END", { targetType: "Tenant", targetId: tenant?.id, targetLabel: slug });
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
      retiredSlug: t.retired_slug,
      churnedAt: t.churned_at,
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

    const change = {
      from: { plan: tenant.plan, max_users: tenant.max_users },
      to: { plan: input.plan, max_users: maxUsers },
      reason: input.reason ?? null,
    };
    await logTenant(tenantId, actor.id, "PLAN_CHANGED", change);
    await logActor(actor, "TENANT_PLAN_CHANGED", {
      targetType: "Tenant",
      targetId: tenantId,
      targetLabel: tenant.slug,
      detail: change,
    });

    revalidatePath("/platform");
    return ok({ plan: input.plan, maxUsers });
  } catch (e) {
    console.error("updateTenantPlan:", e);
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return fail("Perubahan paket tenant ini sedang diproses di tempat lain. Muat ulang halaman dan coba lagi.");
    }
    return fail(e instanceof Error ? e.message : "Gagal mengubah paket.");
  }
}

// Kelola akun Super Admin + MFA dipindah ke src/actions/platform-admins.ts.

/**
 * Tandai tenant CHURNED + lepas (arsipkan) slug-nya supaya nama subdomain
 * langsung bebas dipakai pendaftar baru. Tidak menghapus data — hanya rename +
 * ganti status. Hanya sub-level SUPER_ADMIN.
 */
export async function markTenantChurned(tenantId: string, reason?: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, status: true, retired_slug: true },
    });
    if (!tenant) return fail("Tenant tidak ditemukan.");
    if (tenant.status === "CHURNED") return fail("Tenant sudah berstatus CHURNED.");

    const { releasedSlug } = await prisma.$transaction((tx) =>
      churnTenant(tx, tenant, "MANUAL", reason, actor.id)
    );
    await logActor(actor, "TENANT_CHURNED", {
      targetType: "Tenant",
      targetId: tenant.id,
      targetLabel: releasedSlug,
      detail: { source: "MANUAL", from_status: tenant.status, reason: reason ?? null },
    });

    revalidatePath("/platform");
    return ok({ status: "CHURNED", releasedSlug });
  } catch (e) {
    console.error("markTenantChurned:", e);
    return fail(e instanceof Error ? e.message : "Gagal menandai tenant churned.");
  }
}

/**
 * Hapus PERMANEN seluruh data tenant CHURNED + tinggalkan nisan RetiredTenant.
 * Tanpa `force`, hanya boleh setelah lewat masa tenggang PURGE_GRACE_DAYS sejak
 * `churned_at`. Hanya sub-level SUPER_ADMIN. Tidak bisa dibatalkan.
 */
export async function purgeTenantPermanently(tenantId: string, opts?: { force?: boolean }) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, churned_at: true, retired_slug: true, slug: true },
    });
    if (!tenant) return fail("Tenant tidak ditemukan.");
    if (tenant.status !== "CHURNED")
      return fail("Hanya tenant berstatus CHURNED yang bisa di-purge. Tandai churned dulu.");

    if (!opts?.force) {
      const eligibleAt = tenant.churned_at
        ? new Date(tenant.churned_at.getTime() + PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000)
        : null;
      if (!eligibleAt || eligibleAt > new Date()) {
        return fail(
          `Masa tenggang ${PURGE_GRACE_DAYS} hari belum lewat` +
            (eligibleAt ? ` (bisa di-purge mulai ${eligibleAt.toLocaleDateString("id-ID")})` : "") +
            ". Centang \"lewati masa tenggang\" untuk memaksa."
        );
      }
    }

    const result = await purgeTenant(tenantId);
    // tenant_audit_logs tenant ini sudah ikut terhapus — jejak permanen ada di
    // nisan RetiredTenant + PlatformAuditLog (tahan-hapus, actor & slug di-snapshot).
    await logActor(actor, "TENANT_PURGED", {
      targetType: "Tenant",
      targetId: tenantId,
      targetLabel: result.originalSlug,
      detail: { forced: !!opts?.force, deleted: result.deleted, files: result.files.length },
    });
    console.log(
      `[PURGE] super_admin=${actor.name} slug=${result.originalSlug} deleted=${JSON.stringify(result.deleted)}`
    );

    revalidatePath("/platform");
    return ok(result);
  } catch (e) {
    console.error("purgeTenantPermanently:", e);
    return fail(e instanceof Error ? e.message : "Gagal purge tenant.");
  }
}

/**
 * Hapus tenant SEKARANG dari daftar — tanpa perlu status CHURNED atau masa
 * tenggang. Kalau tenant masih aktif, slug-nya di-churn dulu (dilepas +
 * di-snapshot ke `retired_slug`) lalu seluruh datanya di-purge permanen dalam
 * satu alur. Tidak bisa dibatalkan. Hanya sub-level SUPER_ADMIN.
 *
 * `confirmSlug` wajib sama persis dengan slug tenant (retired_slug diabaikan) —
 * pengaman supaya tidak salah tenant.
 */
export async function deleteTenantNow(tenantId: string, confirmSlug: string, reason?: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN");
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, status: true, retired_slug: true },
    });
    if (!tenant) return fail("Tenant tidak ditemukan.");

    const typed = confirmSlug.trim();
    if (typed !== tenant.slug && typed !== tenant.retired_slug) {
      return fail(`Ketik subdomain "${tenant.retired_slug ?? tenant.slug}" persis untuk konfirmasi hapus.`);
    }

    // Lepas + arsipkan slug dulu bila tenant belum CHURNED, supaya nama
    // subdomain langsung bebas dan nisan mencatat slug asli.
    if (tenant.status !== "CHURNED") {
      await prisma.$transaction((tx) => churnTenant(tx, tenant, "MANUAL", reason, actor.id));
    }

    const result = await purgeTenant(tenantId);
    await logActor(actor, "TENANT_PURGED", {
      targetType: "Tenant",
      targetId: tenantId,
      targetLabel: result.originalSlug,
      detail: { direct: true, from_status: tenant.status, reason: reason ?? null, deleted: result.deleted, files: result.files.length },
    });
    console.log(
      `[PURGE:direct] super_admin=${actor.name} slug=${result.originalSlug} from=${tenant.status} deleted=${JSON.stringify(result.deleted)}`
    );

    revalidatePath("/platform");
    return ok(result);
  } catch (e) {
    console.error("deleteTenantNow:", e);
    return fail(e instanceof Error ? e.message : "Gagal menghapus tenant.");
  }
}

/** Daftar nisan tenant yang sudah dihapus permanen. */
export async function listRetiredTenants() {
  try {
    await requireSuperAdmin();
    const rows = await prisma.retiredTenant.findMany({ orderBy: { purged_at: "desc" }, take: 100 });
    return ok(
      rows.map((r) => ({
        id: r.id,
        originalSlug: r.original_slug,
        name: r.name,
        plan: r.plan,
        ownerName: r.owner_name,
        churnedAt: r.churned_at,
        purgedAt: r.purged_at,
        counts: r.counts_json ? (JSON.parse(r.counts_json) as Record<string, number>) : null,
      }))
    );
  } catch (e) {
    console.error("listRetiredTenants:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat daftar nisan tenant.");
  }
}

/** Jejak audit tingkat-platform (login, kelola akun, aksi tenant). Semua sub-level boleh lihat. */
export async function listPlatformAuditLog(params?: { cursor?: string; action?: string; limit?: number }) {
  try {
    await requireSuperAdmin();
    const take = Math.min(Math.max(params?.limit ?? 50, 1), 200);
    const rows = await prisma.platformAuditLog.findMany({
      where: params?.action ? { action: params.action } : undefined,
      orderBy: { created_at: "desc" },
      take: take + 1,
      ...(params?.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return ok({
      entries: page.map((r) => ({
        id: r.id,
        actorName: r.actor_name,
        actorSubLevel: r.actor_sub_level,
        action: r.action,
        targetType: r.target_type,
        targetLabel: r.target_label,
        detail: r.detail_json,
        ip: r.ip,
        createdAt: r.created_at,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (e) {
    console.error("listPlatformAuditLog:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat jejak audit platform.");
  }
}
