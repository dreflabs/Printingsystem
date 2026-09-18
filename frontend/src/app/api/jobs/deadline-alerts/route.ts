import { prisma } from "@/lib/prisma";
import { assertJobAuth, runJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/deadline-alerts
 *
 * Cek deadline order tiap jam (`01-BUSINESS/DEADLINE-DISCOUNT.md`):
 *  - deadline <= 24 jam lagi & order belum siap  → baris `deadline_alerts` H1_WARNING
 *  - deadline sudah lewat & order belum siap      → baris OVERDUE (H1 lama ditutup)
 *  - order sudah READY_FOR_PICKUP+ / batal        → semua alert ditandai resolved
 * Tidak ada aksi otomatis lain — hanya pencatatan untuk badge dashboard & laporan.
 *
 * Tidak duplikat: satu alert per (order, tipe) selama belum resolved.
 * Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 */

// Order dianggap "sudah aman" (alert boleh ditutup) mulai status ini.
const RESOLVED_STATUSES = [
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "PICKED_UP",
  "FINAL_AUDIT_PENDING",
  "FINAL_AUDIT_COMPLETE",
  "CLOSED",
  "CANCELLED",
];

async function handle(): Promise<Response> {
  return runJob("deadline-alerts", async () => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Tutup alert untuk order yang sudah aman / batal.
    const stale = await prisma.deadlineAlert.findMany({
      where: { resolved_at: null, order: { status: { in: RESOLVED_STATUSES } } },
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.deadlineAlert.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { resolved_at: now },
      });
    }

    // 2. Order aktif yang punya deadline.
    const orders = await prisma.order.findMany({
      where: {
        deadline: { not: null },
        status: { notIn: RESOLVED_STATUSES },
      },
      select: {
        id: true,
        tenant_id: true,
        deadline: true,
        deadline_alerts: { where: { resolved_at: null }, select: { id: true, alert_type: true } },
      },
    });

    let h1Created = 0;
    let overdueCreated = 0;
    let h1Superseded = 0;

    for (const o of orders) {
      if (!o.deadline) continue;
      const hasH1 = o.deadline_alerts.some((a) => a.alert_type === "H1_WARNING");
      const hasOverdue = o.deadline_alerts.some((a) => a.alert_type === "OVERDUE");

      if (o.deadline < now) {
        if (!hasOverdue) {
          await prisma.deadlineAlert.create({
            data: { tenant_id: o.tenant_id, order_id: o.id, alert_type: "OVERDUE" },
          });
          overdueCreated++;
        }
        const h1Ids = o.deadline_alerts.filter((a) => a.alert_type === "H1_WARNING").map((a) => a.id);
        if (h1Ids.length > 0) {
          await prisma.deadlineAlert.updateMany({ where: { id: { in: h1Ids } }, data: { resolved_at: now } });
          h1Superseded += h1Ids.length;
        }
      } else if (o.deadline <= in24h) {
        if (!hasH1 && !hasOverdue) {
          await prisma.deadlineAlert.create({
            data: { tenant_id: o.tenant_id, order_id: o.id, alert_type: "H1_WARNING" },
          });
          h1Created++;
        }
      }
    }

    return {
      scanned: orders.length,
      h1Created,
      overdueCreated,
      h1Superseded,
      resolved: stale.length,
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
