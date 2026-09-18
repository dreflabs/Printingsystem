import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { serveObject, assertTenantKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/avatar?key=avatars/<tenantId>/<userId>-<ts>.<ext>
 *
 * `key` datang dari client → WAJIB divalidasi milik tenant pemanggil, bukan
 * sekadar cek prefiks. Tanpa ini, user tenant A bisa membaca foto pegawai
 * tenant B (IDOR). Pola sama dipakai di /api/local-storage.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const tenant = await getCurrentTenant();
    if (!tenant) return NextResponse.json({ error: "Tenant tidak diketahui." }, { status: 400 });

    const raw = new URL(req.url).searchParams.get("key") ?? "";
    let key: string;
    try {
      key = assertTenantKey(raw, tenant.id, ["avatars"]);
    } catch {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    return serveObject(key, { expiresSec: 300 });
  } catch (e) {
    console.error("GET /api/avatar:", e);
    const msg = e instanceof Error ? e.message : "Gagal memuat file.";
    const status = msg.includes("Sesi") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
