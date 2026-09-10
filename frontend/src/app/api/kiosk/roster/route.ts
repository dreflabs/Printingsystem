import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveKioskDevice } from "@/lib/kiosk";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  designer_sales: "Designer / Setting",
  operator: "Operator",
  gudang: "Finishing & Gudang",
};

/** GET /api/kiosk/roster → daftar pegawai + status absen hari ini untuk layar kiosk. */
export async function GET() {
  const kiosk = await resolveKioskDevice();
  if (!kiosk) return NextResponse.json({ ok: false, error: "Perangkat belum diaktifkan." }, { status: 401 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [tenant, setting, users, records] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: kiosk.tenantId }, select: { name: true } }),
    prisma.tenantAttendanceSetting.upsert({
      where: { tenant_id: kiosk.tenantId },
      update: {},
      create: { tenant_id: kiosk.tenantId },
    }),
    prisma.user.findMany({
      where: { tenant_id: kiosk.tenantId, active: true, kiosk_pin_hash: { not: null } },
      select: { id: true, name: true, role: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { tenant_id: kiosk.tenantId, date: { gte: startOfToday, lt: endOfToday } },
      select: { user_id: true, check_in: true, check_out: true, break_start: true, break_end: true },
    }),
  ]);

  const byUser = new Map(records.filter((r) => r.user_id).map((r) => [r.user_id as string, r]));

  return NextResponse.json({
    ok: true,
    device: { label: kiosk.label },
    tenantName: tenant?.name ?? "",
    selfieRequired: setting.selfie_required,
    kioskEnabled: setting.kiosk_enabled,
    employees: users.map((u) => {
      const rec = byUser.get(u.id);
      return {
        id: u.id,
        name: u.name,
        roleLabel: ROLE_LABEL[u.role.name] ?? u.role.name,
        checkedIn: !!rec?.check_in,
        checkedOut: !!rec?.check_out,
        onBreak: !!rec?.break_start && !rec?.break_end,
      };
    }),
  });
}
