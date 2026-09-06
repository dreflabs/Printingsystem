import { timingSafeEqual } from "crypto";

/**
 * Helper untuk endpoint background job (`/api/jobs/*`).
 *
 * Job dipicu dari luar (cron eksternal / scheduler) lewat HTTP dengan header
 *   Authorization: Bearer <JOBS_SECRET>
 * Pendekatan DB-polling: tiap endpoint memindai baris yang perlu diproses,
 * mengerjakannya, lalu mengembalikan ringkasan JSON. Idempoten — aman dipanggil
 * berkali-kali.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verifikasi token job. Kembalikan `Response` (untuk di-return langsung) jika
 * gagal, atau `null` jika lolos.
 */
export function assertJobAuth(req: Request): Response | null {
  const secret = process.env.JOBS_SECRET;
  if (!secret || secret.length < 16) {
    return Response.json(
      { ok: false, error: "JOBS_SECRET belum diset (min. 16 karakter)." },
      { status: 500 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token || !safeEqual(token, secret)) {
    return Response.json({ ok: false, error: "Tidak diizinkan." }, { status: 401 });
  }
  return null;
}

/** Bungkus eksekusi job: timing + logging seragam + amplop JSON. */
export async function runJob<T>(name: string, fn: () => Promise<T>): Promise<Response> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    console.log(`[JOB:${name}] ok in ${ms}ms ${JSON.stringify(result)}`);
    return Response.json({ ok: true, job: name, ms, result });
  } catch (e) {
    const ms = Date.now() - start;
    console.error(`[JOB:${name}] GAGAL in ${ms}ms`, e);
    return Response.json(
      { ok: false, job: name, ms, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
