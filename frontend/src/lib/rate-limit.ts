/**
 * Rate limiter in-memory sederhana (fixed window per kunci).
 *
 * Catatan: state disimpan di memori proses — efektif untuk satu instance /
 * long-running server. Di lingkungan serverless multi-instance ini hanya
 * "best effort"; proteksi utama brute-force tetap lockout per-akun di DB
 * (`users.locked_until`). Limiter ini menambah rem untuk jalur yang tidak
 * punya lockout (mis. login Super Admin) dan memperlambat serangan terdistribusi
 * ke satu akun.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

export interface RateLimitResult {
  ok: boolean;
  /** detik hingga window direset (0 jika masih ok) */
  retryAfterSec: number;
  remaining: number;
}

/** Catat satu percobaan untuk `key`. Kembalikan ok=false jika melewati `limit`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
  }

  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000), remaining: 0 };
  }
  return { ok: true, retryAfterSec: 0, remaining: Math.max(0, limit - b.count) };
}

/** Hapus hitungan untuk `key` (mis. setelah login sukses). */
export function resetRateLimit(key: string) {
  store.delete(key);
}
