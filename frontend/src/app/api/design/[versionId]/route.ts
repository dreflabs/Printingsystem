import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { serveObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/design/<versionId>[?download=1]
 *
 * Redirect ke presigned GET R2 berumur pendek, setelah memastikan pemanggil
 * adalah anggota tenant pemilik versi desain itu. `?download=1` memaksa unduh;
 * default pratinjau inline (PDF/gambar terbuka di browser).
 *
 * Baris lama yang file_path-nya berupa URL penuh (http…) diteruskan apa adanya.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    await requireUser();
    const tenant = await getCurrentTenant();
    if (!tenant) return NextResponse.json({ error: "Tenant tidak diketahui." }, { status: 400 });

    const { versionId } = await params;
    const version = await prisma.designVersion.findFirst({
      where: { id: versionId, tenant_id: tenant.id },
      select: { file_path: true, file_name: true },
    });
    if (!version || !version.file_path) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    }

    // Data lama: link/teks bebas.
    if (/^https?:\/\//i.test(version.file_path)) {
      return NextResponse.redirect(version.file_path);
    }

    const url = new URL(_req.url);
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return serveObject(version.file_path, {
      fileName: version.file_name ?? "desain",
      disposition,
      expiresSec: 120,
    });
  } catch (e) {
    console.error("GET /api/design/[versionId]:", e);
    const msg = e instanceof Error ? e.message : "Gagal memuat file.";
    const status = msg.includes("Sesi") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
