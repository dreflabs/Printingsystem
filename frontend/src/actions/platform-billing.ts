"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSubLevel, type PlatformActor } from "@/lib/platform";
import { logPlatform, headerMeta, type PlatformAuditAction } from "@/lib/platform-audit";
import {
  generateInvoicesForPeriod as generateInvoicesCore,
  UNPAID_STATUSES,
  type InvoiceStatus,
} from "@/lib/billing";
import { ok, fail } from "@/types";

const num = (v: unknown) => Number(v ?? 0);

// ─────────────────────────────────────────────────────────────────────────────
// Audit helper
// ─────────────────────────────────────────────────────────────────────────────

async function log(
  actor: PlatformActor,
  action: PlatformAuditAction,
  target: { type?: "Tenant" | "SuperAdmin"; id?: string; label?: string | null },
  detail?: unknown,
) {
  const meta = await headerMeta();
  await logPlatform({
    actorId: actor.id,
    actorName: actor.name,
    actorSubLevel: actor.subLevel,
    action,
    targetType: target.type ?? null,
    targetId: target.id ?? null,
    targetLabel: target.label ?? null,
    detail,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// B2 — Katalog paket langganan (SubscriptionPlan)
// ═════════════════════════════════════════════════════════════════════════════

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

/** Daftar paket + berapa tenant aktif memakainya. */
export async function listSubscriptionPlans() {
  try {
    await requireSuperAdmin();
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price_monthly: "asc" } });
    // Hitung tenant per paket dari Tenant.plan (string) — itu sumber kebenaran
    // yang dipakai gate fitur; TenantSubscription hanya cermin untuk MRR.
    const byPlan = await prisma.tenant.groupBy({
      by: ["plan"],
      where: { status: { not: "CHURNED" } },
      _count: { _all: true },
    });
    const usage: Record<string, number> = {};
    for (const r of byPlan) usage[r.plan.toUpperCase()] = r._count._all;

    return ok(
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceMonthly: num(p.price_monthly),
        maxUsers: p.max_users,
        maxOrdersPerMonth: p.max_orders_per_month,
        features: p.features_json ? safeParseArray(p.features_json) : [],
        active: p.active,
        tenantCount: usage[p.slug.toUpperCase()] ?? 0,
      })),
    );
  } catch (e) {
    console.error("listSubscriptionPlans:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat paket.");
  }
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

type PlanInput = {
  name: string;
  slug: string;
  priceMonthly: number;
  maxUsers: number | null;
  maxOrdersPerMonth: number | null;
  features: string[];
  active: boolean;
};

function validatePlan(input: PlanInput): string | null {
  if (!input.name?.trim()) return "Nama paket wajib diisi.";
  if (!SLUG_RE.test(input.slug)) return "Slug harus huruf kecil/angka/strip, 1–30 karakter.";
  if (!Number.isFinite(input.priceMonthly) || input.priceMonthly < 0) return "Harga tidak valid.";
  if (input.maxUsers != null && (!Number.isInteger(input.maxUsers) || input.maxUsers < 1))
    return "Maks. user harus bilangan bulat ≥ 1 (atau kosong).";
  if (input.maxOrdersPerMonth != null && (!Number.isInteger(input.maxOrdersPerMonth) || input.maxOrdersPerMonth < 1))
    return "Maks. order/bulan harus bilangan bulat ≥ 1 (atau kosong).";
  return null;
}

export async function createSubscriptionPlan(input: PlanInput) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const err = validatePlan(input);
    if (err) return fail(err);

    const exists = await prisma.subscriptionPlan.findUnique({ where: { slug: input.slug } });
    if (exists) return fail(`Slug "${input.slug}" sudah dipakai paket lain.`);

    const created = await prisma.subscriptionPlan.create({
      data: {
        name: input.name.trim(),
        slug: input.slug,
        price_monthly: input.priceMonthly,
        max_users: input.maxUsers,
        max_orders_per_month: input.maxOrdersPerMonth,
        features_json: JSON.stringify(input.features.map((f) => f.trim()).filter(Boolean)),
        active: input.active,
      },
    });
    await log(actor, "PLAN_CATALOG_CREATED", { label: created.slug }, { name: created.name, price: input.priceMonthly });
    revalidatePath("/platform/plans");
    return ok({ id: created.id });
  } catch (e) {
    console.error("createSubscriptionPlan:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat paket.");
  }
}

