import { prisma } from "@/lib/prisma";
import { assertJobAuth, runJob } from "@/lib/jobs";
import {
  churnTenant,
  purgeTenant,
  daysAgo,
  TRIAL_GRACE_DAYS,
  SUSPENDED_GRACE_DAYS,
  PURGE_GRACE_DAYS,
} from "@/lib/tenant-lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/tenant-lifecycle
 *
 * Housekeeping tenant (`src/lib/tenant-lifecycle.ts`). Jalan sekali sehari:
 *  A. TRIAL yang lewat `trial_ends_at` > 14 hari         → CHURNED + slug dilepas
 *  B. SUSPENDED yang tak tersentuh > 60 hari             → CHURNED + slug dilepas
 *  C. CHURNED yang lewat `churned_at` > 30 hari          → purge permanen + nisan
 *
 * Idempoten & per-tenant try/catch — satu tenant gagal tidak menghentikan sisanya.
 * Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 */

async function handle(): Promise<Response> {
  return runJob("tenant-lifecycle", async () => {
    const churnedFromTrial: string[] = [];
    const churnedFromSuspended: string[] = [];
    const purged: string[] = [];
    const errors: { slug: string; step: string; error: string }[] = [];

    // ── A. TRIAL kedaluwarsa → CHURNED ──────────────────────────────
    const staleTrials = await prisma.tenant.findMany({
      where: { status: "TRIAL", trial_ends_at: { lt: daysAgo(TRIAL_GRACE_DAYS) } },
      select: { id: true, slug: true, status: true, retired_slug: true },
    });
    for (const t of staleTrials) {
      try {
        await prisma.$transaction((tx) => churnTenant(tx, t, "TRIAL_EXPIRED"));
        churnedFromTrial.push(t.slug);
      } catch (e) {
        errors.push({ slug: t.slug, step: "churn-trial", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── B. SUSPENDED lama tanpa pemulihan → CHURNED ─────────────────
    // `updated_at` naik pada tiap tulis; tenant suspended yang tak disentuh
    // mempertahankan stempel waktu saat di-suspend — proxy yang memadai.
    const staleSuspended = await prisma.tenant.findMany({
      where: { status: "SUSPENDED", updated_at: { lt: daysAgo(SUSPENDED_GRACE_DAYS) } },
      select: { id: true, slug: true, status: true, retired_slug: true },
    });
    for (const t of staleSuspended) {
      try {
        await prisma.$transaction((tx) => churnTenant(tx, t, "SUSPENDED_STALE"));
        churnedFromSuspended.push(t.slug);
      } catch (e) {
        errors.push({ slug: t.slug, step: "churn-suspended", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── C. CHURNED lewat masa tenggang → purge permanen ─────────────
    const purgeable = await prisma.tenant.findMany({
      where: { status: "CHURNED", churned_at: { lt: daysAgo(PURGE_GRACE_DAYS) } },
      select: { id: true, slug: true, retired_slug: true },
    });
    for (const t of purgeable) {
      try {
        const r = await purgeTenant(t.id);
        purged.push(r.originalSlug);
      } catch (e) {
        errors.push({
          slug: t.retired_slug ?? t.slug,
          step: "purge",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      churnedFromTrial: churnedFromTrial.length,
      churnedFromSuspended: churnedFromSuspended.length,
      purged: purged.length,
      details: { churnedFromTrial, churnedFromSuspended, purged },
      errors,
    };
  });
}

export async function POST(req: Request) {
  const denied = assertJobAuth(req);
  if (denied) return denied;
  return handle();
}

export async function GET(req: Request) {
  const denied = assertJobAuth(req);
  if (denied) return denied;
  return handle();
}
