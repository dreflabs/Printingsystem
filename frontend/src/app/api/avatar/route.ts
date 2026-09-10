import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { serveObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
    const tenant = await getCurrentTenant();
    if (!tenant) return NextResponse.json({ error: "Tenant tidak diketahui." }, { status: 400 });

    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key || !key.startsWith("avatars/")) {
      return NextResponse.json({ error: "Invalid key." }, { status: 400 });
    }

    return serveObject(key, { expiresSec: 300 });
  } catch (e) {
    console.error("GET /api/avatar:", e);
    const msg = e instanceof Error ? e.message : "Gagal memuat file.";
    const status = msg.includes("Sesi") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
