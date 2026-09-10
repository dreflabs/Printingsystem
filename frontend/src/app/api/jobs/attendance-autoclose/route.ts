import { prisma } from "@/lib/prisma";
import { assertJobAuth, runJob } from "@/lib/jobs";
import { hhmmToMinutes } from "@/lib/attendance";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/attendance-autoclose
 *
 * Sekali sehari sesudah `auto_close_at` (02-WORKFLOW/18-ABSENSI-IN-APP.md §6):
 *  - absen dengan check_in terisi tapi check_out null & tanggalnya sudah lewat
 *    → check_out = tanggal itu jam work_end, check_out_status = AUTO_CLOSED,
 *      owner_note "⚠ Lupa absen pulang".
 *  - istirahat menggantung lewat tengah malam → break_end = break_start +
 *    break_max_min, break_status = EXCEEDED, catatan.
 *  - hapus AttendanceSelfie lebih tua dari selfie_retention_days.
 *
 * Idempoten. Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 */

async function handle(): Promise<Response> {
  return runJob("attendance-autoclose", async () => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const settings = await prisma.tenantAttendanceSetting.findMany();
    const byTenant = new Map(settings.map((s) => [s.tenant_id, s]));

    let autoClosed = 0;
    let breaksClosed = 0;
    let selfiesPurged = 0;

    // 1. Lupa absen pulang — hanya tanggal sebelum hari ini.
    const openPunches = await prisma.attendanceRecord.findMany({
      where: { check_in: { not: null }, check_out: null, date: { lt: todayStart } },
    });
    for (const rec of openPunches) {
      const set = byTenant.get(rec.tenant_id);
      const endMin = hhmmToMinutes(set?.work_end ?? "17:00") ?? 17 * 60;
      const closeAt = new Date(rec.date);
      closeAt.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
      const note = "⚠ Lupa absen pulang — ditutup otomatis sistem.";
      await prisma.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          check_out: closeAt,
          check_out_status: "AUTO_CLOSED",
          check_out_method: "MANUAL",
          owner_note: rec.owner_note ? `${rec.owner_note}\n${note}` : note,
        },
      });
      autoClosed++;
    }

    // 2. Istirahat menggantung dari hari sebelumnya.
    const openBreaks = await prisma.attendanceRecord.findMany({
      where: { break_start: { not: null }, break_end: null, date: { lt: todayStart } },
    });
    for (const rec of openBreaks) {
      if (!rec.break_start) continue;
      const set = byTenant.get(rec.tenant_id);
      const maxMin = set?.break_max_min ?? 60;
      const end = new Date(rec.break_start.getTime() + maxMin * 60_000);
      const note = "⚠ Lupa selesai istirahat — ditutup otomatis sistem.";
      await prisma.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          break_end: end,
          break_duration_min: maxMin,
          break_status: "EXCEEDED",
          owner_note: rec.owner_note ? `${rec.owner_note}\n${note}` : note,
        },
      });
      breaksClosed++;
    }

    // 3. Purge selfie lama per tenant.
    for (const set of settings) {
      const cutoff = new Date(now.getTime() - set.selfie_retention_days * 24 * 60 * 60 * 1000);
      const del = await prisma.attendanceSelfie.deleteMany({
        where: { tenant_id: set.tenant_id, created_at: { lt: cutoff } },
      });
      selfiesPurged += del.count;
    }

    return { autoClosed, breaksClosed, selfiesPurged, tenants: settings.length };
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
