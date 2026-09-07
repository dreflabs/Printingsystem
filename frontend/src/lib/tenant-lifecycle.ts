/**
 * Siklus hidup tenant: **churn** (arsip) → **purge** (hapus permanen).
 *
 * Kenapa ada:
 *   `Tenant.slug` (@unique) bersifat GLOBAL dan tidak pernah dilepas. Tenant
 *   TRIAL yang ditinggalkan / SUSPENDED lama menyandera nama subdomain-nya
 *   selamanya — pendaftar baru tak bisa memakai nama itu, dan barisnya jadi
 *   sampah.
 *
 * Mekanisme:
 *   1. churnTenant()  — status → CHURNED, `churned_at` diisi, dan **slug aktif
 *      di-rename** jadi `<slug>-retired-<id8>`. Bentuk itu tidak cocok dengan
 *      regex resolusi subdomain (`^[a-z0-9]{3,30}$` di lib/tenant.ts &
 *      lib/auth.ts), jadi otomatis tak bisa di-login / di-resolve. Slug asli
 *      disimpan di `retired_slug` dan LANGSUNG bebas dipakai pendaftar baru.
 *      Tidak ada baris yang dihapus di tahap ini.
 *   2. purgeTenant()  — setelah masa tenggang, hapus SELURUH baris milik tenant
 *      (urut leaf→root sesuai FK di prisma/schema.prisma) dalam satu transaksi,
 *      lalu tulis satu baris `RetiredTenant` sebagai nisan (untuk audit/pajak).
 *
 * Dipakai oleh:
 *   - `/api/jobs/tenant-lifecycle` (cron harian) — otomatis, dengan masa tenggang.
 *   - `markTenantChurned()` / `purgeTenantPermanently()` di actions/platform.ts —
 *     manual dari panel Super Admin.
 *   - `prisma/backfill-churn-stale-trials.mjs` — sekali, untuk data lama.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** TRIAL yang lewat `trial_ends_at` lebih lama dari ini → otomatis CHURNED. */
export const TRIAL_GRACE_DAYS = 14;
/** SUSPENDED yang tidak tersentuh (`updated_at`) selama ini → otomatis CHURNED. */
export const SUSPENDED_GRACE_DAYS = 60;
/** CHURNED yang lewat `churned_at` lebih lama dari ini → otomatis di-purge. */
export const PURGE_GRACE_DAYS = 30;

export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * Slug arsip. Sengaja mengandung `-` dan bisa >30 karakter supaya TIDAK pernah
 * lolos regex `^[a-z0-9]{3,30}$` yang dipakai untuk me-resolve subdomain →
 * tenant CHURNED otomatis tak bisa diakses, tanpa perlu mengubah kode resolusi.
 */
export function archivedSlug(slug: string, tenantId: string): string {
  return `${slug}-retired-${tenantId.slice(0, 8)}`;
}

export type ChurnSource = "TRIAL_EXPIRED" | "SUSPENDED_STALE" | "MANUAL" | "BACKFILL";

type ChurnableTenant = {
  id: string;
  slug: string;
  status: string;
  retired_slug: string | null;
};

/**
 * Tandai tenant CHURNED + lepas slug-nya. Idempoten: tenant yang sudah CHURNED
 * dibiarkan. Dijalankan di dalam transaksi milik pemanggil.
 */
export async function churnTenant(
  tx: Prisma.TransactionClient,
  tenant: ChurnableTenant,
  source: ChurnSource,
  reason?: string,
  actorId?: string,
): Promise<{ churned: boolean; releasedSlug: string | null }> {
  if (tenant.status === "CHURNED") return { churned: false, releasedSlug: null };

  // Kalau retired_slug sudah terisi (mis. re-run), jangan rename lagi.
  const releasedSlug = tenant.retired_slug ?? tenant.slug;
  const newSlug = tenant.retired_slug ? tenant.slug : archivedSlug(tenant.slug, tenant.id);

  await tx.tenant.update({
    where: { id: tenant.id },
    data: {
      status: "CHURNED",
      churned_at: new Date(),
      retired_slug: releasedSlug,
      slug: newSlug,
    },
  });

  await tx.tenantAuditLog.create({
    data: {
      tenant_id: tenant.id,
      actor_id: actorId ?? null,
      actor_type: actorId ? "SUPER_ADMIN" : "SYSTEM",
      action: "TENANT_CHURNED",
      detail_json: JSON.stringify({
        source,
        reason: reason ?? null,
        from_status: tenant.status,
        released_slug: releasedSlug,
        archived_slug: newSlug,
      }),
    },
  });

  return { churned: true, releasedSlug };
}

export type PurgeResult = {
  tenantId: string;
  originalSlug: string;
  deleted: Record<string, number>;
  files: string[];
};

/**
 * Hapus PERMANEN seluruh data satu tenant, lalu tulis nisan `RetiredTenant`.
 * Urutan delete sengaja leaf→root supaya FK bawaan (RESTRICT) tidak menghalangi
 * — turunkan dari prisma/schema.prisma bila menambah tabel ber-`tenant_id`.
 *
 * Pemanggil bertanggung jawab memastikan tenant memang layak dihapus
 * (status CHURNED + lewat masa tenggang, atau force eksplisit dari Super Admin).
 */
