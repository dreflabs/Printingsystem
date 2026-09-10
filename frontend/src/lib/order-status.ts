/**
 * Status order — sumber tunggal. Status order sengaja "kasar"; sub-state detail
 * hidup di record anak (DesignJob, ProductionJob/QcRecord, StorageItem,
 * PickupRecord). Lihat `09-TECHNICAL/STATUS-MACHINE.md`.
 */

/** Semua status yang benar-benar bisa dimiliki sebuah Order (PRINTING + RETAIL). */
export const ORDER_STATUSES = [
  // PRINTING
  "DRAFT",
  "DESIGNING",
  "WAITING_PAYMENT",
  "CONFIRMED",
  "PRODUCTION_ASSIGNED",
  "PRODUCTION_STARTED",
  "QC_PENDING",
  "QC_PASSED",
  "QC_REWORK_PENDING",
  "FINISHING_STARTED",
  "FINISHING_COMPLETE",
  "STORED",
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "FINAL_AUDIT_PENDING",
  "FINAL_AUDIT_COMPLETE",
  "CLOSED",
  // kondisi khusus
  "ON_HOLD",
  "CANCELLED",
  "INCIDENT",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Label bahasa Indonesia untuk `Order.status` — sumber tunggal teks yang dilihat
 * user. Enum teknis tetap; ini hanya lapisan tampilan. `<StatusPill>` juga
 * memakainya untuk order.
 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  DESIGNING: "Proses Desain",
  WAITING_PAYMENT: "Menunggu DP",
  CONFIRMED: "Siap Produksi",
  PRODUCTION_ASSIGNED: "Antrian Cetak",
  PRODUCTION_STARTED: "Proses Cetak",
  QC_PENDING: "Cetak Selesai — Menunggu QC",
  QC_PASSED: "Lulus QC",
  QC_REWORK_PENDING: "Perlu Perbaikan (Rework)",
  FINISHING_STARTED: "Proses Finishing",
  FINISHING_COMPLETE: "Finishing Selesai",
  STORED: "Tersimpan di Rak",
  READY_FOR_PICKUP: "Siap Diambil",
  IN_TRANSIT: "Di Counter Pengambilan",
  FINAL_AUDIT_PENDING: "Sudah Diserahkan — Menunggu Audit",
  FINAL_AUDIT_COMPLETE: "Audit Akhir — Perlu Approval Owner",
  CLOSED: "Selesai",
  ON_HOLD: "Ditahan",
  CANCELLED: "Dibatalkan",
  INCIDENT: "Barang Hilang / Insiden",
};

/** Label ramah untuk status order; kembalikan apa adanya kalau tak dikenal. */
export function orderStatusLabel(status: string): string {
  return (ORDER_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

/**
 * Deadline order dianggap TERPENUHI begitu barang siap diambil. Dipakai untuk
 * menghitung "overdue" — sekali READY_FOR_PICKUP, keterlambatan pengambilan oleh
 * pelanggan bukan tanggung jawab toko. Sinkron dengan `RESOLVED_STATUSES` di
 * cron `deadline-alerts`.
 */
export const DEADLINE_SETTLED: string[] = [
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "PICKED_UP", // status level job; disertakan untuk aman
  "FINAL_AUDIT_PENDING",
  "FINAL_AUDIT_COMPLETE",
  "CLOSED",
  "CANCELLED",
];

/** Order tidak lagi butuh tindakan pipeline. (RETAIL lahir langsung CLOSED.) */
export const TERMINAL_STATUSES: string[] = ["CLOSED", "CANCELLED"];

export function isDeadlineSettled(status: string): boolean {
  return DEADLINE_SETTLED.includes(status);
}
export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}
