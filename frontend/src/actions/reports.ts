"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { ok, fail } from "@/types";

const isAdmin = (r: string) => r === "admin" || r === "owner";

/** Status order yang dianggap "selesai" (sudah diambil konsumen atau lewat). */
const DONE_STATUSES = ["PICKED_UP", "FINAL_AUDIT_PENDING", "FINAL_AUDIT_COMPLETE", "CLOSED"];

function monthRange(monthStr?: string) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [yy, mm] = monthStr.split("-").map(Number);
    y = yy;
    m = mm - 1;
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  const label = `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start, end, label };
}

function dayRange(dateStr?: string) {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Laporan Pendapatan Harian (FINANCIAL-REPORT §1). */
export async function getDailyRevenue(dateStr?: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat laporan keuangan.");
    const { start, end } = dayRange(dateStr);

    const [newPrintingOrders, printingPayments, retailAgg, discountAgg, newReceivables] = await Promise.all([
      prisma.order.count({
        where: { tenant_id: tenant.id, order_type: "PRINTING", created_at: { gte: start, lt: end } },
      }),
      prisma.payment.findMany({
        where: {
          tenant_id: tenant.id,
          status: "CONFIRMED",
          paid_at: { gte: start, lt: end },
          order: { order_type: "PRINTING" },
        },
        select: { amount: true, order_id: true, paid_at: true },
      }),
      prisma.order.aggregate({
        where: { tenant_id: tenant.id, order_type: "RETAIL", status: "CLOSED", closed_at: { gte: start, lt: end } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { tenant_id: tenant.id, discount_approved_at: { gte: start, lt: end } },
        _sum: { discount: true },
      }),
      prisma.order.aggregate({
        where: {
          tenant_id: tenant.id,
          order_type: "PRINTING",
          status: "CONFIRMED",
          created_at: { gte: start, lt: end },
          balance: { gt: 0 },
        },
        _sum: { balance: true },
      }),
    ]);

    // Pisahkan DP vs pelunasan: pembayaran pertama sebuah order = DP, sisanya pelunasan.
    const orderIds = [...new Set(printingPayments.map((p) => p.order_id))];
    const firstPayments = await prisma.payment.groupBy({
      by: ["order_id"],
      where: { tenant_id: tenant.id, status: "CONFIRMED", order_id: { in: orderIds } },
      _min: { paid_at: true },
    });
    const firstAt = new Map(firstPayments.map((f) => [f.order_id, f._min.paid_at?.getTime()]));

    let dpIn = 0;
    let pelunasanIn = 0;
    for (const p of printingPayments) {
      const amt = Number(p.amount);
      if (firstAt.get(p.order_id) === p.paid_at.getTime()) dpIn += amt;
      else pelunasanIn += amt;
    }

    const printingRevenue = dpIn + pelunasanIn;
    const retailRevenue = Number(retailAgg._sum.total ?? 0);

    return ok({
      date: start.toISOString().slice(0, 10),
      newPrintingOrders,
      dpIn,
      pelunasanIn,
      printingRevenue,
      retailOrders: retailAgg._count,
      retailRevenue,
      combinedRevenue: printingRevenue + retailRevenue,
      discountsApproved: Number(discountAgg._sum.discount ?? 0),
      newReceivables: Number(newReceivables._sum.balance ?? 0),
    });
  } catch (e) {
    console.error("getDailyRevenue:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat laporan harian.");
  }
}

/** Laporan Piutang (FINANCIAL-REPORT §2). filter: all | overdue | ready_unpaid */
export async function getOutstandingReceivables(filter: "all" | "overdue" | "ready_unpaid" = "all") {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat laporan piutang.");

    const orders = await prisma.order.findMany({
      where: {
        tenant_id: tenant.id,
        order_type: "PRINTING",
        balance: { gt: 0 },
        status: { notIn: ["CANCELLED", "DRAFT"] },
        ...(filter === "ready_unpaid" ? { status: "READY_FOR_PICKUP" } : {}),
        ...(filter === "overdue" ? { deadline: { lt: new Date() } } : {}),
      },
      orderBy: { deadline: "asc" },
      include: { customer: { select: { name: true } } },
    });

    return ok(
      orders.map((o) => ({
        orderCode: o.order_code,
        customerName: o.customer?.name ?? "-",
        total: Number(o.total),
        paidAmount: Number(o.paid_amount),
        balance: Number(o.balance),
        deadline: o.deadline,
        status: o.status,
        overdue: o.deadline ? o.deadline.getTime() < Date.now() : false,
      }))
    );
  } catch (e) {
    console.error("getOutstandingReceivables:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat laporan piutang.");
  }
}

/** Kinerja Operator: jumlah job, output, waste, rasio waste (PRODUCTION-REPORT). */
export async function getOperatorPerformance(fromStr?: string, toStr?: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat laporan produksi.");

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 864e5);
    const to = toStr ? new Date(toStr) : new Date();

    const grouped = await prisma.productionJob.groupBy({
      by: ["operator_id"],
      where: { tenant_id: tenant.id, created_at: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { actual_qty: true, waste_qty: true },
    });
    const operators = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.operator_id) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(operators.map((u) => [u.id, u.name]));

    return ok(
      grouped
        .map((g) => {
          const output = g._sum.actual_qty ?? 0;
          const waste = g._sum.waste_qty ?? 0;
          return {
            operatorId: g.operator_id,
            operatorName: nameById.get(g.operator_id) ?? "-",
            jobCount: g._count._all,
            totalOutput: output,
            totalWaste: waste,
            wasteRatio: output + waste > 0 ? waste / (output + waste) : 0,
          };
        })
        .sort((a, b) => b.wasteRatio - a.wasteRatio)
    );
  } catch (e) {
    console.error("getOperatorPerformance:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat laporan produksi.");
  }
}

/** Deret pendapatan N hari terakhir (printing vs retail) untuk chart. */
export async function getRevenueSeries(days = 7) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat laporan pendapatan.");

    const n = Math.min(Math.max(days, 1), 90);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1));

    const [payments, retailOrders] = await Promise.all([
      prisma.payment.findMany({
        where: { tenant_id: tenant.id, status: "CONFIRMED", paid_at: { gte: start }, order: { order_type: "PRINTING" } },
        select: { amount: true, paid_at: true },
      }),
      prisma.order.findMany({
        where: { tenant_id: tenant.id, order_type: "RETAIL", status: "CLOSED", closed_at: { gte: start } },
        select: { total: true, closed_at: true },
      }),
    ]);

    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const buckets = new Map<string, { cetak: number; retail: number }>();
    for (let i = 0; i < n; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      buckets.set(key(d), { cetak: 0, retail: 0 });
    }
    for (const p of payments) {
      const b = buckets.get(key(new Date(p.paid_at)));
      if (b) b.cetak += Number(p.amount);
    }
    for (const o of retailOrders) {
      if (!o.closed_at) continue;
      const b = buckets.get(key(new Date(o.closed_at)));
      if (b) b.retail += Number(o.total);
    }

    const labels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const series = [...buckets.entries()].map(([k, v]) => {
      const [y, m, dd] = k.split("-").map(Number);
      return { name: labels[new Date(y, m, dd).getDay()], ...v };
    });
    return ok(series);
  } catch (e) {
    console.error("getRevenueSeries:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat deret pendapatan.");
  }
}

/**
 * Laporan Bulanan Owner — gabungan FINANCIAL-REPORT §3 (finansial) +
 * MONTHLY-OWNER-REPORT (operasional non-finansial). Owner-only.
 * @param monthStr "YYYY-MM"; default = bulan berjalan.
 */
export async function getMonthlyReport(monthStr?: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh melihat laporan bulanan.");

    const { start, end, label } = monthRange(monthStr);
    const inPeriod = { gte: start, lt: end };

    const [
      printingOrders,
      retailAgg,
      printingPaymentsAgg,
      discountAgg,
      cancelledOrders,
      receivableAgg,
      topPrinting,
      topRetail,
      busyJobs,
      totalOrderCount,
      pickedUpInPeriod,
      overdueAlerts,
      closedPrinting,
      jobAgg,
      qcFailCount,
      reworkCount,
      ownerEscalations,
      audits,
      categoryOrders,
    ] = await Promise.all([
      // Order printing dibuat dalam periode (untuk omset + jumlah + rata-rata + selesai/batal rate)
      prisma.order.findMany({
        where: { tenant_id: tenant.id, order_type: "PRINTING", created_at: inPeriod },
        select: { total: true, discount: true, status: true, deadline: true, closed_at: true, created_at: true },
      }),
      // Retail CLOSED dalam periode
      prisma.order.aggregate({
        where: { tenant_id: tenant.id, order_type: "RETAIL", status: "CLOSED", closed_at: inPeriod },
        _sum: { total: true },
        _count: true,
      }),
      // Uang masuk printing (pembayaran CONFIRMED) dalam periode
      prisma.payment.aggregate({
        where: { tenant_id: tenant.id, status: "CONFIRMED", paid_at: inPeriod, order: { order_type: "PRINTING" } },
        _sum: { amount: true },
      }),
      // Diskon di-approve dalam periode
      prisma.order.aggregate({
        where: { tenant_id: tenant.id, discount_approved_at: inPeriod },
        _sum: { discount: true },
      }),
      // Order dibatalkan dalam periode → DP hangus = dibayar − direfund
      prisma.order.findMany({
        where: { tenant_id: tenant.id, order_type: "PRINTING", cancelled_at: inPeriod },
        select: { paid_amount: true, dp_refund_amount: true },
      }),
      // Piutang printing per akhir periode (approx: saldo berjalan order dibuat sebelum akhir periode)
      prisma.order.aggregate({
        where: {
          tenant_id: tenant.id,
          order_type: "PRINTING",
          created_at: { lt: end },
          balance: { gt: 0 },
          status: { notIn: ["CANCELLED", "DRAFT"] },
        },
        _sum: { balance: true },
      }),
      // Top 5 produk printing (qty) — item dari order dibuat dalam periode
      prisma.orderItem.groupBy({
        by: ["product_id"],
        where: {
          tenant_id: tenant.id,
          product_id: { not: null },
          order: { order_type: "PRINTING", created_at: inPeriod },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      // Top 5 barang retail (qty) — item dari order retail CLOSED dalam periode
      prisma.orderItem.groupBy({
        by: ["retail_product_id"],
        where: {
          tenant_id: tenant.id,
          retail_product_id: { not: null },
          order: { order_type: "RETAIL", status: "CLOSED", closed_at: inPeriod },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      // Mesin tersibuk — job yang selesai (actual_end) dalam periode
      prisma.productionJob.findMany({
        where: { tenant_id: tenant.id, actual_end: inPeriod, actual_start: { not: null } },
        select: { machine_id: true, actual_start: true, actual_end: true },
      }),
      // Total order (printing + retail) dibuat dalam periode
      prisma.order.count({ where: { tenant_id: tenant.id, created_at: inPeriod } }),
      // Order benar-benar diambil dalam periode
      prisma.pickupRecord.count({ where: { tenant_id: tenant.id, released_at: inPeriod } }),
      // Order yang tercatat OVERDUE dalam periode (distinct order)
      prisma.deadlineAlert.groupBy({
        by: ["order_id"],
        where: { tenant_id: tenant.id, alert_type: "OVERDUE", triggered_at: inPeriod },
      }),
      // Order printing yang closed dalam periode → rata-rata durasi penyelesaian
      prisma.order.findMany({
        where: { tenant_id: tenant.id, order_type: "PRINTING", closed_at: inPeriod },
        select: { created_at: true, closed_at: true },
      }),
      // Akumulasi output + waste dari job selesai dalam periode
      prisma.productionJob.aggregate({
        where: { tenant_id: tenant.id, actual_end: inPeriod },
        _sum: { actual_qty: true, waste_qty: true },
      }),
      prisma.qcRecord.count({ where: { tenant_id: tenant.id, result: "FAIL", created_at: inPeriod } }),
      prisma.productionJob.count({ where: { tenant_id: tenant.id, parent_job_id: { not: null }, created_at: inPeriod } }),
      prisma.productionJob.count({ where: { tenant_id: tenant.id, rework_count: { gte: 2 }, updated_at: inPeriod } }),
      // Temuan Final Audit YELLOW/RED dalam periode
      prisma.audit.findMany({
        where: { tenant_id: tenant.id, result: { in: ["YELLOW", "RED"] }, audited_at: inPeriod },
        select: {
          result: true,
          notes: true,
          audited_at: true,
          approved_at: true,
          financial_status: true,
          material_status: true,
          quantity_status: true,
          production_status: true,
          storage_status: true,
          order: { select: { order_code: true } },
        },
        orderBy: { audited_at: "desc" },
      }),
      // Completion rate per kategori produk — order printing dibuat dalam periode
      prisma.order.findMany({
        where: { tenant_id: tenant.id, order_type: "PRINTING", created_at: inPeriod },
        select: {
          status: true,
          deadline: true,
          closed_at: true,
          items: { select: { product: { select: { category: true } } }, take: 1 },
        },
      }),
    ]);

    // ── Finansial ──────────────────────────────────────────────────────────────
    const omsetBrutoPrinting = printingOrders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((a, o) => a + Number(o.total), 0);
    const retailRevenue = Number(retailAgg._sum.total ?? 0);
    const omsetBruto = omsetBrutoPrinting + retailRevenue;
    const totalDiskon = Number(discountAgg._sum.discount ?? 0);
    const pendapatanMasukPrinting = Number(printingPaymentsAgg._sum.amount ?? 0);
    const dpHangus = cancelledOrders.reduce(
      (a, o) => a + Math.max(0, Number(o.paid_amount) - Number(o.dp_refund_amount ?? 0)),
      0
    );
    const jumlahOrderPrinting = printingOrders.length;
    const jumlahTransaksiRetail = retailAgg._count;

    const productNames = new Map<string, string>();
    const retailNames = new Map<string, string>();
    const prodIds = topPrinting.map((t) => t.product_id).filter((x): x is string => !!x);
    const retIds = topRetail.map((t) => t.retail_product_id).filter((x): x is string => !!x);
    const [prods, rets] = await Promise.all([
      prodIds.length
        ? prisma.product.findMany({ where: { id: { in: prodIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      retIds.length
        ? prisma.retailProduct.findMany({ where: { id: { in: retIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    prods.forEach((p) => productNames.set(p.id, p.name));
    rets.forEach((r) => retailNames.set(r.id, r.name));

    // Mesin tersibuk (jam produksi)
    const machineHours = new Map<string, number>();
    for (const j of busyJobs) {
      if (!j.actual_start || !j.actual_end) continue;
      const h = (j.actual_end.getTime() - j.actual_start.getTime()) / 3_600_000;
      if (h > 0) machineHours.set(j.machine_id, (machineHours.get(j.machine_id) ?? 0) + h);
    }
    const busyMachineIds = [...machineHours.keys()];
    const machines = busyMachineIds.length
      ? await prisma.machine.findMany({ where: { id: { in: busyMachineIds } }, select: { id: true, name: true } })
      : [];
    const machineName = new Map(machines.map((m) => [m.id, m.name]));
    const mesinTersibuk = [...machineHours.entries()]
      .map(([id, hours]) => ({ name: machineName.get(id) ?? "-", hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    // ── Operasional ────────────────────────────────────────────────────────────
    const doneInPeriodOrders = printingOrders.filter((o) => DONE_STATUSES.includes(o.status)).length;
    const cancelledInPeriod = printingOrders.filter((o) => o.status === "CANCELLED").length;
    const completionRate = jumlahOrderPrinting > 0 ? doneInPeriodOrders / jumlahOrderPrinting : 0;
    const cancelRate = jumlahOrderPrinting > 0 ? cancelledInPeriod / jumlahOrderPrinting : 0;

    const durations = closedPrinting
      .filter((o) => o.closed_at)
      .map((o) => (o.closed_at!.getTime() - o.created_at.getTime()) / 86_400_000);
    const avgCompletionDays =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const totalOutput = jobAgg._sum.actual_qty ?? 0;
    const totalWaste = jobAgg._sum.waste_qty ?? 0;
    const wastePct = totalOutput + totalWaste > 0 ? totalWaste / (totalOutput + totalWaste) : 0;

    const auditExceptionCount = audits.length;

    // Completion per kategori
    const catMap = new Map<
      string,
      { total: number; onTime: number; late: number; cancelled: number }
    >();
    for (const o of categoryOrders) {
      const cat = o.items[0]?.product?.category ?? "LAINNYA";
      const row = catMap.get(cat) ?? { total: 0, onTime: 0, late: 0, cancelled: 0 };
      row.total++;
      if (o.status === "CANCELLED") {
        row.cancelled++;
      } else if (DONE_STATUSES.includes(o.status)) {
        if (o.closed_at && o.deadline && o.closed_at.getTime() > o.deadline.getTime()) row.late++;
        else row.onTime++;
      }
      catMap.set(cat, row);
    }
    const completionByCategory = [...catMap.entries()]
      .map(([category, r]) => ({
        category,
        total: r.total,
        onTime: r.onTime,
        late: r.late,
        cancelled: r.cancelled,
        completionRate: r.total > 0 ? (r.onTime + r.late) / r.total : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Daftar exception audit
    const auditExceptions = audits.map((a) => {
      const cats: string[] = [];
      const flag = (name: string, v: string) => {
        if (v && !/^(GREEN|OK|PASS|MATCH|CLEAR)$/i.test(v)) cats.push(name);
      };
      flag("Finance", a.financial_status);
      flag("Material", a.material_status);
      flag("Quantity", a.quantity_status);
      flag("Production", a.production_status);
      flag("Storage", a.storage_status);
      return {
        orderCode: a.order?.order_code ?? "-",
        result: a.result,
        categories: cats.length ? cats.join(", ") : "Umum",
        followUp: a.approved_at ? "Selesai" : "Menunggu",
        note: a.notes ?? "",
        auditedAt: a.audited_at,
      };
    });

    return ok({
      period: label,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: new Date(end.getTime() - 1).toISOString().slice(0, 10),
      financial: {
        omsetBruto,
        omsetBrutoPrinting,
        totalDiskon,
        omsetNeto: omsetBruto - totalDiskon,
        pendapatanMasuk: pendapatanMasukPrinting + retailRevenue,
        retailRevenue,
        retailPctOfBruto: omsetBruto > 0 ? retailRevenue / omsetBruto : 0,
        piutangAkhirPeriode: Number(receivableAgg._sum.balance ?? 0),
        dpHangus,
        jumlahOrderPrinting,
        jumlahTransaksiRetail,
        orderSelesai: doneInPeriodOrders,
        orderDibatalkan: cancelledInPeriod,
        avgOrderValue: jumlahOrderPrinting > 0 ? omsetBrutoPrinting / jumlahOrderPrinting : 0,
        avgRetailValue: jumlahTransaksiRetail > 0 ? retailRevenue / jumlahTransaksiRetail : 0,
        topPrinting: topPrinting.map((t) => ({
          name: productNames.get(t.product_id ?? "") ?? "—",
          qty: t._sum.quantity ?? 0,
        })),
        topRetail: topRetail.map((t) => ({
          name: retailNames.get(t.retail_product_id ?? "") ?? "—",
          qty: t._sum.quantity ?? 0,
        })),
        mesinTersibuk,
      },
      operational: {
        totalOrder: totalOrderCount,
        orderSelesai: doneInPeriodOrders,
        pickedUpInPeriod,
        completionRate,
        orderDibatalkan: cancelledInPeriod,
        cancelRate,
        orderOverdue: overdueAlerts.length,
        avgCompletionDays,
        totalWaste,
        totalOutput,
        wastePct,
        qcFail: qcFailCount,
        reworkCount,
        ownerEscalations,
        auditExceptionCount,
      },
      completionByCategory,
      auditExceptions,
    });
  } catch (e) {
    console.error("getMonthlyReport:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat laporan bulanan.");
  }
}
