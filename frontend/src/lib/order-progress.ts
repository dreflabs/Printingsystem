import type { Prisma } from "@prisma/client";

/**
 * Kemajuan order multi-job — sumber tunggal logika "order boleh maju kalau SEMUA
 * job-nya sudah sampai fase X".
 *
 * Order multi-item bisa punya >1 ProductionJob (1 per mesin). Job jalan asinkron,
 * jadi cek kemajuan TIDAK boleh mencocokkan status persis (`job.status === "X"`) —
 * job yang lebih cepat sudah menyalip fase X dan bikin `every()` gagal selamanya.
 * Solusinya: bandingkan **peringkat fase** ("sudah minimal sampai X").
 */

/** Job hasil rework yang sudah digantikan — tidak dihitung dalam kemajuan order. */
export const DEAD_JOB_STATUS = ["FAILED_REWORK", "SUPERSEDED"];

/** Peringkat fase ProductionJob. Status mati (FAILED_REWORK/SUPERSEDED) di luar skala. */
const JOB_PHASE: Record<string, number> = {
  PRODUCTION_QUEUED: 0,
  PRODUCTION_ASSIGNED: 0,
  PRODUCTION_STARTED: 1,
  PRODUCTION_PAUSED: 1,
  PRODUCTION_COMPLETE: 2,
  QC_PASSED: 3,
  FINISHING_STARTED: 4,
  FINISHING_COMPLETE: 5,
  STORED: 6,
  IN_TRANSIT: 7,
  PICKED_UP: 8,
};

/**
 * Peringkat fase Order untuk pipeline MAJU. Status yang tidak ada di peta ini
 * (ON_HOLD, QC_REWORK_PENDING, INCIDENT, CANCELLED, CLOSED, FINAL_AUDIT_*, dst)
 * sengaja tidak bisa dinaikkan otomatis — butuh aksi eksplisit.
 */
const ORDER_PHASE: Record<string, number> = {
  CONFIRMED: 0,
  PRODUCTION_ASSIGNED: 1,
  PRODUCTION_STARTED: 2,
  QC_PENDING: 3,
  QC_PASSED: 4,
  FINISHING_STARTED: 5,
  FINISHING_COMPLETE: 6,
  STORED: 7,
  READY_FOR_PICKUP: 8,
  IN_TRANSIT: 9,
};

export function jobPhase(status: string): number {
  return JOB_PHASE[status] ?? -1;
}

/**
 * Semua job HIDUP (non-rework-mati) order sudah minimal mencapai fase
 * `targetJobStatus`? Order tanpa job sama sekali → false.
 */
export async function allLiveJobsReached(
  tx: Prisma.TransactionClient,
  orderId: string,
  targetJobStatus: string
): Promise<boolean> {
  const jobs = await tx.productionJob.findMany({
    where: { order_id: orderId, parent_job_id: null, status: { notIn: DEAD_JOB_STATUS } },
    select: { status: true },
  });
  if (jobs.length === 0) return false;
  const need = JOB_PHASE[targetJobStatus] ?? 99;
  return jobs.every((j) => jobPhase(j.status) >= need);
}

/**
 * Naikkan `Order.status` ke `targetOrderStatus` kalau SEMUA job hidup order sudah
 * mencapai (minimal) fase `targetJobStatus`.
 *
 * - Tahan-salip: pakai peringkat fase, bukan cocok persis.
 * - Tidak pernah memundurkan status, dan tidak menyentuh status non-pipeline
 *   (ON_HOLD, QC_REWORK_PENDING, CANCELLED, ...) — hanya naik di jalur normal.
 * - Mengembalikan `true` kalau syarat "semua job sampai" terpenuhi (terlepas dari
 *   apakah status order ikut berubah), supaya pemanggil bisa tahu order sudah komplet.
 */
export async function advanceOrderWhenAllJobs(
  tx: Prisma.TransactionClient,
  orderId: string,
  targetJobStatus: string,
  targetOrderStatus: string
): Promise<boolean> {
  const reached = await allLiveJobsReached(tx, orderId, targetJobStatus);
  if (!reached) return false;

  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
  const cur = order ? ORDER_PHASE[order.status] : undefined;
  const tgt = ORDER_PHASE[targetOrderStatus] ?? 99;
  if (cur === undefined || cur >= tgt) return true; // status non-pipeline / tidak mundur

  await tx.order.update({ where: { id: orderId }, data: { status: targetOrderStatus } });
  return true;
}
