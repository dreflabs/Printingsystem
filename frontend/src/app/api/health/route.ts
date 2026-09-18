import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET|HEAD /api/health — health check untuk Coolify / load balancer.
 *
 * Container yang hidup belum tentu siap melayani: build bisa sukses tapi
 * DATABASE_URL salah, atau Postgres belum menerima koneksi. Endpoint ini
 * menembak satu query paling murah ke DB supaya "sehat" berarti benar-benar
 * bisa melayani permintaan, bukan sekadar proses Node menyala.
 *
 * 200 → siap. 503 → belum siap (orchestrator harus menahan trafik).
 *
 * Publik & tanpa auth (dikecualikan di middleware) karena health check
 * dipanggil tanpa sesi. Karena itu balasannya sengaja tidak memuat detail
 * error, versi, atau nama host — pesan asli hanya masuk log server.
 */
async function handle(): Promise<Response> {
  const started = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { ok: true, db: "up", latencyMs: Date.now() - started },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[health] database tidak dapat dijangkau:", err);
    return Response.json(
      { ok: false, db: "down", latencyMs: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET() {
  return handle();
}

export async function HEAD() {
  return handle();
}
