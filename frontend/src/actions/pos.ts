"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { retryOnUnique } from "@/lib/retry";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

/** Satu baris keranjang kasir. `retailProductId` null = item custom/manual. */
export interface RetailCartLine {
  retailProductId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export interface ProcessRetailOrderInput {
  items: RetailCartLine[];
  customerId?: string | null;
  /** nominal diskon (Rp), bukan persen */
  discount?: number;
  /** pajak yang sudah dihitung di UI (Rp); 0 kalau tidak kena PPN */
  tax?: number;
  payment: {
    method: "CASH" | "TRANSFER" | "QRIS";
    amountPaid: number;
    reference?: string;
  };
}

export interface ProcessRetailOrderResult {
  orderId: string;
  orderCode: string;
  total: number;
  change: number;
}

/** ORD-YYYYMMDD-XXXX — XXXX = urutan harian per tenant. */
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

/**
 * Penjualan retail (POS). Semua tulis DB dalam satu transaksi:
 * orders → order_items → kurangi retail_products.stock_quantity →
 * retail_stock_movements → payments. Retail = bayar lunas di tempat.
 */
export async function processRetailOrder(
  input: ProcessRetailOrderInput
): Promise<ActionResult<ProcessRetailOrderResult>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const items = input.items?.filter((i) => i.quantity > 0) ?? [];
    if (items.length === 0) return fail("Keranjang kosong.");
    if (items.some((i) => i.unitPrice < 0)) return fail("Harga item tidak valid.");

    const discount = Math.max(0, Math.round(input.discount ?? 0));
    const tax = Math.max(0, Math.round(input.tax ?? 0));

    const result = await retryOnUnique(() => prisma.$transaction(async (tx) => {
      // Ambil produk retail yang direferensikan (item custom dilewati).
      const retailIds = items
        .map((i) => i.retailProductId)
        .filter((id): id is string => !!id);
      const products = retailIds.length
        ? await tx.retailProduct.findMany({
            where: { id: { in: retailIds }, tenant_id: tenant.id },
          })
        : [];
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const lines = items.map((i) => {
        subtotal += i.unitPrice * i.quantity;
        if (!i.retailProductId) return { input: i, product: null };

        const product = byId.get(i.retailProductId);
        if (!product) throw new Error(`Produk tidak ditemukan: ${i.name}`);
        if (product.stock_quantity < i.quantity) {
          throw new Error(
            `Stok "${product.name}" tidak cukup (sisa ${product.stock_quantity}, diminta ${i.quantity}).`
          );
        }
        return { input: i, product };
      });

      const total = Math.max(0, subtotal + tax - discount);
      if (input.payment.amountPaid + 1e-6 < total) {
        throw new Error(
          `Pembayaran kurang. Total Rp ${total.toLocaleString("id-ID")}, dibayar Rp ${input.payment.amountPaid.toLocaleString("id-ID")}.`
        );
      }
      const change = Math.max(0, input.payment.amountPaid - total);

      const order = await tx.order.create({
        data: {
          tenant_id: tenant.id,
          order_code: await nextOrderCode(tx, tenant.id),
          order_type: "RETAIL",
          customer_id: input.customerId || null,
          created_by: actor.id,
          status: "CLOSED", // retail selesai di kasir
          subtotal,
          discount,
          total,
          paid_amount: total,
          balance: 0,
          closed_at: new Date(),
        },
      });

      for (const { input: i, product } of lines) {
        await tx.orderItem.create({
          data: {
            tenant_id: tenant.id,
            order_id: order.id,
            retail_product_id: product?.id ?? null,
            description: i.notes ? `${i.name} — ${i.notes}` : i.name,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            total_price: i.unitPrice * i.quantity,
          },
        });

        if (product) {
          // Pengurangan stok atomik — cegah oversell saat 2 kasir jual unit terakhir.
          const dec = await tx.retailProduct.updateMany({
            where: { id: product.id, tenant_id: tenant.id, stock_quantity: { gte: i.quantity } },
            data: { stock_quantity: { decrement: i.quantity } },
          });
          if (dec.count === 0) {
            throw new Error(`Stok "${product.name}" tidak cukup atau berubah — transaksi dibatalkan.`);
          }
          const fresh = await tx.retailProduct.findUnique({
            where: { id: product.id },
            select: { stock_quantity: true },
          });
          const after = fresh!.stock_quantity;
          const before = after + i.quantity;
          await tx.retailStockMovement.create({
            data: {
              tenant_id: tenant.id,
              retail_product_id: product.id,
              order_id: order.id,
              movement_type: "OUT",
              quantity_change: -i.quantity,
              before_stock: before,
              after_stock: after,
              performed_by: actor.id,
              reason: `Penjualan retail ${order.order_code}`,
            },
          });
        }
      }

      await tx.payment.create({
        data: {
          tenant_id: tenant.id,
          order_id: order.id,
          amount: total,
          method: input.payment.method,
          reference: input.payment.reference || null,
          status: "CONFIRMED",
          received_by: actor.id,
        },
      });

      return { orderId: order.id, orderCode: order.order_code, total, change };
    }));

