"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

const isAdmin = (r: string) => r === "admin" || r === "owner";

export interface FinalAuditItemInput {
  category: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  expectedValue?: string;
  actualValue?: string;
  difference?: string;
  status: string;
  note?: string;
}

export interface SubmitFinalAuditInput {
  result: "GREEN" | "YELLOW" | "RED";
  financialStatus: string;
  materialStatus: string;
  quantityStatus: string;
  productionStatus: string;
  storageStatus: string;
  notes?: string;
  items?: FinalAuditItemInput[];
}

/**
 * Final Audit oleh Admin.
 * GREEN → order CLOSED. YELLOW → FINAL_AUDIT_COMPLETE (tunggu approve Owner).
 * RED → ON_HOLD (tidak bisa CLOSED, wajib investigasi Owner).
 */
export async function submitFinalAudit(
  orderId: string,
  input: SubmitFinalAuditInput
): Promise<ActionResult<{ result: string; orderStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!isAdmin(actor.role)) return fail("Hanya Admin/Owner yang boleh submit final audit.");

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      if (!order) throw new Error("Order tidak ditemukan.");
      if (order.status !== "FINAL_AUDIT_PENDING") {
        throw new Error(`Order tidak dalam FINAL_AUDIT_PENDING (sekarang: ${order.status}).`);
      }

      const items = input.items ?? [];
      const exceptionCount = items.filter((i) => i.severity !== "INFO").length;

      const audit = await tx.audit.create({
        data: {
          tenant_id: tenant.id,
          order_id: orderId,
          audited_by_id: actor.id,
          result: input.result,
          financial_status: input.financialStatus,
          material_status: input.materialStatus,
          quantity_status: input.quantityStatus,
          production_status: input.productionStatus,
          storage_status: input.storageStatus,
          exception_count: exceptionCount,
          notes: input.notes || null,
        },
      });
      for (const it of items) {
        await tx.auditItem.create({
          data: {
            tenant_id: tenant.id,
            audit_id: audit.id,
            category: it.category,
            severity: it.severity,
            expected_value: it.expectedValue || null,
            actual_value: it.actualValue || null,
            difference: it.difference || null,
            status: it.status,
            note: it.note || null,
          },
        });
      }

      let orderStatus: string;
      if (input.result === "GREEN") {
        orderStatus = "CLOSED";
        await tx.order.update({ where: { id: orderId }, data: { status: "CLOSED", closed_at: new Date() } });
      } else if (input.result === "YELLOW") {
        orderStatus = "FINAL_AUDIT_COMPLETE";
        await tx.order.update({ where: { id: orderId }, data: { status: "FINAL_AUDIT_COMPLETE" } });
      } else {
        orderStatus = "ON_HOLD";
        await tx.order.update({ where: { id: orderId }, data: { status: "ON_HOLD" } });
      }

      return { auditId: audit.id, result: input.result, orderStatus };
    });

    await logAction(actor.id, "FINAL_AUDIT_SUBMITTED", "Order", orderId, null, {
      result: result.result,
      audit_id: result.auditId,
    });
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok({ result: result.result, orderStatus: result.orderStatus });
  } catch (e) {
    console.error("submitFinalAudit:", e);
    return fail(e instanceof Error ? e.message : "Gagal submit final audit.");
  }
}

/** Owner menyetujui / menolak hasil audit YELLOW. */
export async function approveFinalAudit(
  orderId: string,
  input: { approve: boolean; note?: string }
): Promise<ActionResult<{ orderStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh menyetujui audit.");

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      if (!order) throw new Error("Order tidak ditemukan.");
      if (order.status !== "FINAL_AUDIT_COMPLETE") {
        throw new Error("Order tidak menunggu persetujuan audit.");
      }
      const audit = await tx.audit.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
        orderBy: { audited_at: "desc" },
      });
      if (audit) {
        await tx.audit.update({
          where: { id: audit.id },
          data: { approved_by: actor.id, approved_at: new Date(), notes: input.note || audit.notes },
        });
      }

      const orderStatus = input.approve ? "CLOSED" : "ON_HOLD";
      await tx.order.update({
        where: { id: orderId },
        data: { status: orderStatus, closed_at: input.approve ? new Date() : null },
      });
      return { orderStatus };
    });

    await logAction(actor.id, input.approve ? "FINAL_AUDIT_APPROVED" : "FINAL_AUDIT_REJECTED", "Order", orderId, null, {
      note: input.note,
    });
    revalidatePath("/owner");
    return ok(result);
  } catch (e) {
    console.error("approveFinalAudit:", e);
    return fail(e instanceof Error ? e.message : "Gagal memproses persetujuan audit.");
  }
}

