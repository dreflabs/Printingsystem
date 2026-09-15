import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { presignGet } from "@/lib/r2";
import { assertTenantKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/logo?key=tenants/<tenantId>/logo-<ts>.<ext>
 *
 * `key` datang dari client (disimpan di Tenant.logo_url) → WAJIB divalidasi
 * milik tenant pemanggil. Tanpa ini, `key` sembarang bisa dipresign & di-redirect
 * (baca objek lintas-tenant / traversal).
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const tenant = await getCurrentTenant();
    if (!tenant) return NextResponse.json({ error: "Tenant tidak diketahui." }, { status: 400 });

    const raw = new URL(req.url).searchParams.get("key") ?? "";
    let key: string;
    try {
      key = assertTenantKey(raw, tenant.id, ["tenants", "logos"]);
    } catch {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    // Hanya presign, max-age 300 (5 menit)
    const signed = await presignGet(key, { expiresSec: 300 });
    return NextResponse.redirect(signed);
  } catch (e) {
    console.error("GET /api/logo:", e);
    const msg = e instanceof Error ? e.message : "Gagal memuat file.";
    const status = msg.includes("Sesi") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
