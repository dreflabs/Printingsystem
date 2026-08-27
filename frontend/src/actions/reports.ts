"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { ok, fail } from "@/types";

const isAdmin = (r: string) => r === "admin" || r === "owner";

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
    if (!isAdmin(actor.role)) return fail("Tidak berwenang melihat laporan keuangan.");
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
    if (!isAdmin(actor.role)) return fail("Tidak berwenang melihat laporan piutang.");

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
    if (!isAdmin(actor.role)) return fail("Tidak berwenang melihat laporan produksi.");

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
    if (!isAdmin(actor.role)) return fail("Tidak berwenang.");

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
