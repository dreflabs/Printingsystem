"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { ok, fail } from "@/types";

const num = (v: unknown) => Number(v ?? 0);

// ─────────────────────────────────────────────────────────────
// OPERATOR
// ─────────────────────────────────────────────────────────────

/** Job produksi untuk operator yang login: aktif + antrian assigned. */
export async function getOperatorJobs() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const jobs = await prisma.productionJob.findMany({
      where: {
        tenant_id: tenant.id,
        operator_id: actor.id,
        status: { in: ["PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_PAUSED"] },
      },
      orderBy: [{ priority: "desc" }, { created_at: "asc" }],
      include: {
        machine: { select: { name: true, machine_code: true } },
        order: { select: { order_code: true, deadline: true, customer: { select: { name: true } } } },
      },
    });

    return ok(
      jobs.map((j) => ({
        jobCode: j.job_code,
        orderCode: j.order.order_code,
        customerName: j.order.customer?.name ?? "-",
        machine: j.machine.name,
        status: j.status,
        plannedQty: j.planned_qty,
        actualQty: j.actual_qty,
        deadline: j.order.deadline,
        startedAt: j.actual_start,
      }))
    );
  } catch (e) {
    console.error("getOperatorJobs:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat job operator.");
  }
}

// ─────────────────────────────────────────────────────────────
// GUDANG (QC / Finishing / Storage)
// ─────────────────────────────────────────────────────────────

export async function getGudangQueues() {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const jobs = await prisma.productionJob.findMany({
      where: {
        tenant_id: tenant.id,
        status: { in: ["PRODUCTION_COMPLETE", "QC_PASSED", "FINISHING_STARTED", "FINISHING_COMPLETE", "STORED"] },
      },
      orderBy: { updated_at: "asc" },
      include: {
        order: { select: { order_code: true, status: true, deadline: true, customer: { select: { name: true } } } },
      },
    });

    const shape = (j: (typeof jobs)[number]) => ({
      jobCode: j.job_code,
      orderCode: j.order.order_code,
      orderStatus: j.order.status,
      customerName: j.order.customer?.name ?? "-",
      status: j.status,
      plannedQty: j.planned_qty,
      actualQty: j.actual_qty,
      deadline: j.order.deadline,
    });

    return ok({
      qcQueue: jobs.filter((j) => j.status === "PRODUCTION_COMPLETE").map(shape),
      finishingQueue: jobs.filter((j) => j.status === "QC_PASSED" || j.status === "FINISHING_STARTED").map(shape),
      storageQueue: jobs.filter((j) => j.status === "FINISHING_COMPLETE").map(shape),
      stored: jobs.filter((j) => j.status === "STORED").map(shape),
    });
  } catch (e) {
    console.error("getGudangQueues:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat antrian gudang.");
  }
}

// ─────────────────────────────────────────────────────────────
// DESIGNER
// ─────────────────────────────────────────────────────────────

export async function getDesignQueue() {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const djs = await prisma.designJob.findMany({
      where: { tenant_id: tenant.id, status: { in: ["PENDING", "DESIGNING", "APPROVED"] } },
      orderBy: { updated_at: "desc" },
      include: {
        designer: { select: { name: true } },
        order: { select: { order_code: true, status: true, deadline: true, customer: { select: { name: true } } } },
        versions: { orderBy: { version_no: "desc" }, take: 1 },
      },
    });

    return ok(
      djs.map((d) => ({
        orderId: d.order_id,
        orderCode: d.order.order_code,
        orderStatus: d.order.status,
        customerName: d.order.customer?.name ?? "-",
        designer: d.designer.name,
        method: d.approval_method,
        status: d.status,
        currentVersion: d.current_version,
        latestVersionStatus: d.versions[0]?.approval_status ?? null,
        deadline: d.order.deadline,
      }))
    );
  } catch (e) {
    console.error("getDesignQueue:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat antrian desain.");
  }
}

