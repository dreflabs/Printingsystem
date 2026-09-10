"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { DEADLINE_SETTLED } from "@/lib/order-status";
import { checkProductionReadiness, type ReadinessItem } from "@/lib/production-readiness";
import { ok, fail } from "@/types";

/**
 * Siapa yang boleh dipilih sebagai operator produksi.
 *
 * Memeriksa peran utama DAN peran tambahan: fitur multi-peran sudah ada
 * (`extra_roles`), tapi pemilih operator dulu hanya melihat `role` utama —
 * sehingga Owner atau Admin yang juga bertugas sebagai operator tidak pernah
 * muncul. Ini juga jalan keluar untuk percetakan kecil yang baru mendaftar dan
 * belum punya pegawai: Owner cukup menambahkan peran operator pada dirinya.
 */
const OPERATOR_ROLE = {
  OR: [
    { role: { name: "operator" } },
    { extra_roles: { some: { role: { name: "operator" } } } },
  ],
};


const num = (v: unknown) => Number(v ?? 0);

// ─────────────────────────────────────────────────────────────
// OPERATOR
// ─────────────────────────────────────────────────────────────

/**
 * Job produksi untuk operator yang login:
 *  - `mine`  : job yang sudah jadi tanggung jawabnya (aktif / di-pin Admin)
 *  - `queue` : job PRODUCTION_QUEUED tanpa operator — siapa pun operator boleh klaim
 */
export async function getOperatorJobs() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const userMachines = await prisma.userMachine.findMany({
      where: { tenant_id: tenant.id, user_id: actor.id },
      select: { machine_id: true }
    });
    const allowedMachineIds = userMachines.map(um => um.machine_id);

    const include = {
      machine: { select: { name: true, machine_code: true } },
      order: {
        select: {
          order_code: true,
          deadline: true,
          customer: { select: { name: true } },
          // Apa yang dicetak — untuk operator setel mesin.
          items: {
            where: { retail_product_id: null },
            select: {
              description: true,
              quantity: true,
              size: true,
              finishing: true,
              material_id: true,
              product: { select: { name: true, default_machine_id: true, unit: true } },
              material: { select: { name: true } },
            },
          },
          // File cetak = versi desain yang sudah APPROVED (bukan draft/revisi pending).
          design_jobs: {
            select: {
              versions: {
                where: { approval_status: "APPROVED" },
                orderBy: { version_no: "desc" },
                take: 1,
                select: { id: true, file_name: true, file_path: true },
              },
            },
          },
        },
      },
    } as const;

    const [mineRows, queueRows] = await Promise.all([
      prisma.productionJob.findMany({
        where: {
          tenant_id: tenant.id,
          operator_id: actor.id,
          status: { in: ["PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_PAUSED"] },
        },
        orderBy: [{ priority: "desc" }, { created_at: "asc" }],
        include,
      }),
      // Hanya ambil job dari mesin yang ditugaskan ke operator ini
      prisma.productionJob.findMany({
        where: {
          tenant_id: tenant.id,
          operator_id: null,
          status: "PRODUCTION_QUEUED",
          machine_id: { in: allowedMachineIds }
        },
        orderBy: [{ priority: "desc" }, { order: { deadline: "asc" } }, { created_at: "asc" }],
        include,
      }),
    ]);

    const shape = (j: (typeof mineRows)[number]) => {
      const ver = j.order.design_jobs.flatMap((d) => d.versions).find((v) => v.file_path) ?? null;
      // Item yang relevan ke mesin job ini; fallback ke semua item non-retail.
      const forMachine = j.order.items.filter((it) => it.product?.default_machine_id === j.machine_id);
      const relevant = forMachine.length ? forMachine : j.order.items;
      const items = relevant.map((it) => ({
        product: it.product?.name ?? it.description?.trim() ?? "Item cetak",
        size: it.size ?? null,
        qty: it.quantity,
        material: it.material?.name ?? null,
        finishing: it.finishing?.trim() || null,
      }));
      return {
        jobCode: j.job_code,
        orderCode: j.order.order_code,
        customerName: j.order.customer?.name ?? "-",
        machine: j.machine.name,
        status: j.status,
        productUnit: relevant.find((it) => it.product?.unit)?.product?.unit ?? "PCS",
        firstItemSize: relevant.find((it) => it.size)?.size ?? null,
        firstItemQty: relevant[0]?.quantity ?? j.planned_qty,
        suggestedMaterialId: relevant.find((it) => it.material_id)?.material_id ?? null,
        priority: j.priority,
        plannedQty: j.planned_qty,
        actualQty: j.actual_qty,
        deadline: j.order.deadline,
        startedAt: j.actual_start,
        items,
        fileUrl: ver ? `/api/design/${ver.id}` : null,
        fileName: ver?.file_name ?? null,
      };
    };

    return ok({ 
      mine: mineRows.map(shape), 
      queue: queueRows.map(shape),
      hasMachines: allowedMachineIds.length > 0
    });
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
    const actor = await requireUser();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const djs = await prisma.designJob.findMany({
      where: { 
        tenant_id: tenant.id, 
        OR: [
          { status: { in: ["PENDING", "DESIGNING"] } },
          { status: "APPROVED", updated_at: { gte: sevenDaysAgo } }
        ]
      },
      orderBy: { updated_at: "desc" },
      include: {
        designer: { select: { name: true } },
        order: {
          select: {
            order_code: true, status: true, deadline: true, notes: true,
            customer: { select: { name: true, phone: true } },
            items: {
              select: {
                description: true, size: true, quantity: true, finishing: true,
                product: { select: { name: true } },
                material: { select: { name: true } },
              },
            },
          },
        },
        versions: { orderBy: { version_no: "desc" }, take: 1, select: { id: true, approval_status: true, file_name: true, file_path: true, rejection_reason: true } },
      },
    });

    return ok(
      djs.map((d) => ({
        orderId: d.order_id,
        isOwnedByMe: d.designer_id === actor.id,
        isUnassigned: d.designer_id === null,
        orderCode: d.order.order_code,
        orderStatus: d.order.status,
        customerName: d.order.customer?.name ?? "-",
        customerPhone: d.order.customer?.phone ?? null,
        designerId: d.designer_id,
        designer: d.designer?.name ?? "Belum Diambil",
        method: d.approval_method,
        status: d.status,
        currentVersion: d.current_version,
        latestVersionStatus: d.versions[0]?.approval_status ?? null,
        latestVersionId: d.versions[0]?.id ?? null,
        latestRejectionReason: d.versions[0]?.rejection_reason ?? null,
        latestFileName: d.versions[0]?.file_name ?? null,
        latestFileUrl: d.versions[0]?.file_path ? `/api/design/${d.versions[0]!.id}` : null,
        deadline: d.order.deadline,
        // Brief & spesifikasi dari Admin — supaya Designer tahu yang harus dikerjakan.
        notes: d.order.notes ?? null,
        items: d.order.items.map((it) => ({
          product: it.product?.name ?? it.description ?? "Item",
          description: it.description ?? null,
          size: it.size ?? null,
          quantity: it.quantity,
          material: it.material?.name ?? null,
          finishing: it.finishing ?? null,
        })),
      }))
    );
  } catch (e) {
    console.error("getDesignQueue:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat antrian desain.");
  }
}

