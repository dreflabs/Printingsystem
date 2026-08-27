"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

/**
 * Admin mengajukan pembatalan order yang produksinya sudah berjalan.
 * Tidak langsung membatalkan — hanya menandai request (cancellation_reason terisi,
 * cancelled_at masih null) supaya muncul di antrian approval Owner.
 */
export async function requestOrderCancellation(
  orderId: string,
  reason: string
): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "admin" && actor.role !== "owner") return fail("Hanya Admin/Owner yang bisa mengajukan pembatalan.");
    if (!reason?.trim()) return fail("Alasan pembatalan wajib diisi.");

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
    if (!order) return fail("Order tidak ditemukan.");
    if (["CLOSED", "CANCELLED", "PICKED_UP"].includes(order.status)) return fail(`Order ${order.status} tidak bisa dibatalkan.`);
    if (order.cancellation_reason && !order.cancelled_at) return fail("Sudah ada pengajuan pembatalan untuk order ini.");

    await prisma.order.update({
      where: { id: orderId },
      data: { cancellation_reason: reason.trim() },
    });
    await logAction(actor.id, "CANCEL_REQUESTED", "Order", orderId, null, { reason });
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok(null);
  } catch (e) {
    console.error("requestOrderCancellation:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengajukan pembatalan.");
  }
}

/** Owner memutuskan pengajuan pembatalan: approve → jalankan cancelOrder; reject → hapus request. */
export async function decideOrderCancellation(
  orderId: string,
  input: { approve: boolean; refundAmount?: number; refundMethod?: "CASH" | "TRANSFER" }
): Promise<ActionResult<{ decision: "APPROVED" | "REJECTED" }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner") return fail("Hanya Owner yang bisa memutuskan pembatalan.");

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
    if (!order) return fail("Order tidak ditemukan.");
    if (!order.cancellation_reason || order.cancelled_at) return fail("Tidak ada pengajuan pembatalan aktif.");

    if (!input.approve) {
      await prisma.order.update({ where: { id: orderId }, data: { cancellation_reason: null } });
      await logAction(actor.id, "CANCEL_REJECTED", "Order", orderId, null, null);
      revalidatePath("/owner");
      return ok({ decision: "REJECTED" });
    }

    const res = await cancelOrder(orderId, {
      reason: order.cancellation_reason,
      refundAmount: input.refundAmount,
      refundMethod: input.refundMethod,
    });
    if (!res.success) return fail(res.error);
    return ok({ decision: "APPROVED" });
  } catch (e) {
    console.error("decideOrderCancellation:", e);
    return fail(e instanceof Error ? e.message : "Gagal memproses keputusan pembatalan.");
  }
}

/** Status sebelum produksi dimulai — Admin boleh cancel, DP bisa dikembalikan. */
const PRE_PRODUCTION = [
  "DRAFT",
  "DESIGNING",
  "WAITING_APPROVAL",
  "APPROVED",
  "WAITING_PAYMENT",
  "CONFIRMED",
];
/** Tidak bisa dibatalkan sama sekali. */
const TERMINAL = ["CLOSED", "CANCELLED", "PICKED_UP", "FINAL_AUDIT_PENDING", "FINAL_AUDIT_COMPLETE"];

export interface CancelOrderInput {
  reason: string;
  category?: "CUSTOMER_CHANGED" | "DESIGN_MISMATCH" | "OTHER";
  /** pengembalian ke konsumen (Rp). Pre-produksi: default = paid_amount − designFeeDeduction. */
  refundAmount?: number;
  refundMethod?: "CASH" | "TRANSFER";
  /** potongan biaya desain (pre-produksi, jika sudah ada proses desain) */
  designFeeDeduction?: number;
}

export interface CancelOrderResult {
  orderStatus: "CANCELLED";
  dpForfeited: boolean;
  refundAmount: number;
}

