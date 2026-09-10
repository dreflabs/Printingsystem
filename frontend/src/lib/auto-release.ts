import type { Prisma } from "@prisma/client";
import { checkProductionReadiness, coveredDesignItemIds, type ReadinessItem } from "@/lib/production-readiness";

export interface AutoReleaseResult {
  released: boolean;
  jobCodes: string[];
  /** alasan order belum bisa turun ke produksi (kosong kalau released) */
  missing: string[];
  /** true = tertahan gatekeeper "wajib rilis Admin", bukan karena data kurang */
  awaitingAdminRelease?: boolean;
}

/** Sentinel yang disimpan di Order.auto_release_blocked saat gatekeeper aktif. */
export const AWAITING_ADMIN_RELEASE = "AWAITING_ADMIN_RELEASE";

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
 * Prioritas job dari deadline order:
 *   3 = mendesak  (deadline < 24 jam atau sudah lewat)
 *   2 = segera    (deadline < 3 hari)
 *   1 = normal    (deadline lebih jauh / tidak ada)
 * Dipakai untuk sort antrian operator (priority desc → deadline asc).
 */
export function priorityFromDeadline(deadline: Date | string | null): number {
  if (!deadline) return 1;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 24 * 3600 * 1000) return 3;
  if (ms < 3 * 24 * 3600 * 1000) return 2;
  return 1;
}

function blockedPayload(missing: string[]): string {
  return JSON.stringify(missing);
}

/**
 * Coba turunkan order ke produksi tanpa aksi Admin. Dipanggil di dalam transaksi
 * caller, tepat setelah order menjadi CONFIRMED.
 *
 * - Idempotent: kalau order sudah punya ProductionJob, tidak melakukan apa-apa.
 * - Hanya bekerja saat `order.status === "CONFIRMED"`.
 * - Satu ProductionJob per MESIN (item dengan mesin default sama digabung, qty
 *   dijumlah). Mesin diambil dari `product.default_machine_id`.
 * - Kalau mesin punya `default_operator_id` yang masih aktif → job di-pin ke dia
 *   (status PRODUCTION_ASSIGNED). Kalau tidak → PRODUCTION_QUEUED tanpa operator
 *   (operator klaim sendiri lewat SCAN 1).
 * - `priority` diturunkan dari deadline order.
 * - Kalau tenant mengaktifkan `require_admin_production_release`, order dibiarkan
 *   CONFIRMED + ditandai AWAITING_ADMIN_RELEASE (kecuali `opts.bypassGatekeeper`).
 * - Kalau Completeness Gate gagal / mesin default tidak ACTIVE, order dibiarkan
 *   CONFIRMED dan `Order.auto_release_blocked` diisi daftar alasannya (dipakai
 *   panel "Order Tertahan" di dashboard Admin). Sukses → kolom itu dikosongkan.
 */
