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
    if (actor.role !== "owner" && actor.role !== "admin") return fail("Tidak berwenang.");

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