// ─────────────────────────────────────────────────────────────
// OWNER — antrian keputusan + ringkasan
// ─────────────────────────────────────────────────────────────

export async function getOwnerQueues() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner" && actor.role !== "admin") return fail("Hanya Owner/Admin yang boleh melihat data ini.");

    const [pendingDiscounts, reworkPending, auditsPending, lowStock, overdueCount, incidents] = await Promise.all([
      prisma.order.findMany({
        where: { tenant_id: tenant.id, discount: { gt: 0 }, discount_approved_by: null, status: { notIn: ["CANCELLED"] } },
        select: { id: true, order_code: true, discount: true, discount_reason: true, total: true, customer: { select: { name: true } } },
      }),
      prisma.productionJob.findMany({
        where: { tenant_id: tenant.id, status: "FAILED_REWORK" },
        select: { job_code: true, rework_reason: true, order: { select: { order_code: true } } },
      }),
      prisma.order.findMany({
        where: { tenant_id: tenant.id, status: "FINAL_AUDIT_COMPLETE" },
        select: { id: true, order_code: true, customer: { select: { name: true } } },
      }),
      prisma.material.findMany({
        where: { tenant_id: tenant.id, active: true },
        select: { name: true, current_stock: true, min_stock: true, unit_stock: true },
      }),
      prisma.order.count({
        where: { tenant_id: tenant.id, deadline: { lt: new Date() }, status: { notIn: ["CLOSED", "CANCELLED", "PICKED_UP"] } },
      }),
      prisma.order.count({ where: { tenant_id: tenant.id, status: "INCIDENT" } }),
    ]);

    return ok({
      pendingDiscounts: pendingDiscounts.map((o) => ({
        orderId: o.id,
        orderCode: o.order_code,
        customerName: o.customer?.name ?? "-",
        discount: num(o.discount),
        total: num(o.total),
        reason: o.discount_reason,
      })),
      reworkPending: reworkPending.map((j) => ({
        jobCode: j.job_code,
        orderCode: j.order.order_code,
        reason: j.rework_reason,
      })),
      auditsPending: auditsPending.map((o) => ({ orderId: o.id, orderCode: o.order_code, customerName: o.customer?.name ?? "-" })),
      lowStock: lowStock
        .filter((m) => num(m.current_stock) <= num(m.min_stock))
        .map((m) => ({ name: m.name, current: num(m.current_stock), min: num(m.min_stock), unit: m.unit_stock })),
      overdueCount,
      incidentCount: incidents,
    });
  } catch (e) {
    console.error("getOwnerQueues:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat antrian owner.");
  }
}

const IN_PROGRESS = [
  "PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_COMPLETE",
  "QC_PENDING", "QC_PASSED", "QC_REWORK_PENDING",
  "FINISHING_STARTED", "FINISHING_COMPLETE", "STORAGE_PENDING", "STORED",
];

