/**
 * Dijalankan sekali saat server Next.js booting (bukan saat `next build`).
 *
 * Dipakai untuk memvalidasi environment lebih awal: lebih baik container
 * menolak start dengan pesan jelas daripada hidup lalu gagal pada aksi
 * pertama pengguna dengan error yang tidak menjelaskan apa-apa.
 */
export async function register() {
  // Hanya di runtime Node — Edge runtime tidak punya env lengkap dan tidak
  // menjalankan aksi bisnis yang butuh rahasia ini.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // `next build` bisa memuat modul ini saat prerender; jangan gagalkan build
  // hanya karena mesin build tidak memegang rahasia produksi.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertEnv } = await import("./lib/env");
  assertEnv();
}
