import { prisma } from "@/lib/prisma";
import { alertSyncPlan, severityRank, stockAlertLevel } from "@/lib/operational-alerts";

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

/**
 * Hitung ulang alert operasional dari kondisi terkini, lalu simpan/resolve.
 * Idempoten — aman dipanggil dari server action maupun cron.
 *
 * Dipisah dari server action supaya bisa dijadwalkan (Fase 3) dan diuji
 * langsung tanpa sesi HTTP.
 */
export async function syncOperationalAlerts(tenantId: string): Promise<void> {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const staleBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [materials, incidents, overdueJobs, staleJobs] = await Promise.all([
    // Minimum TIDAK lagi disaring di SQL: bahan habis (stok ≤ 0) tetap alert
    // walau minimumnya belum diatur. Penyaringan pakai stockAlertLevel().
    prisma.material.findMany({ where: { tenant_id: tenantId, active: true }, select: { id: true, name: true, current_stock: true, min_stock: true, unit_stock: true } }),
    prisma.storageItem.findMany({ where: { tenant_id: tenantId, status: "INCIDENT" }, select: { id: true, incident_notes: true, job: { select: { job_code: true, order: { select: { order_code: true } } } } }, take: 50 }),
    prisma.productionJob.findMany({ where: { tenant_id: tenantId, deadline: { gte: now, lt: tomorrow }, status: { in: ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_COMPLETE", "QC_PASSED", "FINISHING_STARTED"] } }, select: { id: true, job_code: true, deadline: true, status: true } }),
    prisma.productionJob.findMany({ where: { tenant_id: tenantId, updated_at: { lt: staleBefore }, status: { in: ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_COMPLETE", "QC_PASSED", "FINISHING_STARTED", "FINISHING_COMPLETE"] } }, select: { id: true, job_code: true, status: true }, take: 50 }),
  ]);

  const drafts: AlertDraft[] = [];
  for (const material of materials) {
    const current = Number(material.current_stock);
    const min = Number(material.min_stock);
    const level = stockAlertLevel(current, min);
    if (!level) continue;
    const depleted = level === "DEPLETED";
    drafts.push({
      dedupeKey: `LOW_STOCK:${material.id}`,
      alertType: "LOW_STOCK",
      severity: depleted ? "CRITICAL" : "WARNING",
      title: depleted ? `Stok ${material.name} habis` : `Stok ${material.name} menipis`,
      message: depleted
        ? `Stok habis (${current} ${material.unit_stock})${min > 0 ? `; minimum ${min} ${material.unit_stock}.` : "; minimum belum diatur."}`
        : `${current} ${material.unit_stock} tersisa; minimum ${min} ${material.unit_stock}.`,
      href: "/finishing#material",
      entityType: "Material",
      entityId: material.id,
    });
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
  // Status sebelumnya dibutuhkan untuk memutuskan buka ulang (selesai kembali
  // muncul, atau diakui tapi memburuk).
  const existing = keys.length
    ? await prisma.operationalAlert.findMany({
        where: { tenant_id: tenantId, dedupe_key: { in: keys } },
        select: { dedupe_key: true, status: true, severity: true },
      })
    : [];
  const previousByKey = new Map(existing.map((row) => [row.dedupe_key, row]));

  if (drafts.length) {
    // Satu transaksi, upsert paralel — dulu satu per satu secara sekuensial.
    await prisma.$transaction(
      drafts.map((draft) => {
        const plan = alertSyncPlan(previousByKey.get(draft.dedupeKey), draft.severity);
        return prisma.operationalAlert.upsert({
          where: { tenant_id_dedupe_key: { tenant_id: tenantId, dedupe_key: draft.dedupeKey } },
          create: { tenant_id: tenantId, dedupe_key: draft.dedupeKey, alert_type: draft.alertType, severity: draft.severity, title: draft.title, message: draft.message, href: draft.href, entity_type: draft.entityType, entity_id: draft.entityId },
          update: {
            alert_type: draft.alertType,
            severity: draft.severity,
            title: draft.title,
            message: draft.message,
            href: draft.href,
            entity_type: draft.entityType,
            entity_id: draft.entityId,
            last_seen_at: now,
            ...(plan.reopen
              ? { status: "OPEN", resolved_at: null, acknowledged_at: null, acknowledged_by: null }
              : {}),
            ...(plan.resetFirstSeen ? { first_seen_at: now } : {}),
          },
        });
      })
    );
  }
  await prisma.operationalAlert.updateMany({ where: { tenant_id: tenantId, status: { in: ["OPEN", "ACKNOWLEDGED"] }, ...(keys.length ? { dedupe_key: { notIn: keys } } : {}) }, data: { status: "RESOLVED", resolved_at: now } });
}

/** Urutan keparahan untuk pengurutan di UI. */
export { severityRank };
