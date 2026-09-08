import type { Prisma } from "@prisma/client";
import { checkProductionReadiness, type ReadinessItem } from "@/lib/production-readiness";

export interface AutoReleaseResult {
  released: boolean;
  jobCodes: string[];
  /** alasan order belum bisa turun ke produksi (kosong kalau released) */
  missing: string[];
}

async function nextJobCode(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const startOfDay = new Date(y, now.getMonth(), now.getDate());
  const n = await tx.productionJob.count({ where: { tenant_id: tenantId, created_at: { gte: startOfDay } } });
  return `JOB-${y}${m}${d}-${String(n + 1).padStart(4, "0")}`;
}

/**
 * Coba turunkan order ke produksi tanpa aksi Admin. Dipanggil di dalam transaksi
 * caller, tepat setelah order menjadi CONFIRMED.
 *
 * - Idempotent: kalau order sudah punya ProductionJob, tidak melakukan apa-apa.
 * - Hanya bekerja saat `order.status === "CONFIRMED"`.
 * - Membuat 1 ProductionJob per item (status PRODUCTION_QUEUED, tanpa operator —
 *   operator mengklaim sendiri lewat SCAN 1). Mesin diambil dari
 *   `product.default_machine_id`.
 * - Kalau Completeness Gate gagal atau ada item tanpa mesin default yang ACTIVE,
 *   order dibiarkan CONFIRMED dan alasannya dikembalikan di `missing` (Admin bisa
 *   assign manual lewat form lama).
 */
export async function autoReleaseToProduction(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string
): Promise<AutoReleaseResult> {
  const order = await tx.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      items: { include: { product: { select: { unit: true, default_machine_id: true } } } },
      design_jobs: { select: { status: true } },
    },
  });
  if (!order) return { released: false, jobCodes: [], missing: ["Order tidak ditemukan"] };
  if (order.status !== "CONFIRMED") return { released: false, jobCodes: [], missing: [] };

  const existing = await tx.productionJob.count({ where: { order_id: orderId } });
  if (existing > 0) return { released: false, jobCodes: [], missing: [] };

  const designApproved = order.design_jobs.some((d) => d.status === "APPROVED");
  const approvedVersion = designApproved
    ? await tx.designVersion.findFirst({
        where: { design_job: { order_id: orderId }, approval_status: "APPROVED" },
        select: { file_path: true, file_name: true },
        orderBy: { version_no: "desc" },
      })
    : null;

  const total = Number(order.total);
  const dpRequired = Number(order.dp_required ?? Math.round(total * 0.5));

  const items: ReadinessItem[] = order.items
    .filter((it) => !it.retail_product_id) // item retail tidak lewat produksi
    .map((it) => ({
      label: it.description || "",
      productId: it.product_id,
      productUnit: it.product?.unit ?? null,
      defaultMachineId: it.product?.default_machine_id ?? null,
      quantity: it.quantity,
      size: it.size,
      materialId: it.material_id,
      unitPrice: Number(it.unit_price),
      totalPrice: Number(it.total_price),
    }));

  const gate = checkProductionReadiness({
    status: order.status,
    orderType: order.order_type,
    customerId: order.customer_id,
    customerName: order.customer?.name ?? null,
    customerContact: order.customer?.phone || order.customer?.email || null,
    deadline: order.deadline,
    discount: Number(order.discount),
    discountApprovedBy: order.discount_approved_by,
    paidAmount: Number(order.paid_amount),
    dpRequired,
    designApproved,
    designFilePresent: Boolean(approvedVersion?.file_path || approvedVersion?.file_name),
    items,
  });

  if (!gate.autoRoutable) {
    return { released: false, jobCodes: [], missing: gate.missing };
  }

  // Semua mesin default harus ACTIVE — kalau ada yang MAINTENANCE/INACTIVE,
  // biarkan Admin yang mengarahkan.
  const machineIds = [...new Set(items.map((it) => it.defaultMachineId as string).filter(Boolean))];
  const machines = await tx.machine.findMany({
    where: { id: { in: machineIds }, tenant_id: tenantId },
    select: { id: true, name: true, status: true },
  });
  const down = machines.find((m) => m.status !== "ACTIVE");
  if (down) {
    return { released: false, jobCodes: [], missing: [`Mesin default ${down.name} sedang ${down.status}`] };
  }

  const jobCodes: string[] = [];
  for (const it of items) {
    const code = await nextJobCode(tx, tenantId);
    await tx.productionJob.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        job_code: code,
        machine_id: it.defaultMachineId as string,
        operator_id: null,
        status: "PRODUCTION_QUEUED",
        priority: 1,
        planned_qty: it.quantity,
      },
    });
    jobCodes.push(code);
  }

  await tx.order.update({ where: { id: orderId }, data: { status: "PRODUCTION_ASSIGNED" } });
  return { released: true, jobCodes, missing: [] };
}