export async function autoReleaseToProduction(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  opts?: { bypassGatekeeper?: boolean }
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
  const approvedVersions = await tx.designVersion.findMany({
    where: { design_job: { order_id: orderId }, approval_status: "APPROVED" },
    select: { order_item_id: true, approval_status: true, file_path: true, file_name: true },
  });
  const nonRetailItemIds = order.items.filter((it) => !it.retail_product_id).map((it) => it.id);
  const designReadyItemIds = coveredDesignItemIds(approvedVersions, nonRetailItemIds);

  const total = Number(order.total);
  const dpRequired = Number(order.dp_required ?? Math.round(total * 0.5));

  const items: ReadinessItem[] = order.items
    .filter((it) => !it.retail_product_id) // item retail tidak lewat produksi
    .map((it) => ({
      id: it.id,
      label: it.description || "",
      productId: it.product_id,
      productUnit: it.product?.unit ?? null,
      defaultMachineId: it.product?.default_machine_id ?? null,
      quantity: it.quantity,
      size: it.size,
      materialId: it.material_id,
      unitPrice: Number(it.unit_price),
      totalPrice: Number(it.total_price),
      deadline: it.deadline ?? null,
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
    designReadyItemIds,
    items,
  });

  if (!gate.autoRoutable) {
    await tx.order.update({
      where: { id: orderId },
      data: { auto_release_blocked: blockedPayload(gate.missing) },
    });
    return { released: false, jobCodes: [], missing: gate.missing };
  }

  // Semua mesin default harus ACTIVE — kalau ada yang MAINTENANCE/INACTIVE,
  // biarkan Admin yang mengarahkan.
  const machineIds = [...new Set(items.map((it) => it.defaultMachineId as string).filter(Boolean))];
  const machines = await tx.machine.findMany({
    where: { id: { in: machineIds }, tenant_id: tenantId },
    select: { id: true, name: true, status: true, default_operator_id: true },
  });
  const down = machines.find((m) => m.status !== "ACTIVE");
  if (down) {
    const missing = [`Mesin default ${down.name} sedang ${down.status}`];
    await tx.order.update({
      where: { id: orderId },
      data: { auto_release_blocked: blockedPayload(missing) },
    });
    return { released: false, jobCodes: [], missing };
  }

  // Gatekeeper: order lengkap & routable, tapi tenant minta Admin menekan
  // "Rilis ke Produksi" dulu. Simpan sentinel, jangan buat job.
  if (!opts?.bypassGatekeeper) {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { require_admin_production_release: true },
    });
    if (tenant?.require_admin_production_release) {
      await tx.order.update({
        where: { id: orderId },
        data: { auto_release_blocked: AWAITING_ADMIN_RELEASE },
      });
      return {
        released: false,
        jobCodes: [],
        missing: ["Menunggu Admin menekan \"Rilis ke Produksi\""],
        awaitingAdminRelease: true,
      };
    }
  }

  // Operator default per mesin (hanya yang masih aktif).
  const defaultOpIds = [
    ...new Set(machines.map((m) => m.default_operator_id).filter((v): v is string => !!v)),
  ];
  const activeOps = defaultOpIds.length
    ? await tx.user.findMany({
        where: { id: { in: defaultOpIds }, tenant_id: tenantId, active: true },
        select: { id: true },
      })
    : [];
  const activeOpSet = new Set(activeOps.map((u) => u.id));

  // Gabungkan item per mesin default → 1 job per mesin, qty dijumlah.
  // Deadline job = yang PALING AWAL di antara item-itemnya (fallback deadline order).
  const qtyByMachine = new Map<string, number>();
  const deadlineByMachine = new Map<string, Date | null>();
  const orderDeadline = order.deadline ? new Date(order.deadline) : null;
  for (const it of items) {
    const mid = it.defaultMachineId as string;
    qtyByMachine.set(mid, (qtyByMachine.get(mid) ?? 0) + it.quantity);
    const d = it.deadline ? new Date(it.deadline) : orderDeadline;
    const cur = deadlineByMachine.has(mid) ? deadlineByMachine.get(mid)! : undefined;
    if (cur === undefined) deadlineByMachine.set(mid, d);
    else if (d && (!cur || d < cur)) deadlineByMachine.set(mid, d);
  }

  const machineById = new Map(machines.map((m) => [m.id, m]));

  const jobCodes: string[] = [];
  for (const [machineId, plannedQty] of qtyByMachine) {
    const machine = machineById.get(machineId);
    const defOp = machine?.default_operator_id ?? null;
    const pinned = defOp && activeOpSet.has(defOp);
    const jobDeadline = deadlineByMachine.get(machineId) ?? orderDeadline;
    const code = await nextJobCode(tx, tenantId);
    await tx.productionJob.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        job_code: code,
        machine_id: machineId,
        operator_id: pinned ? defOp : null,
        status: pinned ? "PRODUCTION_ASSIGNED" : "PRODUCTION_QUEUED",
        priority: priorityFromDeadline(jobDeadline),
        deadline: jobDeadline,
        planned_qty: plannedQty,
      },
    });
    jobCodes.push(code);
  }

  await tx.order.update({
    where: { id: orderId },
    data: { status: "PRODUCTION_ASSIGNED", auto_release_blocked: null },
  });
  return { released: true, jobCodes, missing: [] };
}
