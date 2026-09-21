import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { getPlatformActor } from "@/lib/platform";
import { serveObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/payment-proof/<proofId>[?download=1]
 *
 * Menyajikan bukti transfer ke dua pihak yang berhak: Super Admin (panel
 * platform) dan anggota tenant pemilik invoice. Tidak memakai route
 * local-storage karena route itu mensyaratkan sesi tenant — Super Admin tidak
 * punya sesi tenant.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const proof = await prisma.paymentProof.findUnique({
      where: { id },
      select: { file_key: true, file_name: true, tenant_id: true },
    });
    if (!proof) return NextResponse.json({ error: "Bukti pembayaran tidak ditemukan." }, { status: 404 });

    const platformActor = await getPlatformActor();
    let allowed = !!platformActor;

    if (!allowed) {
      try {
        await requireUser();
        const tenant = await getCurrentTenant();
        allowed = !!tenant && tenant.id === proof.tenant_id;
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return NextResponse.json({ error: "Anda tidak memiliki akses ke file ini." }, { status: 403 });

    const url = new URL(req.url);
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return serveObject(proof.file_key, {
      fileName: proof.file_name ?? "bukti-pembayaran",
      disposition,
      expiresSec: 120,
    });
  } catch (e) {
    console.error("GET /api/payment-proof/[id]:", e);
    const msg = e instanceof Error ? e.message : "Gagal memuat file.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