/** Mengambil riwayat transaksi RETAIL terbaru untuk POS. */
export async function getRetailHistory(limit = 50) {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const orders = await prisma.order.findMany({
      where: { tenant_id: tenant.id, order_type: "RETAIL" },
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        customer: { select: { name: true } },
        payments: { select: { method: true }, take: 1, orderBy: { paid_at: "desc" } },
      },
    });

    return ok(
      orders.map((o) => ({
        id: o.id,
        createdAt: o.created_at,
        orderCode: o.order_code,
        customerName: o.customer?.name ?? "Umum",
        method: o.payments[0]?.method ?? "-",
        total: Number(o.total),
      }))
    );
  } catch (e) {
    console.error("getRetailHistory:", e);
    return fail("Gagal memuat riwayat transaksi.");
  }
}

const IN_PROGRESS = [
  "PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_COMPLETE",
  "QC_PENDING", "QC_PASSED", "QC_REWORK_PENDING",
  "FINISHING_STARTED", "FINISHING_COMPLETE", "STORAGE_PENDING", "STORED",
];

/** Dashboard Owner lengkap — KPI, semua panel alert, pipeline, absensi, audit. */
export async function getOwnerDashboard() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang boleh melihat data ini.");

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
        where: { ...T, deadline: { lt: now }, status: { notIn: DEADLINE_SETTLED } },
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
      prisma.attendanceRecord.findMany({
        where: { ...T, date: { gte: startOfDay } },
        select: { check_in_status: true, user_id: true, employee_name: true, check_in: true, break_status: true, break_end: true },
      }),
      prisma.user.count({ where: { ...T, active: true } }),
    ]);

    const yesterdayStart = new Date(startOfDay.getTime() - 24 * 3600 * 1000);
    const autoClosedYesterday = await prisma.attendanceRecord.count({
      where: { ...T, date: { gte: yesterdayStart, lt: startOfDay }, check_out_status: "AUTO_CLOSED" },
    });

    const [machines, operators] = await Promise.all([
      prisma.machine.findMany({ where: { ...T, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { ...T, active: true, ...OPERATOR_ROLE }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);

    const bucket = (s: string) =>
      ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_STARTED"].includes(s) ? "produksi"
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
        lateList: attendanceToday
          .filter((a) => a.check_in_status === "LATE")
          .map((a) => ({
            name: a.employee_name,
            jam: a.check_in
              ? a.check_in.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })
              : "—",
          })),
        breakExceeded: attendanceToday
          .filter((a) => a.break_status === "EXCEEDED")
          .map((a) => ({ name: a.employee_name, ongoing: !a.break_end })),
        autoClosedYesterday,
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
    if (!actor.roles.includes("owner") && !actor.roles.includes("admin")) return fail("Hanya Owner/Admin yang boleh melihat data ini.");
    const T = { tenant_id: tenant.id };

    const [jobs, machines, materials, operators, stuckRows] = await Promise.all([
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
      prisma.user.findMany({ where: { ...T, active: true, ...OPERATOR_ROLE }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      // Order CONFIRMED yang gagal auto-release (data kurang) atau tertahan gatekeeper.
      prisma.order.findMany({
        where: { ...T, status: "CONFIRMED", auto_release_blocked: { not: null } },
        orderBy: { deadline: "asc" },
        include: {
          customer: { select: { name: true, phone: true, email: true } },
          items: { include: { product: { select: { unit: true, default_machine_id: true } } } },
          design_jobs: { select: { status: true, versions: { orderBy: { version_no: "desc" }, take: 1, select: { approval_status: true, file_path: true, file_name: true } } } },
        },
      }),
    ]);

    const stuckOrders = stuckRows.map((o) => {
      const awaitingRelease = o.auto_release_blocked === "AWAITING_ADMIN_RELEASE";
      let reasons: string[] = [];
      let liveReady = false;
      if (!awaitingRelease) {
        // Hitung ulang alasan secara LIVE — supaya panel langsung update saat data
        // order dilengkapi, tanpa menunggu Admin menekan "Coba Rilis".
        const designApproved = o.design_jobs.some((d) => d.status === "APPROVED");
        const designFilePresent = o.design_jobs.some((d) =>
          d.versions.some((v) => v.approval_status === "APPROVED" && (v.file_path || v.file_name))
        );
        const rItems: ReadinessItem[] = o.items
          .filter((i) => !i.retail_product_id)
          .map((i) => ({
            label: i.description || "",
            productId: i.product_id,
            productUnit: i.product?.unit ?? null,
            defaultMachineId: i.product?.default_machine_id ?? null,
            quantity: i.quantity,
            size: i.size,
            materialId: i.material_id,
            unitPrice: num(i.unit_price),
            totalPrice: num(i.total_price),
          }));
        const r = checkProductionReadiness({
          status: o.status,
          orderType: o.order_type,
          customerId: o.customer_id,
          customerName: o.customer?.name ?? null,
          customerContact: o.customer?.phone || o.customer?.email || null,
          deadline: o.deadline,
          discount: num(o.discount),
          discountApprovedBy: o.discount_approved_by,
          paidAmount: num(o.paid_amount),
          dpRequired: num(o.dp_required ?? Math.round(num(o.total) * 0.5)),
          designApproved,
          designFilePresent,
          items: rItems,
        });
        reasons = r.missing;
        liveReady = r.autoRoutable;
      }
      return {
        orderId: o.id,
        orderCode: o.order_code,
        customerName: o.customer?.name ?? "-",
        deadline: o.deadline,
        // ready = tinggal dirilis (baik karena gatekeeper, atau data sudah lengkap)
        ready: awaitingRelease || liveReady,
        awaitingRelease,
        reasons,
      };
    });

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
      operatorId: j.operator?.id ?? null,
      operatorName: j.operator?.name ?? "—",
      plannedQty: j.planned_qty,
      actualQty: j.actual_qty,
      wasteQty: j.waste_qty,
      reworkCount: j.rework_count,
      deadline: j.order.deadline,
      parentJobId: j.parent_job_id,
    }));

    return ok({
      kpi: {
        queued: shaped.filter((j) => j.status === "PRODUCTION_QUEUED").length,
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
      stuckOrders,
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

export async function getOrders(params?: {
  status?: string;
  search?: string;
  type?: "PRINTING" | "RETAIL";
  limit?: number;
  /** hanya order yang sudah lewat deadline & belum selesai */
  overdueOnly?: boolean;
  /** deadline dalam rentang [deadlineFrom, deadlineTo] (ISO date) */
  deadlineFrom?: string;
  deadlineTo?: string;
}) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);

    const deadlineRange =
      params?.deadlineFrom || params?.deadlineTo
        ? {
            ...(params.deadlineFrom ? { gte: new Date(params.deadlineFrom) } : {}),
            ...(params.deadlineTo ? { lte: new Date(params.deadlineTo) } : {}),
          }
        : undefined;

    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenant.id,
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.type ? { order_type: params.type } : {}),
        ...(params?.overdueOnly
          ? { deadline: { lt: new Date() }, status: { notIn: DEADLINE_SETTLED } }
          : {}),
        ...(deadlineRange ? { deadline: deadlineRange } : {}),
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
        overdue: o.deadline ? o.deadline.getTime() < Date.now() && !DEADLINE_SETTLED.includes(o.status) : false,
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
        items: { include: { product: { select: { name: true, unit: true, default_machine_id: true } }, retail_product: { select: { name: true } }, material: { select: { name: true } } } },
        payments: { orderBy: { paid_at: "asc" }, include: { receiver: { select: { name: true } } } },
        design_jobs: { include: { versions: { orderBy: { version_no: "asc" } } } },
        production_jobs: { include: { machine: { select: { name: true } }, operator: { select: { name: true } } } },
        pickup_records: true,
      },
    });
    if (!o) return fail("Order tidak ditemukan.");

    // Kesiapan turun ke produksi — dipakai UI untuk menjelaskan kenapa order
    // belum jalan otomatis (bukan cuma cek design/diskon/DP).
    const designApproved = o.design_jobs.some((d) => d.status === "APPROVED");
    const designFilePresent = o.design_jobs.some((d) =>
      d.versions.some((v) => v.approval_status === "APPROVED" && (v.file_path || v.file_name))
    );
    const readinessItems: ReadinessItem[] = o.items
      .filter((i) => !i.retail_product_id)
      .map((i) => ({
        label: i.description || i.product?.name || "",
        productId: i.product_id,
        productUnit: i.product?.unit ?? null,
        defaultMachineId: i.product?.default_machine_id ?? null,
        quantity: i.quantity,
        size: i.size,
        materialId: i.material_id,
        unitPrice: num(i.unit_price),
        totalPrice: num(i.total_price),
      }));
    const readiness = checkProductionReadiness({
      status: o.status,
      orderType: o.order_type,
      customerId: o.customer_id,
      customerName: o.customer?.name ?? null,
      customerContact: o.customer?.phone || o.customer?.email || null,
      deadline: o.deadline,
      discount: num(o.discount),
      discountApprovedBy: o.discount_approved_by,
      paidAmount: num(o.paid_amount),
      dpRequired: num(o.dp_required ?? Math.round(num(o.total) * 0.5)),
      designApproved,
      designFilePresent,
      items: readinessItems,
    });

    return ok({
      id: o.id,
      orderCode: o.order_code,
      type: o.order_type,
      status: o.status,
      autoReleaseBlocked: o.auto_release_blocked,
      readyMissing: readiness.missing,
      readyAutoRoutable: readiness.autoRoutable,
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
      payments: o.payments.map((p) => ({ id: p.id, amount: num(p.amount), method: p.method, status: p.status, receivedBy: p.receiver.name, paidAt: p.paid_at })),
      designJobs: o.design_jobs.map((d) => ({
        status: d.status,
        method: d.approval_method,
        currentVersion: d.current_version,
        versions: d.versions.map((v) => ({
          versionNo: v.version_no,
          approvalStatus: v.approval_status,
          fileUrl: v.file_path ? `/api/design/${v.id}` : null,
          fileName: v.file_name,
          fileSize: v.file_size,
          notes: v.approval_notes,
          rejectionReason: v.rejection_reason,
        })),
      })),
      productionJobs: o.production_jobs.map((j) => ({
        jobCode: j.job_code,
        status: j.status,
        machine: j.machine.name,
        operator: j.operator?.name ?? "—",
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

/**
 * Data untuk cetak Nota / bukti transaksi — berlaku untuk order PRINTING maupun
 * RETAIL (POS). Bisa dicetak ulang kapan saja. Menerima kode order atau id.
 */
export async function getOrderReceipt(codeOrId: string) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const c = codeOrId.trim().replace(/^ORD:/i, "").trim();

    const [t, order] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { name: true, owner_phone: true, address: true, slug: true },
      }),
      prisma.order.findFirst({
        where: { tenant_id: tenant.id, OR: [{ order_code: c }, { id: c }] },
        include: {
          customer: { select: { name: true, phone: true } },
          creator: { select: { name: true } },
          items: true,
          payments: {
            where: { status: "CONFIRMED" },
            orderBy: { paid_at: "asc" },
            select: { amount: true, method: true, paid_at: true, reference: true },
          },
        },
      }),
    ]);
    if (!order) return fail("Order tidak ditemukan.");

    const n = (d: unknown) => Number(d ?? 0);
    return ok({
      shop: {
        name: t?.name ?? "Percetakan",
        phone: t?.owner_phone ?? null,
        address: t?.address ?? null,
        slug: t?.slug ?? null,
      },
      order: {
        code: order.order_code,
        type: order.order_type as "PRINTING" | "RETAIL",
        status: order.status,
        createdAt: order.created_at,
        deadline: order.deadline,
        notes: order.notes ?? null,
      },
      customer: order.customer ? { name: order.customer.name, phone: order.customer.phone ?? null } : null,
      cashier: order.creator?.name ?? "-",
      items: order.items.map((i) => ({
        description: i.description ?? "Item",
        size: i.size ?? null,
        finishing: i.finishing ?? null,
        qty: i.quantity,
        unitPrice: n(i.unit_price),
        totalPrice: n(i.total_price),
      })),
      subtotal: n(order.subtotal),
      discount: n(order.discount),
      discountApproved: !!order.discount_approved_by,
      total: n(order.total),
      dpRequired: n(order.dp_required ?? Math.round(n(order.total) * 0.5)),
      paid: n(order.paid_amount),
      balance: n(order.balance),
      dpMet: n(order.paid_amount) + 1e-6 >= n(order.dp_required ?? Math.round(n(order.total) * 0.5)),
      payments: order.payments.map((p) => ({
        amount: n(p.amount),
        method: p.method,
        reference: p.reference ?? null,
        paidAt: p.paid_at,
      })),
      printedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("getOrderReceipt:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat data nota.");
  }
}

/**
 * Data satu kwitansi pembayaran (untuk /print/kwitansi/[id]).
 * Menghitung "dibayar s/d pembayaran ini" & sisa tagihan setelahnya, supaya
 * kwitansi jujur menyatakan posisi tagihan pada saat itu.
 */
export async function getPaymentReceipt(paymentId: string) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const n = (d: unknown) => Number(d ?? 0);

    const [t, payment] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { name: true, owner_phone: true, address: true },
      }),
      prisma.payment.findFirst({
        where: { id: paymentId.trim(), tenant_id: tenant.id },
        include: {
          receiver: { select: { name: true } },
          order: {
            select: {
              order_code: true, order_type: true, total: true, dp_required: true,
              customer: { select: { name: true, phone: true } },
            },
          },
        },
      }),
    ]);
    if (!payment || !payment.order) return fail("Pembayaran tidak ditemukan.");

    // Dibayar kumulatif s/d pembayaran ini (urut waktu, tie-break id).
    const priorAgg = await prisma.payment.aggregate({
      where: {
        order_id: payment.order_id,
        status: "CONFIRMED",
        OR: [
          { paid_at: { lt: payment.paid_at } },
          { AND: [{ paid_at: payment.paid_at }, { id: { lte: payment.id } }] },
        ],
      },
      _sum: { amount: true },
    });
    const amount = n(payment.amount);
    const isRefund = amount < 0;
    const total = n(payment.order.total);
    const paidThrough = n(priorAgg._sum.amount);
    const dpRequired = n(payment.order.dp_required ?? Math.round(total * 0.5));
    const balanceAfter = Math.max(0, total - paidThrough);

    // Jenis pembayaran: pelunasan kalau menutup sisa, selain itu DP/cicilan.
    const kind = isRefund
      ? "REFUND"
      : balanceAfter <= 0
        ? "PELUNASAN"
        : paidThrough <= amount + 1e-6
          ? "DP"
          : "CICILAN";

    return ok({
      shop: { name: t?.name ?? "Percetakan", phone: t?.owner_phone ?? null, address: t?.address ?? null },
      paymentId: payment.id,
      orderCode: payment.order.order_code,
      orderType: payment.order.order_type as "PRINTING" | "RETAIL",
      customerName: payment.order.customer?.name ?? "-",
      customerPhone: payment.order.customer?.phone ?? null,
      cashier: payment.receiver?.name ?? "-",
      amount: Math.abs(amount),
      isRefund,
      method: payment.method,
      reference: payment.reference ?? null,
      paidAt: payment.paid_at,
      kind, // DP | CICILAN | PELUNASAN | REFUND
      total,
      dpRequired,
      paidThrough,
      balanceAfter,
      printedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("getPaymentReceipt:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat data kwitansi.");
  }
}
