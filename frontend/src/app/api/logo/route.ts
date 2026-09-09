import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { presignGet } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
    const tenant = await getCurrentTenant();
    if (!tenant) return NextResponse.json({ error: "Tenant tidak diketahui." }, { status: 400 });

    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key || !key.startsWith("logos/")) {
      return NextResponse.json({ error: "Invalid key." }, { status: 400 });
    }

    // Hanya presign, max-age 300 (5 menit)
    const signed = await presignGet(key, {
      expiresSec: 300,
    });
    
    return NextResponse.redirect(signed);
  } catch (e) {
    console.error("GET /api/logo:", e);
    const msg = e instanceof Error ? e.message : "Gagal memuat file.";
    const status = msg.includes("Sesi") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