export interface CreateCorrectionInput {
  correctedEntity: string;
  correctedId: string;
  category: "FINANCIAL" | "MATERIAL" | "QUANTITY" | "OTHER";
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  reason: string;
}

/**
 * Koreksi order yang sudah CLOSED — record BARU, tidak mengubah data asli.
 * Owner: semua kategori. Admin: hanya non-FINANCIAL, dan butuh approve Owner.
 */
export async function createCorrection(
  orderId: string,
  input: CreateCorrectionInput
): Promise<ActionResult<{ correctionId: string; needsApproval: boolean }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh membuat koreksi.");
    if (actor.role === "admin" && input.category === "FINANCIAL") {
      return fail("Koreksi keuangan hanya boleh dibuat Owner.");
    }
    if (!input.reason || input.reason.trim().length < 20) {
      return fail("Alasan koreksi wajib minimal 20 karakter.");
    }

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
    if (!order) return fail("Order tidak ditemukan.");
    if (order.status !== "CLOSED") return fail("Koreksi hanya untuk order berstatus CLOSED.");

    const isOwner = actor.role === "owner";
    const correction = await prisma.correction.create({
      data: {
        tenant_id: tenant.id,
        order_id: orderId,
        corrected_entity: input.correctedEntity,
        corrected_id: input.correctedId,
        category: input.category,
        field_name: input.fieldName,
        old_value: input.oldValue ?? null,
        new_value: input.newValue ?? null,
        reason: input.reason.trim(),
        created_by: actor.id,
        approved_by: isOwner ? actor.id : null,
        approved_at: isOwner ? new Date() : null,
      },
    });

    await logAction(actor.id, "CORRECTION_CREATED", input.correctedEntity, input.correctedId, input.oldValue ?? null, {
      new_value: input.newValue,
      reason: input.reason,
      order_id: orderId,
    });
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok({ correctionId: correction.id, needsApproval: !isOwner });
  } catch (e) {
    console.error("createCorrection:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat koreksi.");
  }
}

export async function approveCorrection(
  correctionId: string,
  input: { approve: boolean }
): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh menyetujui koreksi.");

    const correction = await prisma.correction.findFirst({
      where: { id: correctionId, tenant_id: tenant.id },
    });
    if (!correction) return fail("Koreksi tidak ditemukan.");
    if (correction.approved_by) return fail("Koreksi sudah diputuskan.");

    if (input.approve) {
      await prisma.correction.update({
        where: { id: correctionId },
        data: { approved_by: actor.id, approved_at: new Date() },
      });
    } else {
      // tolak = hapus draft koreksi (belum berpengaruh ke data manapun)
      await prisma.correction.delete({ where: { id: correctionId } });
    }

    await logAction(actor.id, input.approve ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED", "Correction", correctionId, null, null);
    revalidatePath("/owner");
    return ok(null);
  } catch (e) {
    console.error("approveCorrection:", e);
    return fail(e instanceof Error ? e.message : "Gagal memproses koreksi.");
  }
}

export async function listCorrections(orderId?: string) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const corrections = await prisma.correction.findMany({
      where: { tenant_id: tenant.id, ...(orderId ? { order_id: orderId } : {}) },
      orderBy: { created_at: "desc" },
      include: { order: { select: { order_code: true } } },
    });
    return ok(corrections);
  } catch (e) {
    console.error("listCorrections:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat koreksi.");
  }
}
