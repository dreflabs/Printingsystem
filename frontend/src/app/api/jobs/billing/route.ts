import { assertJobAuth, runJob } from "@/lib/jobs";
import { generateInvoicesForPeriod } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/billing
 *
 * Terbitkan invoice langganan bulan berjalan untuk semua tenant ACTIVE yang
 * punya langganan ACTIVE dan belum punya invoice periode ini. Idempoten —
 * aman dijadwalkan tiap hari; hanya membuat yang belum ada.
 *
 * Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 * Query opsional: `?period=YYYY-MM` (default bulan berjalan), `?dueInDays=14`.
 */
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? undefined;
  const dueInDays = Number(url.searchParams.get("dueInDays")) || undefined;

  return runJob("billing", async () => {
    const res = await generateInvoicesForPeriod({ period, dueInDays, actor: null });
    return {
      period: res.period,
      created: res.created.length,
      skipped: res.skipped.length,
      numbers: res.created.map((c) => c.number),
    };
  });
}

export async function POST(req: Request) {
  const denied = assertJobAuth(req);
  if (denied) return denied;
  return handle(req);
}

export async function GET(req: Request) {
  const denied = assertJobAuth(req);
  if (denied) return denied;
  return handle(req);
}
