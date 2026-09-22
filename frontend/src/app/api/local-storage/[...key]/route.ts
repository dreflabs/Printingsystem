import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import {
  storageMode,
  assertSafeKey,
  writeLocalObject,
  serveObject,
} from "@/lib/storage";

/**
 * Penyimpanan objek LOKAL — dipakai untuk dev tanpa R2, ATAU sebagai driver
 * produksi resmi di VPS yang sengaja tidak pakai R2 (`STORAGE_DRIVER=local` +
 * `LOCAL_STORAGE_DIR` ke volume persisten, lihat DEPLOY.md §6c).
 *
 *   PUT /api/local-storage/<key>   → tulis body ke LOCAL_STORAGE_DIR/<key>
 *   GET /api/local-storage/<key>   → kirim isi file
 *
 * Aktif HANYA saat `storageMode() === "local"`. Kalau driver aktif adalah R2
 * ("r2") atau storage belum dikonfigurasi ("none"), route ini menjawab 404 —
 * jadi tidak menambah permukaan serangan saat mode lokal sedang tidak dipakai.
 * Key wajib ter-scope ke tenant pemanggil (segmen ke-2 = tenant.id),
 * konsisten dengan pola key di actions (`tenants/<id>/…`, `avatars/<id>/…`).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function keyFromParams(parts: string[]): string {
  return assertSafeKey(parts.map((p) => decodeURIComponent(p)).join("/"));
}

function assertTenantScoped(key: string, tenantId: string) {
  if (key.split("/")[1] !== tenantId) {
    throw new Error("Akses ke objek ini ditolak.");
  }
}

async function guard() {
  if (storageMode() !== "local") {
    return {
      error: NextResponse.json(
        { error: "Penyimpanan lokal nonaktif." },
        { status: 404 }
      ),
    };
  }
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return {
      error: NextResponse.json(
        { error: "Tenant tidak diketahui." },
        { status: 400 }
      ),
    };
  }
  return { tenant };
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const key = keyFromParams((await params).key);
    assertTenantScoped(key, g.tenant.id);
    await writeLocalObject(key, await req.arrayBuffer());
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("PUT /api/local-storage:", e);
    const msg = e instanceof Error ? e.message : "Gagal menyimpan file.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const key = keyFromParams((await params).key);
    assertTenantScoped(key, g.tenant.id);
    const url = new URL(req.url);
    const download =
      url.searchParams.get("download") === "1" ||
      url.searchParams.get("disposition") === "attachment";
    return serveObject(key, {
      disposition: download ? "attachment" : "inline",
      fileName: url.searchParams.get("filename") ?? undefined,
    });
  } catch (e) {
    console.error("GET /api/local-storage:", e);
    const msg = e instanceof Error ? e.message : "Gagal memuat file.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