    revalidatePath("/pos");
    revalidatePath("/admin/products");
    revalidatePath("/admin/reports");
    return ok(result);
  } catch (e) {
    console.error("processRetailOrder:", e);
    return fail(e instanceof Error ? e.message : "Gagal memproses transaksi.");
  }
}

export interface VoidRetailOrderInput {
  reason: string;
  /** metode pengembalian dana: CASH/TRANSFER/QRIS */
  refundMethod?: string;
}

/**
 * Batalkan / void transaksi retail (POS) yang sudah CLOSED.
 * - Admin & Owner boleh; Admin hanya untuk transaksi hari yang sama, Owner kapan saja.
 * - Stok dikembalikan + RetailStockMovement IN kompensasi (movement OUT lama tetap).
 * - Refund dicatat sebagai Payment negatif; order → CANCELLED.
 */
export async function voidRetailOrder(
  orderId: string,
  input: VoidRetailOrderInput
): Promise<ActionResult<{ orderCode: string; refundAmount: number; restocked: number }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "admin" && actor.role !== "owner") {
      return fail("Hanya Admin atau Owner yang boleh membatalkan transaksi retail.");
    }
    if (!input.reason?.trim() || input.reason.trim().length < 5) {
      return fail("Alasan pembatalan wajib diisi (min. 5 karakter).");
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenant_id: tenant.id },
        include: { items: true },
      });
      if (!order) throw new Error("Order tidak ditemukan.");
      if (order.order_type !== "RETAIL") throw new Error("Hanya transaksi retail yang bisa di-void di sini.");
      if (order.status === "CANCELLED") throw new Error("Transaksi ini sudah dibatalkan.");
      if (order.status !== "CLOSED") throw new Error(`Status ${order.status} tidak bisa di-void.`);

      const sameDay = order.created_at.toDateString() === new Date().toDateString();
      if (actor.role !== "owner" && !sameDay) {
        throw new Error("Transaksi lewat hari hanya bisa dibatalkan oleh Owner.");
      }

      let restocked = 0;
      for (const it of order.items) {
        if (!it.retail_product_id) continue;
        await tx.retailProduct.update({
          where: { id: it.retail_product_id },
          data: { stock_quantity: { increment: it.quantity } },
        });
        const fresh = await tx.retailProduct.findUnique({
          where: { id: it.retail_product_id },
          select: { stock_quantity: true },
        });
        const after = fresh!.stock_quantity;
        const before = after - it.quantity;
        await tx.retailStockMovement.create({
          data: {
            tenant_id: tenant.id,
            retail_product_id: it.retail_product_id,
            order_id: order.id,
            movement_type: "IN",
            quantity_change: it.quantity,
            before_stock: before,
            after_stock: after,
            performed_by: actor.id,
            reason: `Void penjualan retail ${order.order_code}`,
          },
        });
        restocked += it.quantity;
      }

      const refundAmount = Number(order.paid_amount);
      const refundMethod = input.refundMethod || "CASH";
      if (refundAmount > 0) {
        await tx.payment.create({
          data: {
            tenant_id: tenant.id,
            order_id: order.id,
            amount: -refundAmount,
            method: refundMethod,
            reference: `REFUND ${order.order_code}`,
            status: "CONFIRMED",
            received_by: actor.id,
            notes: `Void retail: ${input.reason.trim()}`,
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancelled_at: new Date(),
          cancelled_by: actor.id,
          cancellation_reason: input.reason.trim(),
          cancellation_approved_by: actor.id,
          paid_amount: 0,
          balance: 0,
          dp_refund_amount: refundAmount,
          dp_refund_method: refundAmount > 0 ? refundMethod : null,
        },
      });

      return { orderCode: order.order_code, refundAmount, restocked };
    });

    await logAction(actor.id, "RETAIL_ORDER_VOIDED", "Order", orderId, null, {
      reason: input.reason.trim(),
      refund: result.refundAmount,
      restocked: result.restocked,
    });
    revalidatePath("/pos");
    revalidatePath("/admin/products");
    revalidatePath("/admin/reports");
    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("voidRetailOrder:", e);
    return fail(e instanceof Error ? e.message : "Gagal membatalkan transaksi retail.");
  }
}

/** Data awal halaman kasir: produk retail aktif + daftar customer. */
export async function getPosData() {
  try {
    const tenant = await requireTenant();

    const [products, customers] = await Promise.all([
      prisma.retailProduct.findMany({
        where: { tenant_id: tenant.id, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({
        where: { tenant_id: tenant.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true, default_discount: true },
      }),
    ]);

    return ok({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: Number(p.price),
        stock: p.stock_quantity,
      })),
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        defaultDiscountRp: c.default_discount ? Number(c.default_discount) : 0,
      })),
    });
  } catch (e) {
    console.error("getPosData:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat data kasir.");
  }
}