/** Dashboard Owner lengkap — KPI, semua panel alert, pipeline, absensi, audit. */
export async function getOwnerDashboard() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner" && actor.role !== "admin") return fail("Hanya Owner/Admin yang boleh melihat data ini.");

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const T = { tenant_id: tenant.id };

    const [
      ordersToday, readyPickup, produksiAktif, omsetAgg,
      pendingDiscounts, auditsPending, reworkPending, cancelRequests, overdue,
      lowStockRaw, waFailed, wasteJobs, orphanMovements, reassignLogs,
      pipelineJobs, attendanceToday, activeUsers,
    ] = await Promise.all([
      prisma.order.count({ where: { ...T, created_at: { gte: startOfDay } } }),
      prisma.order.count({ where: { ...T, status: "READY_FOR_PICKUP" } }),
      prisma.productionJob.count({ where: { ...T, status: { in: ["PRODUCTION_STARTED", "FINISHING_STARTED"] } } }),
      prisma.payment.aggregate({ where: { ...T, status: "CONFIRMED", paid_at: { gte: startOfMonth } }, _sum: { amount: true } }),

      prisma.order.findMany({
        where: { ...T, discount: { gt: 0 }, discount_approved_by: null, status: { notIn: ["CANCELLED"] } },
        select: { id: true, order_code: true, discount: true, discount_reason: true, total: true, customer: { select: { name: true } } },
      }),
      prisma.order.findMany({
        where: { ...T, status: "FINAL_AUDIT_COMPLETE" },
        select: { id: true, order_code: true, customer: { select: { name: true } } },
      }),
      prisma.productionJob.findMany({
        where: { ...T, status: "FAILED_REWORK" },
        select: { job_code: true, rework_reason: true, rework_count: true, order: { select: { order_code: true } } },
      }),
      prisma.order.findMany({
        where: { ...T, cancellation_reason: { not: null }, cancelled_at: null, status: { notIn: ["CANCELLED", "DRAFT"] } },
        select: { id: true, order_code: true, status: true, cancellation_reason: true, paid_amount: true, customer: { select: { name: true } } },
      }),
      prisma.order.findMany({
        where: { ...T, deadline: { lt: now }, status: { notIn: ["CLOSED", "CANCELLED", "PICKED_UP"] } },
        orderBy: { deadline: "asc" },
        select: { id: true, order_code: true, deadline: true, status: true, customer: { select: { name: true } } },
      }),
      prisma.material.findMany({ where: { ...T, active: true }, select: { name: true, current_stock: true, min_stock: true, unit_stock: true } }),
      prisma.notificationEvent.findMany({
        where: { ...T, status: { in: ["FAILED", "RETRY"] } },
        orderBy: { created_at: "desc" },
        take: 10,
        select: { id: true, event_type: true, template_code: true, retry_count: true, order: { select: { order_code: true } }, customer: { select: { name: true } } },
      }),
      prisma.productionJob.findMany({
        where: { ...T, waste_qty: { gt: 0 } },
        select: { job_code: true, actual_qty: true, waste_qty: true, waste_reason: true, machine: { select: { name: true } } },
      }),
      prisma.materialMovement.count({ where: { ...T, job_id: null, movement_type: { in: ["OUT", "WASTE"] } } }),
      prisma.auditLog.groupBy({
        by: ["entity_id"],
        where: { ...T, action: "PRODUCTION_JOB_REASSIGNED", created_at: { gte: dayAgo } },
        _count: { _all: true },
      }),
      prisma.productionJob.findMany({ where: { ...T, status: { in: IN_PROGRESS } }, select: { status: true } }),
      prisma.attendanceRecord.findMany({ where: { ...T, date: { gte: startOfDay } }, select: { check_in_status: true, user_id: true } }),
      prisma.user.count({ where: { ...T, active: true } }),
    ]);

    const [machines, operators] = await Promise.all([
      prisma.machine.findMany({ where: { ...T, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { ...T, active: true, role: { name: "operator" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);

    const bucket = (s: string) =>
      ["PRODUCTION_ASSIGNED", "PRODUCTION_STARTED"].includes(s) ? "produksi"
        : ["PRODUCTION_COMPLETE", "QC_PENDING"].includes(s) ? "qc"
        : ["QC_PASSED", "FINISHING_STARTED"].includes(s) ? "finishing"
        : ["FINISHING_COMPLETE", "STORAGE_PENDING"].includes(s) ? "storage"
        : s === "STORED" ? "stored" : "lainnya";
    const pipeline = { produksi: 0, qc: 0, finishing: 0, storage: 0, stored: 0, siapAmbil: readyPickup };
    for (const j of pipelineJobs) {
      const b = bucket(j.status);
      if (b in pipeline) (pipeline as Record<string, number>)[b]++;
    }

    const highWaste = wasteJobs
      .map((j) => {
        const total = j.actual_qty + j.waste_qty;
        return { jobCode: j.job_code, machine: j.machine.name, ratio: total > 0 ? j.waste_qty / total : 0, wasteQty: j.waste_qty, reason: j.waste_reason };
      })
      .filter((x) => x.ratio > 0.2);

    const attendedIds = new Set(attendanceToday.filter((a) => a.user_id).map((a) => a.user_id));

    return ok({
      kpi: {
        ordersToday,
        readyPickup,
        produksiAktif,
        omsetBulanIni: num(omsetAgg._sum.amount),
      },
      pendingDiscounts: pendingDiscounts.map((o) => ({
        orderId: o.id, orderCode: o.order_code, customerName: o.customer?.name ?? "-",
        discount: num(o.discount), total: num(o.total), reason: o.discount_reason,
      })),
      auditsPending: auditsPending.map((o) => ({ orderId: o.id, orderCode: o.order_code, customerName: o.customer?.name ?? "-" })),
      reworkPending: reworkPending.map((j) => ({ jobCode: j.job_code, orderCode: j.order.order_code, reason: j.rework_reason, reworkCount: j.rework_count })),
      cancelRequests: cancelRequests.map((o) => ({
        orderId: o.id, orderCode: o.order_code, orderStatus: o.status,
        reason: o.cancellation_reason, paidAmount: num(o.paid_amount), customerName: o.customer?.name ?? "-",
      })),
      reassignPending: reassignLogs.filter((r) => r._count._all >= 2).map((r) => ({ jobCode: r.entity_id, count: r._count._all })),
      overdue: overdue.map((o) => ({ orderId: o.id, orderCode: o.order_code, deadline: o.deadline, status: o.status, customerName: o.customer?.name ?? "-" })),
      waFailed: waFailed.map((n) => ({
        id: n.id, eventType: n.event_type, template: n.template_code, retryCount: n.retry_count,
        orderCode: n.order.order_code, customerName: n.customer?.name ?? "-",
      })),
      lowStock: lowStockRaw
        .filter((m) => num(m.current_stock) <= num(m.min_stock))
        .map((m) => ({ name: m.name, current: num(m.current_stock), min: num(m.min_stock), unit: m.unit_stock })),
      anomalies: {
        highWaste,
        orphanMovements,
      },
      pipeline,
      attendance: {
        present: attendanceToday.length,
        late: attendanceToday.filter((a) => a.check_in_status === "LATE").length,
        notCheckedIn: Math.max(0, activeUsers - attendedIds.size),
      },
      reassignOptions: { machines, operators },
    });
  } catch (e) {
    console.error("getOwnerDashboard:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat dashboard owner.");
  }
}

/** Data halaman Admin — Produksi: KPI, status mesin, semua job, opsi reassign, low-stock. */
export async function getProductionOverview() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner" && actor.role !== "admin") return fail("Hanya Owner/Admin yang boleh melihat data ini.");
    const T = { tenant_id: tenant.id };

    const [jobs, machines, materials, operators] = await Promise.all([
      prisma.productionJob.findMany({
        where: T,
        orderBy: { created_at: "desc" },
        take: 200,
        include: {
          machine: { select: { id: true, name: true, machine_code: true, status: true } },
          operator: { select: { id: true, name: true } },
          order: { select: { order_code: true, deadline: true, customer: { select: { name: true } } } },
        },
      }),
      prisma.machine.findMany({ where: T, orderBy: { name: "asc" } }),
      prisma.material.findMany({ where: { ...T, active: true }, select: { id: true, name: true, current_stock: true, min_stock: true, unit_stock: true } }),
      prisma.user.findMany({ where: { ...T, active: true, role: { name: "operator" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);

    const activeByMachine = new Map<string, { jobCode: string; qty: number; product: string }>();
    for (const j of jobs) {
      if (["PRODUCTION_STARTED", "PRODUCTION_PAUSED"].includes(j.status)) {
        activeByMachine.set(j.machine_id, { jobCode: j.job_code, qty: j.planned_qty, product: j.order.order_code });
      }
    }

    const shaped = jobs.map((j) => ({
      jobCode: j.job_code,
      orderCode: j.order.order_code,
      customerName: j.order.customer?.name ?? "-",
      status: j.status,
      machineId: j.machine.id,
      machineName: j.machine.name,
      operatorId: j.operator.id,
      operatorName: j.operator.name,
      plannedQty: j.planned_qty,
      actualQty: j.actual_qty,
      wasteQty: j.waste_qty,
      reworkCount: j.rework_count,
      deadline: j.order.deadline,
      parentJobId: j.parent_job_id,
    }));

    return ok({
      kpi: {
        assigned: shaped.filter((j) => j.status === "PRODUCTION_ASSIGNED").length,
        running: shaped.filter((j) => j.status === "PRODUCTION_STARTED").length,
        paused: shaped.filter((j) => j.status === "PRODUCTION_PAUSED").length,
        qcQueue: shaped.filter((j) => j.status === "PRODUCTION_COMPLETE").length,
        failedRework: shaped.filter((j) => j.status === "FAILED_REWORK").length,
        machineMaint: machines.filter((m) => m.status === "MAINTENANCE").length,
        lowStock: materials.filter((m) => Number(m.current_stock) <= Number(m.min_stock)).length,
      },
      machines: machines.map((m) => ({
        id: m.id, code: m.machine_code, name: m.name, category: m.category, status: m.status,
        activeJob: activeByMachine.get(m.id) ?? null,
      })),
      jobs: shaped,
      reassignOptions: {
        machines: machines.filter((m) => m.status === "ACTIVE").map((m) => ({ id: m.id, name: m.name })),
        operators,
      },
      lowStock: materials
        .filter((m) => Number(m.current_stock) <= Number(m.min_stock))
        .map((m) => ({ name: m.name, current: Number(m.current_stock), min: Number(m.min_stock), unit: m.unit_stock })),
    });
  } catch (e) {
    console.error("getProductionOverview:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat data produksi.");
  }
}

// ─────────────────────────────────────────────────────────────
// ORDER LIST + DETAIL
// ─────────────────────────────────────────────────────────────

export async function getOrders(params?: { status?: string; search?: string; type?: "PRINTING" | "RETAIL"; limit?: number }) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);

    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenant.id,
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.type ? { order_type: params.type } : {}),
        ...(params?.search
          ? { OR: [{ order_code: { contains: params.search, mode: "insensitive" } }, { customer: { name: { contains: params.search, mode: "insensitive" } } }] }
          : {}),
      },
      orderBy: { created_at: "desc" },
      take: limit,
      include: { customer: { select: { name: true } }, _count: { select: { items: true } } },
    });

    return ok(
      orders.map((o) => ({
        id: o.id,
        orderCode: o.order_code,
        type: o.order_type,
        customerName: o.customer?.name ?? "-",
        status: o.status,
        total: num(o.total),
        paidAmount: num(o.paid_amount),
        balance: num(o.balance),
        deadline: o.deadline,
        itemCount: o._count.items,
        createdAt: o.created_at,
        overdue: o.deadline ? o.deadline.getTime() < Date.now() && !["CLOSED", "CANCELLED", "PICKED_UP"].includes(o.status) : false,
      }))
    );
  } catch (e) {
    console.error("getOrders:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat daftar order.");
  }
}