/**
 * Batalkan order.
 * - Pre-produksi (DRAFT..CONFIRMED): Admin/Owner. DP dikembalikan penuh (− biaya desain).
 * - Produksi berjalan / lebih jauh: **Owner saja**. DP HANGUS; pelunasan bisa
 *   dikembalikan sebagian atas keputusan Owner (refundAmount eksplisit).
 */
export async function cancelOrder(
  orderId: string,
  input: CancelOrderInput
): Promise<ActionResult<CancelOrderResult>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!input.reason?.trim()) return fail("Alasan pembatalan wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      if (!order) throw new Error("Order tidak ditemukan.");
      if (TERMINAL.includes(order.status)) {
        throw new Error(`Order berstatus ${order.status} tidak bisa dibatalkan.`);
      }

      const paid = Number(order.paid_amount);
      const dpRequired = Number(order.dp_required ?? Math.round(Number(order.total) * 0.5));
      const preProduction = PRE_PRODUCTION.includes(order.status);

      // Otorisasi
      if (preProduction) {
        if (actor.role !== "admin" && actor.role !== "owner") {
          throw new Error("Hanya Admin/Owner yang bisa membatalkan order.");
        }
      } else if (actor.role !== "owner") {
        throw new Error("Order sudah masuk produksi — hanya Owner yang bisa membatalkan (DP HANGUS).");
      }

      // Perhitungan refund
      let refundAmount: number;
      let dpForfeited: boolean;
      if (preProduction) {
        dpForfeited = false;
        const deduction = Math.max(0, Math.round(input.designFeeDeduction ?? 0));
        refundAmount =
          input.refundAmount != null
            ? Math.max(0, Math.min(Math.round(input.refundAmount), paid))
            : Math.max(0, paid - deduction);
      } else {
        dpForfeited = true;
        // DP hangus; hanya kelebihan di atas DP (pelunasan) yang boleh dikembalikan, atas keputusan Owner
        const refundable = Math.max(0, paid - dpRequired);
        refundAmount = Math.max(0, Math.min(Math.round(input.refundAmount ?? 0), refundable));
      }
      if (refundAmount > 0 && !input.refundMethod) {
        throw new Error("Metode pengembalian wajib diisi jika ada refund.");
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelled_at: new Date(),
          cancelled_by: actor.id,
          cancellation_reason: input.reason.trim(),
          dp_refund_amount: refundAmount,
          dp_refund_method: refundAmount > 0 ? input.refundMethod : null,
          cancellation_approved_by: preProduction ? null : actor.id,
        },
      });

      // Hentikan job produksi (material yang sudah keluar TETAP tercatat)
      await tx.productionJob.updateMany({
        where: { order_id: orderId, status: { notIn: ["PICKED_UP", "CANCELLED"] } },
        data: { status: "CANCELLED" },
      });

      // Lepas barang dari storage (jadi milik percetakan)
      const storedItems = await tx.storageItem.findMany({
        where: { job: { order_id: orderId }, status: { in: ["STORED", "IN_TRANSIT"] } },
      });
      for (const it of storedItems) {
        await tx.storageItem.update({
          where: { id: it.id },
          data: { status: "RELEASED", released_by: actor.id, released_at: new Date() },
        });
        if (it.status === "STORED") {
          await tx.storageLocation.update({
            where: { id: it.location_id },
            data: { capacity_current: { decrement: 1 } },
          });
        }
      }

      return { orderStatus: "CANCELLED" as const, dpForfeited, refundAmount };
    });

    await logAction(actor.id, "ORDER_CANCELLED", "Order", orderId, null, {
      reason: input.reason,
      dp_forfeited: result.dpForfeited,
      refund_amount: result.refundAmount,
      refund_method: input.refundMethod,
    });
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok(result);
  } catch (e) {
    console.error("cancelOrder:", e);
    return fail(e instanceof Error ? e.message : "Gagal membatalkan order.");
  }
}
