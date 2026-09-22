import { prisma } from "@/lib/prisma";
import { logActionInTransaction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

export type ChangePlanTarget = "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";

export type ChangePlanActor =
  | { type: "owner"; userId: string }
  | { type: "platform" };

export interface ChangePlanInput {
  tenantId: string;
  targetPlan: ChangePlanTarget;
  /** Resolusi kuota final — platform bisa override manual, self-serve Owner selalu ikut default katalog paket. */
  maxUsers: number | null;
  reason?: string;
  actor: ChangePlanActor;
}

export interface ChangePlanResult {
  plan: ChangePlanTarget;
  maxUsers: number | null;
  previousPlan: string;
  previousMaxUsers: number | null;
  tenantSlug: string;
}

/**
 * Inti transaksi ganti paket, dipakai bersama oleh Super Admin (`updateTenantPlan`
 * di actions/platform.ts) dan self-serve Owner (`changeTenantPlan` di
 * actions/billing.ts). Diambil dari `updateTenantPlan` — perilaku untuk actor
 * platform TIDAK berubah; hanya audit log platform-nya tetap ditulis oleh
 * pemanggil (butuh `PlatformActor` yang bukan urusan modul ini).
 */
export async function changePlanCore(input: ChangePlanInput): Promise<ActionResult<ChangePlanResult>> {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return fail("Tenant tidak ditemukan.");

  const planChanged = tenant.plan !== input.targetPlan;
  let newPlanRow: { id: string } | null = null;
  if (planChanged) {
    newPlanRow = await prisma.subscriptionPlan.findUnique({
      where: { slug: input.targetPlan.toLowerCase() },
      select: { id: true },
    });
    if (!newPlanRow) {
      return fail(
        `Paket "${input.targetPlan}" belum ada di katalog SubscriptionPlan (slug "${input.targetPlan.toLowerCase()}"). Buat plan-nya dulu sebelum mengubah tenant ke paket ini.`,
      );
    }
  }

  if (tenant.plan === input.targetPlan && tenant.max_users === input.maxUsers) {
    return fail("Tidak ada perubahan.");
  }

  // Guard downgrade hanya untuk self-serve Owner — pegawai aktif adalah sumber
  // daya "berdiri" (tidak reset bulanan) sehingga turun paket tak boleh langsung
  // melanggar kuota yang sudah dipakai. Super Admin tetap bisa override manual
  // (mis. kasus dukungan) seperti perilaku `updateTenantPlan` sebelumnya.
  if (input.actor.type === "owner" && input.maxUsers != null) {
    const activeUsers = await prisma.user.count({ where: { tenant_id: input.tenantId, active: true } });
    // Kursi add-on ikut dihitung — kursi yang dibeli tetap berlaku di paket baru.
    const effectiveMax = input.maxUsers + (tenant.addon_users ?? 0);
    if (activeUsers > effectiveMax) {
      return fail(
        `Tidak bisa turun ke paket ini: ${activeUsers} pegawai aktif melebihi batas ${effectiveMax}. Nonaktifkan pegawai dulu, atau hubungi halo@printpilot.id.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: input.tenantId },
      data: { plan: input.targetPlan, max_users: input.maxUsers },
    });

    // Keep TenantSubscription (and therefore MRR) in sync with Tenant.plan.
    if (planChanged && newPlanRow) {
      await tx.tenantSubscription.updateMany({
        where: { tenant_id: input.tenantId, status: "ACTIVE" },
        data: { status: "CANCELLED", ends_at: new Date() },
      });
      await tx.tenantSubscription.create({
        data: { tenant_id: input.tenantId, plan_id: newPlanRow.id, status: "ACTIVE" },
      });
    }

    if (input.actor.type === "owner") {
      await logActionInTransaction(tx, {
        tenantId: input.tenantId,
        actorId: input.actor.userId,
        action: "PLAN_CHANGED",
        entityType: "Tenant",
        entityId: input.tenantId,
        oldValueJson: { plan: tenant.plan, max_users: tenant.max_users },
        newValueJson: { plan: input.targetPlan, max_users: input.maxUsers },
        notes: input.reason,
      });
    }
  });

  return ok({
    plan: input.targetPlan,
    maxUsers: input.maxUsers,
    previousPlan: tenant.plan,
    previousMaxUsers: tenant.max_users,
    tenantSlug: tenant.slug,
  });
}
