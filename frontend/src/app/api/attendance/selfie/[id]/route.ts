import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/selfie/[id] → gambar selfie absen.
 * Owner/Admin saja, dibatasi tenant. Tidak di-cache (data personal).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, tenant, actor] = await Promise.all([params, requireTenant(), requireUser()]);
    if (!actor.roles.includes("owner") && !actor.roles.includes("admin")) {
      return new Response("Terlarang", { status: 403 });
    }
    const selfie = await prisma.attendanceSelfie.findFirst({
      where: { id, tenant_id: tenant.id },
      select: { mime: true, bytes: true },
    });
    if (!selfie) return new Response("Tidak ditemukan", { status: 404 });

    return new Response(new Uint8Array(selfie.bytes), {
      headers: {
        "content-type": selfie.mime || "image/webp",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("Tidak diizinkan", { status: 401 });
  }
}
