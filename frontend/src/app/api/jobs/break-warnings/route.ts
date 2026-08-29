import { prisma } from "@/lib/prisma";
import { assertJobAuth, runJob } from "@/lib/jobs";
import { sendWhatsApp } from "@/lib/wa";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/break-warnings
 *
 * Pantau istirahat berjalan (ABSENSI-FINGERPRINT.md):
 *  - menit ke-45: WA ke pegawai — "Istirahat Anda berakhir dalam 15 menit."
 *  - lewat 60 menit & belum "Selesai Istirahat": status EXCEEDED + WA ke Owner.
 * Dijalankan tiap beberapa menit oleh cron.
 *
 * Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 */

const WARN_AT_MIN = 45;
const MAX_MIN = 60;

function hhmm(d: Date): string {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function handle(): Promise<Response> {
  return runJob("break-warnings", async () => {
    const now = Date.now();

    const active = await prisma.attendanceRecord.findMany({
      where: { break_start: { not: null }, break_end: null },
      include: { user: { select: { name: true, phone: true } } },
    });

    let warn45 = 0;
    let exceeded = 0;
    const exceededByTenant = new Map<string, { name: string; since: string }[]>();

    for (const rec of active) {
      if (!rec.break_start) continue;
      const elapsedMin = Math.floor((now - rec.break_start.getTime()) / 60000);
      const name = rec.user?.name ?? rec.employee_name;

      if (elapsedMin >= WARN_AT_MIN && !rec.warning_sent_at) {
        if (rec.user?.phone) {
          await sendWhatsApp({
            to: rec.user.phone,
            body: "Istirahat Anda berakhir dalam 15 menit. Silakan kembali ke tempat kerja.",
          });
        }
        await prisma.attendanceRecord.update({
          where: { id: rec.id },
          data: { warning_sent_at: new Date() },
        });
        warn45++;
      }

      if (elapsedMin >= MAX_MIN && rec.break_status !== "EXCEEDED") {
        await prisma.attendanceRecord.update({
          where: { id: rec.id },
          data: { break_status: "EXCEEDED" },
        });
        if (rec.user?.phone) {
          await sendWhatsApp({
            to: rec.user.phone,
            body: "Istirahat Anda sudah melebihi batas 1 jam. Segera kembali.",
          });
        }
        const list = exceededByTenant.get(rec.tenant_id) ?? [];
        list.push({ name, since: hhmm(rec.break_start) });
        exceededByTenant.set(rec.tenant_id, list);
        exceeded++;
      }
    }

    // WA ke Owner tiap tenant yang punya pegawai istirahat berlebih.
    for (const [tenantId, entries] of exceededByTenant) {
      const owners = await prisma.user.findMany({
        where: { tenant_id: tenantId, active: true, role: { name: "owner" }, phone: { not: null } },
        select: { phone: true },
      });
      for (const e of entries) {
        for (const o of owners) {
          if (!o.phone) continue;
          await sendWhatsApp({
            to: o.phone,
            body: `${e.name} sudah istirahat lebih dari 60 menit sejak ${e.since}.`,
          });
        }
      }
    }

    return { activeBreaks: active.length, warn45, exceeded };
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
