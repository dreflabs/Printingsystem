import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { resolveKioskDevice } from "@/lib/kiosk";
import { clientIpFromHeaders } from "@/lib/attendance";
import { performClockIn, performClockOut, PunchError } from "@/lib/attendance-punch";

export const dynamic = "force-dynamic";

/**
 * POST /api/kiosk/punch
 * body: { userId, pin, direction: "IN"|"OUT", lat?, lng?, accuracyM?, selfie? }
 */
export async function POST(req: Request) {
  const kiosk = await resolveKioskDevice();
  if (!kiosk) return NextResponse.json({ ok: false, error: "Perangkat belum diaktifkan." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const direction = body.direction === "OUT" ? "OUT" : body.direction === "IN" ? "IN" : null;
  if (!userId || !pin || !direction)
    return NextResponse.json({ ok: false, error: "Data tidak lengkap." }, { status: 400 });

  const rlKey = `kiosk-pin:${kiosk.deviceId}:${userId}`;
  const rl = rateLimit(rlKey, 5, 15 * 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { ok: false, error: `Terlalu banyak PIN salah. Coba lagi dalam ${Math.ceil(rl.retryAfterSec / 60)} menit.` },
      { status: 429 }
    );

  const user = await prisma.user.findFirst({
    where: { id: userId, tenant_id: kiosk.tenantId, active: true },
    select: { id: true, name: true, kiosk_pin_hash: true },
  });
  if (!user || !user.kiosk_pin_hash)
    return NextResponse.json({ ok: false, error: "PIN belum diatur untuk pegawai ini." }, { status: 400 });

  const pinOk = await bcrypt.compare(pin, user.kiosk_pin_hash);
  if (!pinOk) return NextResponse.json({ ok: false, error: "PIN salah." }, { status: 401 });
  resetRateLimit(rlKey);

  const setting = await prisma.tenantAttendanceSetting.upsert({
    where: { tenant_id: kiosk.tenantId },
    update: {},
    create: { tenant_id: kiosk.tenantId },
  });
  if (!setting.kiosk_enabled)
    return NextResponse.json({ ok: false, error: "Absen kiosk dinonaktifkan Owner." }, { status: 403 });

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const ctx = {
    tenantId: kiosk.tenantId,
    user: { id: user.id, name: user.name },
    setting,
    method: "KIOSK" as const,
    ip: clientIpFromHeaders(new Headers(req.headers)),
    deviceLabel: `Kiosk · ${kiosk.label}`,
    input: {
      lat: num(body.lat),
      lng: num(body.lng),
      accuracyM: num(body.accuracyM),
      selfie: typeof body.selfie === "string" ? body.selfie : null,
    },
  };

  try {
    if (direction === "IN") {
      const r = await performClockIn(ctx);
      return NextResponse.json({ ok: true, direction, name: user.name, status: r.status, lateMinutes: r.lateMinutes });
    }
    const r = await performClockOut(ctx);
    return NextResponse.json({ ok: true, direction, name: user.name, status: r.status });
  } catch (e) {
    if (e instanceof PunchError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    console.error("kiosk punch:", e);
    return NextResponse.json({ ok: false, error: "Gagal mencatat absen." }, { status: 500 });
  }
}
