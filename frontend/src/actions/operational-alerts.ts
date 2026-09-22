"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { severityRank, visibleAlertTypesForRoles } from "@/lib/operational-alerts";
import { syncOperationalAlerts } from "@/lib/operational-alerts-sync";
import { logAction } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";

export type OperationalAlertRow = {
  id: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
};

/**
 * Jeda minimum sinkronisasi alert. Perhitungan ini MENULIS ke DB (upsert +
 * resolve), jadi tanpa jeda setiap halaman yang membuka lonceng akan menulis
 * ulang alert yang sama.
 */
const SYNC_INTERVAL_MS = 60_000;

/**
 * Alert operasional untuk peran yang sedang login. Perhitungan ulang dibatasi
 * (maks. sekali per menit) karena menulis ke DB; pembacaan selalu dari DB.
 */
export async function getOperationalAlerts(): Promise<ActionResult<OperationalAlertRow[]>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "operations.alerts.view")) return fail("Anda tidak memiliki akses melihat alert operasional.");

    const visibleTypes = visibleAlertTypesForRoles(actor.roles);

    const newest = await prisma.operationalAlert.findFirst({
      where: { tenant_id: tenant.id },
      orderBy: { last_seen_at: "desc" },
      select: { last_seen_at: true },
    });
    const stillFresh = newest ? Date.now() - newest.last_seen_at.getTime() < SYNC_INTERVAL_MS : false;
    if (!stillFresh) await syncOperationalAlerts(tenant.id);

    const alerts = await prisma.operationalAlert.findMany({
      where: { tenant_id: tenant.id, status: { in: ["OPEN", "ACKNOWLEDGED"] }, alert_type: { in: [...visibleTypes] } },
      orderBy: { first_seen_at: "desc" },
      take: 100,
    });
    alerts.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || b.first_seen_at.getTime() - a.first_seen_at.getTime());
    return ok(alerts.map((alert) => ({ id: alert.id, alertType: alert.alert_type, severity: alert.severity, status: alert.status, title: alert.title, message: alert.message, href: alert.href, entityType: alert.entity_type, entityId: alert.entity_id, firstSeenAt: alert.first_seen_at, lastSeenAt: alert.last_seen_at, acknowledgedAt: alert.acknowledged_at, acknowledgedBy: alert.acknowledged_by })));
  } catch (e) {
    // Lonceng hidup di semua halaman, termasuk halaman tagihan tenant yang
    // belum bayar. Tenant terkunci tagihan bukan kegagalan tak terduga — jangan
    // cemari log server untuk hal yang memang diharapkan.
    const message = e instanceof Error ? e.message : "";
    if (!message.startsWith("TENANT_UNPAID")) console.error("getOperationalAlerts:", e);
    return fail(safeError(e, "Gagal memuat alert operasional."));
  }
}

export async function acknowledgeOperationalAlert(id: string): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "operations.alerts.acknowledge")) return fail("Hanya Admin/Owner yang boleh mengakui alert.");
    const updated = await prisma.operationalAlert.updateMany({ where: { id, tenant_id: tenant.id, status: "OPEN" }, data: { status: "ACKNOWLEDGED", acknowledged_at: new Date(), acknowledged_by: actor.id } });
    if (updated.count === 0) return fail("Alert sudah diproses atau tidak ditemukan.");
    await logAction(actor.id, "OPERATIONAL_ALERT_ACKNOWLEDGED", "OperationalAlert", id, null, null);
    revalidatePath("/owner");
    revalidatePath("/admin");
    revalidatePath("/finishing");
    return ok(null);
  } catch (e) {
    console.error("acknowledgeOperationalAlert:", e);
    return fail(safeError(e, "Gagal mengakui alert."));
  }
}