export async function getOrderDetail(orderId: string) {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const o = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenant.id },
      include: {
        customer: true,
        creator: { select: { name: true } },
        designer: { select: { name: true } },
        items: { include: { product: { select: { name: true } }, retail_product: { select: { name: true } }, material: { select: { name: true } } } },
        payments: { orderBy: { paid_at: "asc" }, include: { receiver: { select: { name: true } } } },
        design_jobs: { include: { versions: { orderBy: { version_no: "asc" } } } },
        production_jobs: { include: { machine: { select: { name: true } }, operator: { select: { name: true } } } },
        pickup_records: true,
      },
    });
    if (!o) return fail("Order tidak ditemukan.");

    return ok({
      id: o.id,
      orderCode: o.order_code,
      type: o.order_type,
      status: o.status,
      customer: o.customer ? { name: o.customer.name, phone: o.customer.phone, type: o.customer.type } : null,
      createdBy: o.creator.name,
      designer: o.designer?.name ?? null,
      subtotal: num(o.subtotal),
      discount: num(o.discount),
      discountApproved: !!o.discount_approved_by,
      total: num(o.total),
      dpRequired: num(o.dp_required),
      paidAmount: num(o.paid_amount),
      balance: num(o.balance),
      deadline: o.deadline,
      notes: o.notes,
      items: o.items.map((i) => ({
        name: i.product?.name ?? i.retail_product?.name ?? i.description ?? "-",
        quantity: i.quantity,
        size: i.size,
        material: i.material?.name ?? null,
        finishing: i.finishing,
        unitPrice: num(i.unit_price),
        totalPrice: num(i.total_price),
      })),
      payments: o.payments.map((p) => ({ amount: num(p.amount), method: p.method, status: p.status, receivedBy: p.receiver.name, paidAt: p.paid_at })),
      designJobs: o.design_jobs.map((d) => ({
        status: d.status,
        method: d.approval_method,
        currentVersion: d.current_version,
        versions: d.versions.map((v) => ({ versionNo: v.version_no, approvalStatus: v.approval_status, filePath: v.file_path, notes: v.approval_notes, rejectionReason: v.rejection_reason })),
      })),
      productionJobs: o.production_jobs.map((j) => ({
        jobCode: j.job_code,
        status: j.status,
        machine: j.machine.name,
        operator: j.operator.name,
        plannedQty: j.planned_qty,
        actualQty: j.actual_qty,
        wasteQty: j.waste_qty,
        parentJobId: j.parent_job_id,
      })),
      pickup: o.pickup_records[0]
        ? { receiverName: o.pickup_records[0].receiver_name, releasedAt: o.pickup_records[0].released_at, notes: o.pickup_records[0].notes }
        : null,
    });
  } catch (e) {
    console.error("getOrderDetail:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat detail order.");
  }
}

