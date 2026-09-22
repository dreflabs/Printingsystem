import { prisma } from "@/lib/prisma";
import { assertJobAuth, runJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/break-warnings
 *
 * Pantau istirahat berjalan (ABSENSI-FINGERPRINT.md):
 *  - 15 menit sebelum batas tenant: WA ke pegawai.
 *  - lewat batas tenant & belum "Selesai Istirahat": status EXCEEDED + WA ke Owner.
 * Dijalankan tiap beberapa menit oleh cron.
 *
 * Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 */

function hhmm(d: Date): string {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Antrekan pesan absensi (dikirim + dicatat + diulang oleh job dispatcher). */
async function queueWa(tenantId: string, recipient: string, templateCode: string, body: string) {
  if (!recipient) return;
  await prisma.notificationEvent.create({
    data: {
      tenant_id: tenantId,
      event_type: templateCode,
      channel: "WHATSAPP",
      recipient,
      template_code: templateCode,
      body,
      status: "PENDING",
    },
  });
}

async function handle(): Promise<Response> {
  return runJob("break-warnings", async () => {
    const now = Date.now();
    const settings = await prisma.tenantAttendanceSetting.findMany();
    const byTenant = new Map(settings.map((s) => [s.tenant_id, s]));

    const active = await prisma.attendanceRecord.findMany({
      where: { break_start: { not: null }, break_end: null, user: { attendance_eligible: true } },
      include: { user: { select: { name: true, phone: true } } },
    });

    let warn45 = 0;
    let exceeded = 0;
    const exceededByTenant = new Map<string, { name: string; since: string }[]>();

    for (const rec of active) {
      if (!rec.break_start) continue;
      const elapsedMin = Math.floor((now - rec.break_start.getTime()) / 60000);
      const maxMin = byTenant.get(rec.tenant_id)?.break_max_min ?? 60;
      const warnAtMin = Math.max(1, maxMin - 15);
      const name = rec.user?.name ?? rec.employee_name;

      if (elapsedMin >= warnAtMin && !rec.warning_sent_at) {
        if (rec.user?.phone) {
          await queueWa(rec.tenant_id, rec.user.phone, "BREAK_WARNING", `Istirahat Anda berakhir dalam 15 menit (batas ${maxMin} menit). Silakan kembali ke tempat kerja.`);
        }
        await prisma.attendanceRecord.update({
          where: { id: rec.id },
          data: { warning_sent_at: new Date() },
        });
        warn45++;
      }

      if (elapsedMin >= maxMin && rec.break_status !== "EXCEEDED") {
        await prisma.attendanceRecord.update({
          where: { id: rec.id },
          data: { break_status: "EXCEEDED" },
        });
        if (rec.user?.phone) {
          await queueWa(rec.tenant_id, rec.user.phone, "BREAK_EXCEEDED", `Istirahat Anda sudah melebihi batas ${maxMin} menit. Segera kembali.`);
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
          await queueWa(tenantId, o.phone, "BREAK_EXCEEDED_OWNER", `${e.name} sudah istirahat lebih dari ${byTenant.get(tenantId)?.break_max_min ?? 60} menit sejak ${e.since}.`);
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