export async function updateSubscriptionPlan(id: string, input: PlanInput) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const err = validatePlan(input);
    if (err) return fail(err);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) return fail("Paket tidak ditemukan.");

    if (input.slug !== plan.slug) {
      const clash = await prisma.subscriptionPlan.findUnique({ where: { slug: input.slug } });
      if (clash) return fail(`Slug "${input.slug}" sudah dipakai paket lain.`);
    }

    const before = { name: plan.name, slug: plan.slug, price: num(plan.price_monthly), active: plan.active };
    await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: input.name.trim(),
        slug: input.slug,
        price_monthly: input.priceMonthly,
        max_users: input.maxUsers,
        max_orders_per_month: input.maxOrdersPerMonth,
        features_json: JSON.stringify(input.features.map((f) => f.trim()).filter(Boolean)),
        active: input.active,
      },
    });
    await log(actor, "PLAN_CATALOG_UPDATED", { id, label: input.slug }, {
      from: before,
      to: { name: input.name.trim(), slug: input.slug, price: input.priceMonthly, active: input.active },
    });
    revalidatePath("/platform/plans");
    return ok(null);
  } catch (e) {
    console.error("updateSubscriptionPlan:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyimpan paket.");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// B1 — Invoice & billing
// ═════════════════════════════════════════════════════════════════════════════

const UNPAID = UNPAID_STATUSES;

/** Rp total & jumlah untuk kartu ringkas billing. */
export async function getBillingMetrics() {
  try {
    await requireSuperAdmin();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [unpaid, overdue, paidThisMonth, mrrSubs] = await Promise.all([
      prisma.invoice.aggregate({ where: { status: { in: UNPAID } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.invoice.aggregate({
        where: { status: { in: UNPAID }, due_date: { lt: now } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "PAID", paid_at: { gte: monthStart } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.tenantSubscription.findMany({
        where: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
        select: { plan: { select: { price_monthly: true } } },
      }),
    ]);

    return ok({
      unpaidAmount: num(unpaid._sum.amount),
      unpaidCount: unpaid._count._all,
      overdueAmount: num(overdue._sum.amount),
      overdueCount: overdue._count._all,
      paidThisMonthAmount: num(paidThisMonth._sum.amount),
      paidThisMonthCount: paidThisMonth._count._all,
      mrr: mrrSubs.reduce((s, x) => s + num(x.plan.price_monthly), 0),
    });
  } catch (e) {
    console.error("getBillingMetrics:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat ringkasan billing.");
  }
}

export async function listInvoices(params?: {
  status?: InvoiceStatus | "ALL";
  q?: string;
  onlyOverdue?: boolean;
  cursor?: string;
  limit?: number;
}) {
  try {
    await requireSuperAdmin();
    const take = Math.min(Math.max(params?.limit ?? 40, 1), 100);
    const q = params?.q?.trim();

    const rows = await prisma.invoice.findMany({
      where: {
        ...(params?.status && params.status !== "ALL" ? { status: params.status } : {}),
        ...(params?.onlyOverdue ? { status: { in: UNPAID }, due_date: { lt: new Date() } } : {}),
        ...(q
          ? {
              OR: [
                { invoice_number: { contains: q, mode: "insensitive" } },
                { tenant: { name: { contains: q, mode: "insensitive" } } },
                { tenant: { slug: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
      take: take + 1,
      ...(params?.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { tenant: { select: { name: true, slug: true, status: true } } },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const now = Date.now();

    return ok({
      invoices: page.map((r) => ({
        id: r.id,
        number: r.invoice_number,
        tenantName: r.tenant.name,
        tenantSlug: r.tenant.slug,
        tenantStatus: r.tenant.status,
        amount: num(r.amount),
        status: r.status as InvoiceStatus,
        dueDate: r.due_date,
        paidAt: r.paid_at,
        paymentMethod: r.payment_method,
        paymentReference: r.payment_reference,
        createdAt: r.created_at,
        overdue: UNPAID.includes(r.status as InvoiceStatus) && r.due_date.getTime() < now,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (e) {
    console.error("listInvoices:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat invoice.");
  }
}

/**
 * Buat invoice PENDING untuk setiap tenant ACTIVE yang punya langganan ACTIVE
 * dan belum punya invoice periode ini. Idempoten (aman diulang). Manual dari
 * panel atau via cron `/api/jobs/billing`. Inti di `src/lib/billing.ts`.
 */
export async function generateInvoicesForPeriod(opts?: { period?: string; dueInDays?: number }) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const res = await generateInvoicesCore({ period: opts?.period, dueInDays: opts?.dueInDays, actor });
    revalidatePath("/platform/billing");
    return ok(res);
  } catch (e) {
    console.error("generateInvoicesForPeriod:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat invoice.");
  }
}

export async function markInvoicePaid(
  id: string,
  input: { method: string; reference?: string; paidAt?: string },
) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const inv = await prisma.invoice.findUnique({ where: { id }, include: { tenant: { select: { slug: true } } } });
    if (!inv) return fail("Invoice tidak ditemukan.");
    if (inv.status === "PAID") return fail("Invoice sudah lunas.");
    const method = input.method?.trim();
    if (!method) return fail("Metode pembayaran wajib diisi (mis. Transfer BCA).");

    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) return fail("Tanggal bayar tidak valid.");

    await prisma.invoice.update({
      where: { id },
      data: {
        status: "PAID",
        paid_at: paidAt,
        payment_method: method,
        payment_reference: input.reference?.trim() || null,
      },
    });
    await log(actor, "INVOICE_PAID", { type: "Tenant", label: inv.tenant.slug }, {
      number: inv.invoice_number,
      amount: num(inv.amount),
      method,
      reference: input.reference?.trim() || null,
    });
    revalidatePath("/platform/billing");
    return ok(null);
  } catch (e) {
    console.error("markInvoicePaid:", e);
    return fail(e instanceof Error ? e.message : "Gagal menandai lunas.");
  }
}

export async function waiveInvoice(id: string, reason: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    if (!reason?.trim()) return fail("Alasan pembebasan (waive) wajib diisi.");
    const inv = await prisma.invoice.findUnique({ where: { id }, include: { tenant: { select: { slug: true } } } });
    if (!inv) return fail("Invoice tidak ditemukan.");
    if (inv.status === "PAID") return fail("Invoice sudah lunas — tidak bisa dibebaskan.");
    if (inv.status === "WAIVED") return fail("Invoice sudah dibebaskan.");

    await prisma.invoice.update({ where: { id }, data: { status: "WAIVED", payment_method: "WAIVED" } });
    await log(actor, "INVOICE_WAIVED", { type: "Tenant", label: inv.tenant.slug }, {
      number: inv.invoice_number,
      amount: num(inv.amount),
      reason: reason.trim(),
    });
    revalidatePath("/platform/billing");
    return ok(null);
  } catch (e) {
    console.error("waiveInvoice:", e);
    return fail(e instanceof Error ? e.message : "Gagal membebaskan invoice.");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// B3 — Analitik pertumbuhan
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Deret bulanan untuk N bulan terakhir + ringkasan. MRR historis
 * direkonstruksi dari jendela aktif TenantSubscription (`started_at` /
 * `ends_at`) — perkiraan, karena tidak ada snapshot harian.
 */
export async function getGrowthAnalytics(opts?: { months?: number }) {
  try {
    await requireSuperAdmin();
    const months = Math.min(Math.max(opts?.months ?? 12, 3), 24);

    const now = new Date();
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [tenants, subs, paidInvoices] = await Promise.all([
      prisma.tenant.findMany({ select: { created_at: true, churned_at: true, status: true } }),
      prisma.tenantSubscription.findMany({
        select: { started_at: true, ends_at: true, plan: { select: { price_monthly: true } } },
      }),
      prisma.invoice.findMany({
        where: { status: "PAID", paid_at: { gte: firstMonth } },
        select: { paid_at: true, amount: true },
      }),
    ]);

    const series: {
      month: string;
      label: string;
      newTenants: number;
      churned: number;
      activeEnd: number;
      mrrEnd: number;
      revenue: number;
    }[] = [];

    for (let i = 0; i < months; i++) {
      const mStart = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
      const mEnd = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i + 1, 1);
      const key = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;

      const newTenants = tenants.filter((t) => t.created_at >= mStart && t.created_at < mEnd).length;
      const churned = tenants.filter((t) => t.churned_at && t.churned_at >= mStart && t.churned_at < mEnd).length;
      const activeEnd = tenants.filter(
        (t) => t.created_at < mEnd && (!t.churned_at || t.churned_at >= mEnd),
      ).length;
      const mrrEnd = subs
        .filter((s) => s.started_at < mEnd && (!s.ends_at || s.ends_at >= mEnd))
        .reduce((sum, s) => sum + num(s.plan.price_monthly), 0);
      const revenue = paidInvoices
        .filter((inv) => inv.paid_at && inv.paid_at >= mStart && inv.paid_at < mEnd)
        .reduce((sum, inv) => sum + num(inv.amount), 0);

      series.push({
        month: key,
        label: mStart.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
        newTenants,
        churned,
        activeEnd,
        mrrEnd,
        revenue,
      });
    }

    // Ringkasan 30 hari terakhir.
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeAt30Start = tenants.filter(
      (t) => t.created_at < d30 && (!t.churned_at || t.churned_at >= d30),
    ).length;
    const churnedLast30 = tenants.filter((t) => t.churned_at && t.churned_at >= d30).length;
    const newLast30 = tenants.filter((t) => t.created_at >= d30).length;
    const activeNow = tenants.filter((t) => t.status === "ACTIVE").length;
    const trialNow = tenants.filter((t) => t.status === "TRIAL").length;
    const mrrNow = series[series.length - 1]?.mrrEnd ?? 0;

    return ok({
      series,
      summary: {
        churnRate30: activeAt30Start > 0 ? churnedLast30 / activeAt30Start : 0,
        churnedLast30,
        newLast30,
        activeNow,
        trialNow,
        mrrNow,
        arpa: activeNow > 0 ? mrrNow / activeNow : 0,
      },
    });
  } catch (e) {
    console.error("getGrowthAnalytics:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat analitik.");
  }
}

export type { InvoiceStatus };
