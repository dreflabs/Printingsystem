import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { KIOSK_COOKIE, KIOSK_MAX_AGE_SEC, hashKioskToken, kioskCookieSecure } from "@/lib/kiosk";
import { clientIpFromHeaders } from "@/lib/attendance";

export const dynamic = "force-dynamic";

/** POST /api/kiosk/activate  { token }  → set cookie perangkat kiosk. */
export async function POST(req: Request) {
  const ip = clientIpFromHeaders(new Headers(req.headers)) ?? "unknown";
  const rl = rateLimit(`kiosk-activate:${ip}`, 10, 15 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }
  if (!token) return NextResponse.json({ ok: false, error: "Token wajib diisi." }, { status: 400 });

  const device = await prisma.kioskDevice.findFirst({
    where: { token_hash: hashKioskToken(token), active: true },
    select: { id: true, label: true },
  });
  if (!device) return NextResponse.json({ ok: false, error: "Token tidak dikenal atau perangkat dicabut." }, { status: 401 });

  await prisma.kioskDevice.update({ where: { id: device.id }, data: { last_seen_at: new Date() } });

  const res = NextResponse.json({ ok: true, label: device.label });
  res.cookies.set(KIOSK_COOKIE, token, {
    httpOnly: true,
    secure: await kioskCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: KIOSK_MAX_AGE_SEC,
  });
  return res;
}
