/**
 * Aturan murni alert operasional — dipakai server action sekaligus diuji tanpa
 * DB (lihat tests/operational-alerts.test.ts).
 */

/**
 * Jenis alert yang relevan per peran. Owner/Admin melihat semuanya; Gudang
 * hanya yang bisa ditindaklanjuti di halaman Finishing (stok & incident).
 * Alert deadline/job mandek sengaja tidak diberikan ke Gudang: tautannya ke
 * /admin/production yang memang bukan halaman mereka.
 */
const ALERT_TYPES_BY_ROLE: Record<string, readonly string[]> = {
  owner: ["LOW_STOCK", "STORAGE_INCIDENT", "DEADLINE_24H", "STALE_JOB"],
  admin: ["LOW_STOCK", "STORAGE_INCIDENT", "DEADLINE_24H", "STALE_JOB"],
  gudang: ["LOW_STOCK", "STORAGE_INCIDENT"],
};

/** Gabungan jenis alert yang boleh dilihat oleh sekumpulan role. */
export function visibleAlertTypesForRoles(roles: readonly string[]): ReadonlySet<string> {
  const types = new Set<string>();
  for (const role of roles) {
    for (const type of ALERT_TYPES_BY_ROLE[role] ?? []) types.add(type);
  }
  return types;
}

/** CRITICAL lebih mendesak dari WARNING, dst. Semakin kecil semakin mendesak. */
export const severityRank: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export type StockAlertLevel = "DEPLETED" | "LOW" | null;

/**
 * Tingkat peringatan stok:
 * - `DEPLETED` (habis): stok ≤ 0 — berlaku TANPA perlu minimum diatur, karena
 *   habis adalah fakta operasional, bukan sekadar data yang belum diisi.
 * - `LOW` (menipis): minimum diatur dan stok menyentuh/menurun di bawahnya.
 * - `null`: tidak ada alert. Termasuk minimum yang belum diatur (`min_stock = 0`)
 *   selama stok masih ada — itu tugas data di halaman gudang, bukan alert.
 */
export function stockAlertLevel(currentStock: number, minStock: number): StockAlertLevel {
  if (currentStock <= 0) return "DEPLETED";
  if (minStock > 0 && currentStock <= minStock) return "LOW";
  return null;
}

export interface AlertSyncPlan {
  /** Alert yang tadinya RESOLVED/ACKNOWLEDGED harus kembali tampil. */
  reopen: boolean;
  /** Dibuka ulang karena tingkat keparahan naik (mis. menipis → habis). */
  escalated: boolean;
  /** Kondisi muncul kembali setelah selesai — hitung ulang waktu pertama terlihat. */
  resetFirstSeen: boolean;
}

/**
 * Rencana status saat sinkronisasi.
 *
 * Dua kasus yang harus membuka ulang alert:
 * 1. Kondisi muncul lagi setelah alert RESOLVED (kalau tidak, alert yang pernah
 *    selesai tidak akan pernah tampil lagi).
 * 2. Alert yang sudah diakui tapi kondisinya MEMBURUK (severity naik). Tanpa ini,
 *    acknowledge permanen bisa membungkam justru sinyal paling penting —
 *    eskalasi dari "menipis" ke "habis".
 *
 * Tingkat yang turun tidak membuka ulang: ack tetap berlaku.
 */
export function alertSyncPlan(
  previous: { status: string; severity: string } | undefined,
  nextSeverity: string,
): AlertSyncPlan {
  const none: AlertSyncPlan = { reopen: false, escalated: false, resetFirstSeen: false };
  if (!previous) return none;
  if (previous.status === "RESOLVED") return { reopen: true, escalated: false, resetFirstSeen: true };
  if (
    previous.status === "ACKNOWLEDGED" &&
    (severityRank[nextSeverity] ?? 9) < (severityRank[previous.severity] ?? 9)
  ) {
    return { reopen: true, escalated: true, resetFirstSeen: false };
  }
  return none;
}
