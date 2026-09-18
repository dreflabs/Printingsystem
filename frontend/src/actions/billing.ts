"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { getTenantEntitlements } from "@/lib/entitlements";
import { SAAS_PLANS, type SelfServePlanKey } from "@/lib/saas-catalog";
import { changePlanCore } from "@/lib/plan-change";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";

/** Katalog self-serve dibalik dari `tenantPlan` (STARTER/PRO) → definisi harga & fitur. */
const PLAN_BY_TENANT_PLAN = Object.fromEntries(
  Object.values(SAAS_PLANS).map((p) => [p.tenantPlan, p]),
) as Record<string, (typeof SAAS_PLANS)[keyof typeof SAAS_PLANS]>;

export interface TenantBillingSummary {
  plan: string;
  planName: string;
  priceMonthly: number | null; // null = tidak self-serve (Enterprise) → hubungi Sales
  status: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  maxUsers: number | null;
  activeUsers: number;
  maxOrdersPerMonth: number | null;
  ordersThisMonth: number;
  canManagePlan: boolean;
  availablePlans: {
    key: SelfServePlanKey;
    name: string;
    priceMonthly: number;
    maxUsers: number | null;
    current: boolean;
  }[];
  invoices: {
    id: string;
    number: string;
    period: string;
    amount: number;
    status: string;
    dueDate: string;
    paidAt: string | null;
  }[];
}

export interface TrialBannerStatus {
  status: string;
  planName: string;
  trialDaysLeft: number | null;
}

/**
 * Status trial ringan untuk banner dashboard Owner — dipanggil di setiap
 * kunjungan dashboard, jadi sengaja tidak ikut hitung kuota/invoice seperti
 * `getTenantBillingSummary` (dipakai khusus halaman "Paket & Tagihan").
 */
export async function getTrialBannerStatus(): Promise<ActionResult<TrialBannerStatus>> {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const t = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { plan: true, status: true, trial_ends_at: true },
    });
    if (!t) return fail("Data tenant tidak ditemukan.");

    const planDef = PLAN_BY_TENANT_PLAN[t.plan.toUpperCase()];
    const trialDaysLeft = t.trial_ends_at
      ? Math.ceil((t.trial_ends_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

    return ok({ status: t.status, planName: planDef?.name ?? t.plan, trialDaysLeft });
  } catch (e) {
    console.error("getTrialBannerStatus:", e);
    return fail(safeError(e, "Gagal memuat status trial."));
  }
}

/** Ringkasan paket & tagihan tenant aktif, untuk halaman Owner "Paket & Tagihan". */
export async function getTenantBillingSummary(): Promise<ActionResult<TenantBillingSummary>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const [t, entitlements, activeUsers, ordersThisMonth, invoiceRows] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { plan: true, status: true, trial_ends_at: true },
      }),
      getTenantEntitlements(tenant.id),
      prisma.user.count({ where: { tenant_id: tenant.id, active: true } }),
      prisma.order.count({
        where: {
          tenant_id: tenant.id,
          created_at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.invoice.findMany({
        where: { tenant_id: tenant.id },
        orderBy: { created_at: "desc" },
        take: 12,
        select: {
          id: true,
          invoice_number: true,
          billing_period: true,
          amount: true,
          status: true,
          due_date: true,
          paid_at: true,
        },
      }),
    ]);
    if (!t) return fail("Data tenant tidak ditemukan.");

    const planDef = PLAN_BY_TENANT_PLAN[t.plan.toUpperCase()];
    const trialDaysLeft = t.trial_ends_at
      ? Math.ceil((t.trial_ends_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

    return ok({
      plan: t.plan,
      planName: planDef?.name ?? t.plan,
      priceMonthly: planDef ? Number(planDef.price_monthly) : null,
      status: t.status,
      trialEndsAt: t.trial_ends_at?.toISOString() ?? null,
      trialDaysLeft,
      maxUsers: entitlements.maxUsers,
      activeUsers,
      maxOrdersPerMonth: entitlements.maxOrdersPerMonth,
      ordersThisMonth,
      canManagePlan: actor.roles.includes("owner"),
      availablePlans: (Object.entries(SAAS_PLANS) as [SelfServePlanKey, (typeof SAAS_PLANS)[SelfServePlanKey]][]).map(
        ([key, def]) => ({
          key,
          name: def.name,
          priceMonthly: Number(def.price_monthly),
          maxUsers: def.max_users,
          current: def.tenantPlan === t.plan.toUpperCase(),
        }),
      ),
      invoices: invoiceRows.map((i) => ({
        id: i.id,
        number: i.invoice_number,
        period: i.billing_period,
        amount: Number(i.amount),
        status: i.status,
        dueDate: i.due_date.toISOString(),
        paidAt: i.paid_at?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    console.error("getTenantBillingSummary:", e);
    return fail(safeError(e, "Gagal memuat data paket & tagihan."));
  }
}

/**
 * Ganti paket sendiri (Starter↔Pro) tanpa Super Admin — hanya Owner. Enterprise
 * sengaja tidak self-serve di sini (sama seperti pendaftaran, lihat
 * `saas-catalog.ts`) karena harganya khusus lewat Sales.
 */
export async function changeTenantPlan(planKey: SelfServePlanKey): Promise<ActionResult<{ plan: string; maxUsers: number | null }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang boleh mengubah paket.");

    const def = SAAS_PLANS[planKey];
    if (!def) return fail("Paket tidak dikenal.");

    const result = await changePlanCore({
      tenantId: tenant.id,
      targetPlan: def.tenantPlan,
      maxUsers: def.max_users,
      actor: { type: "owner", userId: actor.id },
    });
    if (!result.success) return result;

    revalidatePath("/owner/billing");
    return ok({ plan: result.data.plan, maxUsers: result.data.maxUsers });
  } catch (e) {
    console.error("changeTenantPlan:", e);
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return fail("Perubahan paket sedang diproses. Muat ulang halaman dan coba lagi.");
    }
    return fail(safeError(e, "Gagal mengubah paket."));
  }
}
