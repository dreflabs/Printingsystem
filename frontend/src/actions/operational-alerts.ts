"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";

type AlertDraft = {
  dedupeKey: string;
  alertType: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  href: string;
  entityType: string;
  entityId: string;
};

const severityRank: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

/**
 * Hitung dan sinkronkan alert operasional yang dapat ditindaklanjuti. Action
 * ini idempoten sehingga aman dipanggil setiap dashboard dibuka atau oleh cron.
 */
export async function getOperationalAlerts(): Promise<ActionResult<Array<{
  id: string; alertType: string; severity: string; status: string; title: string;
  message: string; href: string | null; entityType: string | null; entityId: string | null;
  firstSeenAt: Date; lastSeenAt: Date; acknowledgedAt: Date | null;
}>>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "operations.alerts.view")) return fail("Anda tidak memiliki akses melihat alert operasional.");

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const staleBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [lowStock, incidents, overdueJobs, staleJobs] = await Promise.all([
      prisma.material.findMany({ where: { tenant_id: tenant.id, active: true }, select: { id: true, name: true, current_stock: true, min_stock: true, unit_stock: true } }),
      prisma.storageItem.findMany({ where: { tenant_id: tenant.id, status: "INCIDENT" }, select: { id: true, incident_notes: true, job: { select: { job_code: true, order: { select: { order_code: true } } } } }, take: 50 }),
      prisma.productionJob.findMany({ where: { tenant_id: tenant.id, deadline: { gte: now, lt: tomorrow }, status: { in: ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_COMPLETE", "QC_PASSED", "FINISHING_STARTED"] } }, select: { id: true, job_code: true, deadline: true, status: true } }),
      prisma.productionJob.findMany({ where: { tenant_id: tenant.id, updated_at: { lt: staleBefore }, status: { in: ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_COMPLETE", "QC_PASSED", "FINISHING_STARTED", "FINISHING_COMPLETE"] } }, select: { id: true, job_code: true, status: true }, take: 50 }),
    ]);

    const drafts: AlertDraft[] = [];
    for (const material of lowStock.filter((item) => Number(item.current_stock) <= Number(item.min_stock))) {
      drafts.push({ dedupeKey: `LOW_STOCK:${material.id}`, alertType: "LOW_STOCK", severity: Number(material.current_stock) <= 0 ? "CRITICAL" : "WARNING", title: `Stok ${material.name} menipis`, message: `${Number(material.current_stock)} ${material.unit_stock} tersisa; minimum ${Number(material.min_stock)} ${material.unit_stock}.`, href: "/finishing#material", entityType: "Material", entityId: material.id });
    }
    for (const incident of incidents) {
      drafts.push({ dedupeKey: `STORAGE_INCIDENT:${incident.id}`, alertType: "STORAGE_INCIDENT", severity: "CRITICAL", title: `Incident storage ${incident.job.job_code}`, message: `${incident.job.order.order_code}: ${incident.incident_notes || "Perlu pemeriksaan Gudang."}`, href: "/finishing#storage", entityType: "StorageItem", entityId: incident.id });
    }
    for (const job of overdueJobs) {
      drafts.push({ dedupeKey: `DEADLINE_24H:${job.id}`, alertType: "DEADLINE_24H", severity: "WARNING", title: `Deadline job ${job.job_code} mendekat`, message: `Status ${job.status}; deadline ${job.deadline?.toLocaleString("id-ID")}.`, href: "/admin/production", entityType: "ProductionJob", entityId: job.id });
    }
    for (const job of staleJobs) {
      drafts.push({ dedupeKey: `STALE_JOB:${job.id}`, alertType: "STALE_JOB", severity: "WARNING", title: `Job ${job.job_code} tidak bergerak`, message: `Status ${job.status} tidak berubah lebih dari 24 jam.`, href: "/admin/production", entityType: "ProductionJob", entityId: job.id });
    }

    const keys = drafts.map((draft) => draft.dedupeKey);
    for (const draft of drafts) {
      await prisma.operationalAlert.upsert({
        where: { tenant_id_dedupe_key: { tenant_id: tenant.id, dedupe_key: draft.dedupeKey } },
        create: { tenant_id: tenant.id, dedupe_key: draft.dedupeKey, alert_type: draft.alertType, severity: draft.severity, title: draft.title, message: draft.message, href: draft.href, entity_type: draft.entityType, entity_id: draft.entityId },
        update: { alert_type: draft.alertType, severity: draft.severity, title: draft.title, message: draft.message, href: draft.href, entity_type: draft.entityType, entity_id: draft.entityId, last_seen_at: now },
      });
    }
    await prisma.operationalAlert.updateMany({ where: { tenant_id: tenant.id, status: { in: ["OPEN", "ACKNOWLEDGED"] }, ...(keys.length ? { dedupe_key: { notIn: keys } } : {}) }, data: { status: "RESOLVED", resolved_at: now } });

    const alerts = await prisma.operationalAlert.findMany({ where: { tenant_id: tenant.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: { first_seen_at: "desc" }, take: 100 });
    alerts.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || b.first_seen_at.getTime() - a.first_seen_at.getTime());
    return ok(alerts.map((alert) => ({ id: alert.id, alertType: alert.alert_type, severity: alert.severity, status: alert.status, title: alert.title, message: alert.message, href: alert.href, entityType: alert.entity_type, entityId: alert.entity_id, firstSeenAt: alert.first_seen_at, lastSeenAt: alert.last_seen_at, acknowledgedAt: alert.acknowledged_at })));
  } catch (e) {
    console.error("getOperationalAlerts:", e);
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
