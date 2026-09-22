import { prisma } from "@/lib/prisma";
import { assertJobAuth, runJob } from "@/lib/jobs";
import {
  churnTenant,
  purgeTenant,
  daysAgo,
  UNPAID_GRACE_DAYS,
  SUSPENDED_GRACE_DAYS,
  PURGE_GRACE_DAYS,
} from "@/lib/tenant-lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/tenant-lifecycle
 *
 * Housekeeping tenant (`src/lib/tenant-lifecycle.ts`). Jalan sekali sehari:
 *  A. UNPAID yang lewat jatuh tempo invoice > 7 hari        → SUSPENDED
 *  B. SUSPENDED yang tak tersentuh > 60 hari                → CHURNED + slug dilepas
 *  C. CHURNED yang lewat `churned_at` > 30 hari             → purge permanen + nisan
 *
 * Idempoten & per-tenant try/catch — satu tenant gagal tidak menghentikan sisanya.
 * Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 */

async function handle(): Promise<Response> {
  return runJob("tenant-lifecycle", async () => {
    const suspendedUnpaid: string[] = [];
    const churnedFromSuspended: string[] = [];
    const purged: string[] = [];
    const errors: { slug: string; step: string; error: string }[] = [];

    // ── A. UNPAID lewat jatuh tempo → SUSPENDED ─────────────────────
    // Tanpa free trial: tenant baru berstatus UNPAID sampai invoice pertama
    // dibayar. Kalau lewat tenggang, aksesnya ditutup (SUSPENDED) — bukan
    // langsung churn, supaya masih bisa dipulihkan setelah bayar.
    const staleUnpaid = await prisma.tenant.findMany({
      where: {
        status: "UNPAID",
        invoices: {
          some: { status: { in: ["PENDING", "FAILED"] }, due_date: { lt: daysAgo(UNPAID_GRACE_DAYS) } },
        },
      },
      select: { id: true, slug: true, status: true },
    });
    for (const t of staleUnpaid) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.tenant.update({ where: { id: t.id }, data: { status: "SUSPENDED" } });
          await tx.tenantAuditLog.create({
            data: {
              tenant_id: t.id,
              actor_type: "SYSTEM",
              action: "TENANT_SUSPENDED",
              detail_json: JSON.stringify({ source: "UNPAID_OVERDUE", grace_days: UNPAID_GRACE_DAYS }),
            },
          });
        });
        suspendedUnpaid.push(t.slug);
      } catch (e) {
        errors.push({ slug: t.slug, step: "suspend-unpaid", error: e instanceof Error ? e.message : String(e) });
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
      suspendedUnpaid: suspendedUnpaid.length,
      churnedFromSuspended: churnedFromSuspended.length,
      purged: purged.length,
      details: { suspendedUnpaid, churnedFromSuspended, purged },
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
