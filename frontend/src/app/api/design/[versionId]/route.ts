import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { serveObject } from "@/lib/storage";
import { can } from "@/lib/permissions";

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
    const actor = await requireUser();
    const tenant = await getCurrentTenant();
    if (!tenant) return NextResponse.json({ error: "Tenant tidak diketahui." }, { status: 400 });

    const { versionId } = await params;
    const version = await prisma.designVersion.findFirst({
      where: { id: versionId, tenant_id: tenant.id },
      select: {
        file_path: true,
        file_name: true,
        approval_status: true,
        uploaded_by: true,
        design_job: { select: { designer_id: true, order_id: true } },
      },
    });
    if (!version || !version.file_path) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    }

    // File desain adalah aset tenant yang sensitif. Hak tenant saja tidak
    // cukup: Designer hanya boleh melihat job yang menjadi tanggung jawabnya,
    // sedangkan Operator/QC/Finishing hanya boleh melihat file approved pada
    // order yang memang sudah masuk tahap operasional.
    const isDesignStaff = actor.roles.some((r) => r === "owner" || r === "admin") || can(actor, "design.upload") || can(actor, "design.approve_walkin") || can(actor, "design.approve_online");
    const isJobDesigner = version.design_job.designer_id === actor.id;
    let allowed = isDesignStaff && (isJobDesigner || actor.roles.some((r) => r === "owner" || r === "admin"));

    if (!allowed && version.approval_status === "APPROVED") {
      if (can(actor, "production.execute")) {
        const assigned = await prisma.productionJob.findFirst({
          where: { tenant_id: tenant.id, order_id: version.design_job.order_id, operator_id: actor.id },
          select: { id: true },
        });
        allowed = !!assigned;
      }
      if (!allowed && (can(actor, "qc.submit") || can(actor, "finishing.execute"))) {
        const operational = await prisma.productionJob.findFirst({
          where: {
            tenant_id: tenant.id,
            order_id: version.design_job.order_id,
            status: { in: ["PRODUCTION_COMPLETE", "QC_PENDING", "QC_PASSED", "FINISHING_STARTED", "FINISHING_COMPLETE", "STORAGE_PENDING", "STORED", "READY_FOR_PICKUP", "IN_TRANSIT"] },
          },
          select: { id: true },
        });
        allowed = !!operational;
      }
    }
    if (!allowed) return NextResponse.json({ error: "Anda tidak memiliki akses ke file desain ini." }, { status: 403 });

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
