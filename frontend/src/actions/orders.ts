"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { retryOnUnique } from "@/lib/retry";
import { ok, fail, type ActionResult } from "@/types";

type OrderTypeInput = "walkin" | "online" | "makloon";

const APPROVAL_METHOD: Record<OrderTypeInput, string> = {
  walkin: "WALK_IN",
  online: "ONLINE",
  makloon: "MAKLOON",
};

export interface PrintingOrderItemInput {
  productId?: string | null;
  description?: string;
  width?: number;
  height?: number;
  quantity: number;
  materialId?: string | null;
  finishing?: string | null;
  unitPrice: number;
}

export interface CreatePrintingOrderInput {
  /** id customer lama, atau data untuk buat customer baru */
  customer: { id: string } | { name: string; phone?: string; type?: string };
  orderType: OrderTypeInput;
  designerId?: string | null;
  deadline?: string | null;
  notes?: string | null;
  items: PrintingOrderItemInput[];
  /** nominal diskon (Rp) — butuh approval Owner kalau > 0 */
  discount?: number;
  discountReason?: string;
  /** override persen DP (admin ≥30, owner bebas); default 50 */
  dpOverridePct?: number | null;
  dpOverrideReason?: string | null;
}

export interface CreatePrintingOrderResult {
  orderId: string;
  orderCode: string;
  subtotal: number;
  total: number;
  dpRequired: number;
  discountPending: boolean;
}

/** ORD-YYYYMMDD-XXXX — urutan harian per tenant. */
async function nextOrderCode(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const startOfDay = new Date(y, now.getMonth(), now.getDate());
  const countToday = await tx.order.count({
    where: { tenant_id: tenantId, created_at: { gte: startOfDay } },
  });
  return `ORD-${y}${m}${d}-${String(countToday + 1).padStart(4, "0")}`;
}

