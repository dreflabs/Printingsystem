import { NextResponse } from "next/server";
import { KIOSK_COOKIE } from "@/lib/kiosk";

export const dynamic = "force-dynamic";

/** POST /api/kiosk/deactivate → lepas cookie kiosk dari perangkat ini. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(KIOSK_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