export async function purgeTenant(tenantId: string): Promise<PurgeResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { _count: { select: { users: true, orders: true, customers: true } } },
  });
  if (!tenant) throw new Error("Tenant tidak ditemukan.");

  // Kumpulkan path file untuk dicatat di nisan. Belum ada blob store nyata
  // (path masih sekadar string) — saat store ditambahkan, hapus file-nya di sini.
  const [designFiles, qcPhotos, pickupPhotos, attImports] = await Promise.all([
    prisma.designVersion.findMany({
      where: { tenant_id: tenantId, file_path: { not: null } },
      select: { file_path: true, preview_path: true },
    }),
    prisma.qcRecord.findMany({
      where: { tenant_id: tenantId, photo_path: { not: null } },
      select: { photo_path: true },
    }),
    prisma.pickupRecord.findMany({
      where: { tenant_id: tenantId, photo_path: { not: null } },
      select: { photo_path: true },
    }),
    prisma.attendanceImport.findMany({
      where: { tenant_id: tenantId },
      select: { file_path: true },
    }),
  ]);
  const files = [
    ...designFiles.flatMap((d) => [d.file_path, d.preview_path]),
    ...qcPhotos.map((q) => q.photo_path),
    ...pickupPhotos.map((p) => p.photo_path),
    ...attImports.map((a) => a.file_path),
  ].filter((f): f is string => !!f);

  const where = { tenant_id: tenantId };
  const deleted: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      // Urut dari yang paling "anak". Setiap entri difilter tenant_id, kecuali
      // dua terakhir yang ikut lewat relasi User (tabel tanpa tenant_id sendiri).
      const steps: [string, () => Promise<{ count: number }>][] = [
        ["auditItems", () => tx.auditItem.deleteMany({ where })],
        ["payrollRecords", () => tx.payrollRecord.deleteMany({ where })],
        ["attendanceRecords", () => tx.attendanceRecord.deleteMany({ where })],
        ["designVersions", () => tx.designVersion.deleteMany({ where })],
        ["machineMaterials", () => tx.machineMaterial.deleteMany({ where })],
        ["materialMovements", () => tx.materialMovement.deleteMany({ where })],
        ["qcRecords", () => tx.qcRecord.deleteMany({ where })],
        ["finishingJobs", () => tx.finishingJob.deleteMany({ where })],
        ["storageItems", () => tx.storageItem.deleteMany({ where })],
        ["retailStockMovements", () => tx.retailStockMovement.deleteMany({ where })],
        ["orderItems", () => tx.orderItem.deleteMany({ where })],
        ["payments", () => tx.payment.deleteMany({ where })],
        ["pickupRecords", () => tx.pickupRecord.deleteMany({ where })],
        ["notificationEvents", () => tx.notificationEvent.deleteMany({ where })],
        ["deadlineAlerts", () => tx.deadlineAlert.deleteMany({ where })],
        ["corrections", () => tx.correction.deleteMany({ where })],
        ["auditLogs", () => tx.auditLog.deleteMany({ where })],
        ["audits", () => tx.audit.deleteMany({ where })],
        ["designJobs", () => tx.designJob.deleteMany({ where })],
        ["productionJobs", () => tx.productionJob.deleteMany({ where })],
        ["attendanceImports", () => tx.attendanceImport.deleteMany({ where })],
        ["payrollPeriods", () => tx.payrollPeriod.deleteMany({ where })],
        ["storageLocations", () => tx.storageLocation.deleteMany({ where })],
        ["orders", () => tx.order.deleteMany({ where })],
        ["retailProducts", () => tx.retailProduct.deleteMany({ where })],
        ["products", () => tx.product.deleteMany({ where })],
        ["machines", () => tx.machine.deleteMany({ where })],
        ["materials", () => tx.material.deleteMany({ where })],
        ["customers", () => tx.customer.deleteMany({ where })],
        ["invoices", () => tx.invoice.deleteMany({ where })],
        ["subscriptions", () => tx.tenantSubscription.deleteMany({ where })],
        ["onboardingSteps", () => tx.onboardingStep.deleteMany({ where })],
        ["tenantAuditLogs", () => tx.tenantAuditLog.deleteMany({ where })],
        ["passwordResetTokens", () => tx.passwordResetToken.deleteMany({ where: { user: { tenant_id: tenantId } } })],
        ["userRoles", () => tx.userRole.deleteMany({ where: { user: { tenant_id: tenantId } } })],
        ["users", () => tx.user.deleteMany({ where })],
      ];

      for (const [key, run] of steps) {
        deleted[key] = (await run()).count;
      }

      await tx.retiredTenant.create({
        data: {
          id: tenant.id,
          original_slug: tenant.retired_slug ?? tenant.slug,
          name: tenant.name,
          plan: tenant.plan,
          owner_name: tenant.owner_name,
          owner_email: tenant.billing_email,
          status_before: tenant.status,
          created_at: tenant.created_at,
          churned_at: tenant.churned_at ?? new Date(),
          counts_json: JSON.stringify({
            users: tenant._count.users,
            orders: tenant._count.orders,
            customers: tenant._count.customers,
          }),
          files_json: files.length ? JSON.stringify(files) : null,
        },
      });

      await tx.tenant.delete({ where: { id: tenant.id } });
    },
    { timeout: 120_000 },
  );

  return {
    tenantId: tenant.id,
    originalSlug: tenant.retired_slug ?? tenant.slug,
    deleted,
    files,
  };
}