async function nextCustomerCode(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const count = await tx.customer.count({ where: { tenant_id: tenantId } });
  return `CST-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Buat order PRINTING (status DRAFT).
 * - hitung otomatis dp_required = total × 50% (atau × dpOverridePct)
 * - buat baris DesignJob kosong (status PENDING) untuk orkestrasi desain
 * - kalau ada diskon: order dibuat dengan diskon "menggantung" sampai
 *   Owner memanggil decideDiscount()
 */
export async function createPrintingOrder(
  input: CreatePrintingOrderInput
): Promise<ActionResult<CreatePrintingOrderResult>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const items = (input.items ?? []).filter((i) => i.quantity > 0);
    if (items.length === 0) return fail("Order harus punya minimal 1 item.");
    if (items.some((i) => i.unitPrice < 0)) return fail("Harga item tidak valid.");

    const dpPct = input.dpOverridePct ?? 50;
    if (dpPct < 0 || dpPct > 100) return fail("Persen DP tidak valid.");
    if (input.dpOverridePct != null && input.dpOverridePct < 50) {
      // Aturan 13 / 04-PAYMENT.md:
      //  - walk-in: override <50% HANYA Owner (Admin dilarang).
      //  - online/makloon: Admin boleh sampai min 30%, Owner bebas.
      const isWalkin = input.orderType === "walkin";
      if (actor.role !== "admin" && actor.role !== "owner") {
        return fail("Hanya Owner/Admin yang boleh override DP di bawah 50%.");
      }
      if (isWalkin && actor.role !== "owner") {
        return fail("Override DP di bawah 50% untuk order walk-in hanya boleh oleh Owner.");
      }
      if (actor.role === "admin" && input.dpOverridePct < 30) {
        return fail("Admin hanya boleh override DP sampai minimal 30% (order online/makloon).");
      }
      if (!input.dpOverrideReason) return fail("Override DP wajib menyertakan alasan.");
    }

    const discount = Math.max(0, Math.round(input.discount ?? 0));
    if (discount > 0 && !input.discountReason) {
      return fail("Diskon wajib menyertakan alasan.");
    }

    const result = await retryOnUnique(() => prisma.$transaction(async (tx) => {
      // 1. Customer
      let customerId: string | null = null;
      if ("id" in input.customer) {
        const c = await tx.customer.findFirst({
          where: { id: input.customer.id, tenant_id: tenant.id },
        });
        if (!c) throw new Error("Customer tidak ditemukan.");
        customerId = c.id;
      } else if (input.customer.name?.trim()) {
        const created = await tx.customer.create({
          data: {
            tenant_id: tenant.id,
            customer_code: await nextCustomerCode(tx, tenant.id),
            name: input.customer.name.trim(),
            phone: input.customer.phone || null,
            type: input.customer.type || "Umum",
            created_by: actor.id,
          },
        });
        customerId = created.id;
      }

      // 2. Totals — diskon TIDAK dipotong sebelum di-approve Owner (aturan 14).
      //    `discount` disimpan sebagai permintaan; total/dp/balance tetap harga penuh
      //    sampai decideDiscount(approve) dipanggil.
      let subtotal = 0;
      for (const i of items) subtotal += i.unitPrice * i.quantity;
      const total = subtotal;
      const dpRequired = Math.round((total * dpPct) / 100);

      // 3. Order (DRAFT)
      const order = await tx.order.create({
        data: {
          tenant_id: tenant.id,
          order_code: await nextOrderCode(tx, tenant.id),
          order_type: "PRINTING",
          customer_id: customerId,
          created_by: actor.id,
          designer_id: input.designerId || null,
          status: "DRAFT",
          subtotal,
          discount, // permintaan diskon — belum dipotong; discount_approved_by null = menggantung
          discount_reason: discount > 0 ? input.discountReason : null,
          total,
          dp_required: dpRequired,
          dp_override_pct: input.dpOverridePct ?? null,
          dp_override_by: input.dpOverridePct != null ? actor.id : null,
          dp_override_reason: input.dpOverrideReason || null,
          paid_amount: 0,
          balance: total,
          deadline: input.deadline ? new Date(input.deadline) : null,
          notes: input.notes || null,
        },
      });

      // 4. Items
      for (const i of items) {
        const size =
          i.width && i.height ? `${i.width}x${i.height}` : i.width ? `${i.width}` : null;
        await tx.orderItem.create({
          data: {
            tenant_id: tenant.id,
            order_id: order.id,
            product_id: i.productId || null,
            description: i.description || null,
            quantity: i.quantity,
            size,
            material_id: i.materialId || null,
            finishing: i.finishing || null,
            unit_price: i.unitPrice,
            total_price: i.unitPrice * i.quantity,
          },
        });
      }

      // 5. DesignJob kosong
      let designerId = input.designerId || null;
      if (!designerId) {
        const designer = await tx.user.findFirst({
          where: { tenant_id: tenant.id, active: true, role: { name: "designer_sales" } },
          orderBy: { created_at: "asc" },
        });
        designerId = designer?.id ?? actor.id;
      }
      await tx.designJob.create({
        data: {
          tenant_id: tenant.id,
          order_id: order.id,
          designer_id: designerId,
          status: "PENDING",
          current_version: 1,
          approval_method: APPROVAL_METHOD[input.orderType],
        },
      });

      return {
        orderId: order.id,
        orderCode: order.order_code,
        subtotal,
        total,
        dpRequired,
        discountPending: discount > 0,
      };
    }));

    await logAction(actor.id, "ORDER_CREATED", "Order", result.orderId, null, {
      order_code: result.orderCode,
      total: result.total,
      dp_required: result.dpRequired,
    });

    revalidatePath("/admin");
    revalidatePath("/designer");
    return ok(result);
  } catch (e) {
    console.error("createPrintingOrder:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat order.");
  }
}

export interface AddPaymentInput {
  amount: number;
  method: "CASH" | "TRANSFER" | "QRIS";
  reference?: string;
  notes?: string;
}

export interface AddPaymentResult {
  paidAmount: number;
  balance: number;
  status: string;
  dpMet: boolean;
  fullyPaid: boolean;
}

/**
 * Catat pembayaran (hanya Admin/Owner). Hitung ulang paid_amount & balance,
 * naikkan status order kalau DP sudah terpenuhi.
 */
export async function addPayment(
  orderId: string,
  input: AddPaymentInput
): Promise<ActionResult<AddPaymentResult>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "admin" && actor.role !== "owner") {
      return fail("Hanya Admin/Owner yang boleh mengkonfirmasi pembayaran.");
    }
    if (!(input.amount > 0)) return fail("Nominal pembayaran harus lebih dari 0.");

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenant_id: tenant.id },
      });
      if (!order) throw new Error("Order tidak ditemukan.");

      await tx.payment.create({
        data: {
          tenant_id: tenant.id,
          order_id: order.id,
          amount: input.amount,
          method: input.method,
          reference: input.reference || null,
          status: "CONFIRMED",
          received_by: actor.id,
          notes: input.notes || null,
        },
      });

      const agg = await tx.payment.aggregate({
        where: { order_id: order.id, status: "CONFIRMED" },
        _sum: { amount: true },
      });
      const paidAmount = Number(agg._sum.amount ?? 0);
      const total = Number(order.total);
      const balance = Math.max(0, total - paidAmount);
      const dpRequired = Number(order.dp_required ?? Math.round(total * 0.5));
      const dpMet = paidAmount + 1e-6 >= dpRequired;

      let status = order.status;
      if (dpMet && order.status === "WAITING_PAYMENT") status = "CONFIRMED";

      await tx.order.update({
        where: { id: order.id },
        data: { paid_amount: paidAmount, balance, status },
      });

      return { paidAmount, balance, status, dpMet, fullyPaid: balance <= 0 };
    });

    await logAction(actor.id, "PAYMENT_ADDED", "Order", orderId, null, {
      amount: input.amount,
      method: input.method,
      paid_amount: result.paidAmount,
      balance: result.balance,
    });

    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("addPayment:", e);
    return fail(e instanceof Error ? e.message : "Gagal mencatat pembayaran.");
  }
}

/** Owner/Admin menyetujui atau menolak diskon yang menggantung. */
export async function decideDiscount(
  orderId: string,
  decision: { approve: boolean; note?: string }
): Promise<ActionResult<{ discount: number; total: number; dpRequired: number; approved: boolean }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    // Aturan 14: keputusan diskon HANYA Owner (Admin cuma mengajukan).
    if (actor.role !== "owner") {
      return fail("Hanya Owner yang boleh memutuskan diskon.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      if (!order) throw new Error("Order tidak ditemukan.");
      if (Number(order.discount) <= 0) throw new Error("Order ini tidak punya diskon.");
      if (order.discount_approved_by) throw new Error("Diskon sudah diputuskan.");

      const subtotal = Number(order.subtotal);
      let discount = Number(order.discount);
      if (!decision.approve) discount = 0;

      const total = Math.max(0, subtotal - discount);
      const dpPct = Number(order.dp_override_pct ?? 50);
      const dpRequired = Math.round((total * dpPct) / 100);
      const paid = Number(order.paid_amount);

      // Diskon di-approve bisa membuat DP jadi terpenuhi → majukan status.
      let status = order.status;
      if (order.status === "WAITING_PAYMENT" && paid + 1e-6 >= dpRequired) status = "CONFIRMED";

      await tx.order.update({
        where: { id: order.id },
        data: {
          discount,
          total,
          dp_required: dpRequired,
          balance: Math.max(0, total - paid),
          status,
          discount_approved_by: decision.approve ? actor.id : null,
          discount_approved_at: decision.approve ? new Date() : null,
          discount_reason: decision.note || order.discount_reason,
        },
      });

      return { discount, total, dpRequired, approved: decision.approve };
    });

    await logAction(
      actor.id,
      decision.approve ? "DISCOUNT_APPROVED" : "DISCOUNT_REJECTED",
      "Order",
      orderId,
      null,
      { discount: result.discount, total: result.total, note: decision.note }
    );

    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok(result);
  } catch (e) {
    console.error("decideDiscount:", e);
    return fail(e instanceof Error ? e.message : "Gagal memproses keputusan diskon.");
  }
}

/**
 * Ajukan diskon pada order yang sudah ada (tombol "Ajukan Diskon").
 * Admin & Owner boleh mengajukan; keputusan tetap lewat decideDiscount() (Owner).
 * Diskon tidak bisa diajukan setelah order CLOSED (DEADLINE-DISCOUNT.md).
 */
export async function requestDiscount(
  orderId: string,
  input: { amount: number; reason: string }
): Promise<ActionResult<{ discount: number }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner" && actor.role !== "admin") {
      return fail("Hanya Owner atau Admin yang boleh mengajukan diskon.");
    }

    const amount = Math.max(0, Math.round(input.amount ?? 0));
    if (amount <= 0) return fail("Nominal diskon harus lebih dari 0.");
    if (!input.reason || input.reason.trim().length < 5) return fail("Alasan diskon wajib diisi (min. 5 karakter).");

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
    if (!order) return fail("Order tidak ditemukan.");
    if (["CLOSED", "CANCELLED"].includes(order.status)) return fail("Diskon tidak bisa diajukan pada order yang sudah selesai/batal.");
    if (Number(order.discount) > 0 && order.discount_approved_by) {
      return fail("Order ini sudah punya diskon yang disetujui. Buat koreksi untuk mengubahnya.");
    }
    if (amount >= Number(order.subtotal)) return fail("Diskon tidak boleh melebihi subtotal order.");

    await prisma.order.update({
      where: { id: order.id },
      data: {
        discount: amount,
        discount_reason: input.reason.trim(),
        discount_approved_by: null,
        discount_approved_at: null,
      },
    });

    await logAction(actor.id, "DISCOUNT_REQUESTED", "Order", orderId, { discount: Number(order.discount) }, { discount: amount, reason: input.reason.trim() });
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok({ discount: amount });
  } catch (e) {
    console.error("requestDiscount:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengajukan diskon.");
  }
}

/** Data pendukung form order baru. */
export async function getOrderFormData() {
  try {
    const tenant = await requireTenant();
    const [customers, products, materials, designers] = await Promise.all([
      prisma.customer.findMany({
        where: { tenant_id: tenant.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true, type: true, default_discount: true },
      }),
      prisma.product.findMany({
        where: { tenant_id: tenant.id, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true, default_material_id: true },
      }),
      prisma.material.findMany({
        where: { tenant_id: tenant.id, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, material_code: true, type: true },
      }),
      prisma.user.findMany({
        where: { tenant_id: tenant.id, active: true, role: { name: "designer_sales" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return ok({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        type: c.type,
        defaultDiscountRp: c.default_discount ? Number(c.default_discount) : 0,
      })),
      products,
      materials,
      designers,
    });
  } catch (e) {
    console.error("getOrderFormData:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat data form order.");
  }
}
