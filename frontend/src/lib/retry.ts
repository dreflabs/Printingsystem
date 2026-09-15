/**
 * Jalankan `fn` ulang kalau gagal karena pelanggaran unique constraint Prisma
 * (P2002) — dipakai untuk generasi kode berurutan (ORD-/JOB-/CST-…) yang dihitung
 * dari `count()` dan bisa bertabrakan saat ada pembuatan bersamaan.
 */
export async function retryOnUnique<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e;
      lastErr = e;
      // jeda acak kecil supaya tidak saling menabrak lagi
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 40));
    }
  }
  throw lastErr;
}