/**
 * Data label QR untuk sebuah Production Job (BARCODE-QR §"Label content").
 * Terima job_code atau order_code. Dipakai halaman cetak `/print/label/[id]`.
 */
export async function getJobLabel(codeOrId: string) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const c = codeOrId.trim().replace(/^JOB:/i, "").trim();

    let job = await prisma.productionJob.findFirst({
      where: { tenant_id: tenant.id, OR: [{ job_code: c }, { id: c }] },
      include: { order: { include: { customer: true, items: true } } },
    });
    if (!job) {
      const order = await prisma.order.findFirst({
        where: { tenant_id: tenant.id, order_code: c },
        include: { production_jobs: { orderBy: { created_at: "desc" }, take: 1 } },
      });
      if (order?.production_jobs[0]) {
        job = await prisma.productionJob.findFirst({
          where: { id: order.production_jobs[0].id },
          include: { order: { include: { customer: true, items: true } } },
        });
      }
    }
    if (!job) return fail("Job tidak ditemukan.");

    const items = job.order.items;
    return ok({
      company: { name: tenant.name, phone: tenant.owner_phone ?? null },
      jobCode: job.job_code,
      orderCode: job.order.order_code,
      customerName: job.order.customer?.name ?? "-",
      quantity: job.planned_qty || items.reduce((a, i) => a + i.quantity, 0),
      items: items.map((i) => ({
        description: i.description ?? "Produk cetak",
        quantity: i.quantity,
        size: i.size ?? null,
        finishing: i.finishing ?? null,
      })),
      deadline: job.order.deadline,
      printedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("getJobLabel:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat data label.");
  }
}
