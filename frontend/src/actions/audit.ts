"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor } from "@/lib/actor";
import { logAction, logActionInTransaction } from "@/lib/logger";
import { DEAD_JOB_STATUS } from "@/lib/order-progress";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";
import { can, canAny } from "@/lib/permissions";
import { requireEntitlement } from "@/lib/entitlements";

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export type AuditCheckSeverity = "OK" | "WARN" | "CRIT";
export interface AuditCheck {
  area: "financial" | "material" | "quantity" | "production" | "storage";
  severity: AuditCheckSeverity;
  expected: string;
  actual: string;
  detail: string;
}

/**
 * Rekonsiliasi otomatis untuk Final Audit — dibaca modal audit supaya auditor
 * tidak menilai buta. Murni baca; menghitung 5 area dari data nyata (pembayaran
 * terkonfirmasi, job produksi, storage item, pemakaian bahan). `CRIT` di area
 * mana pun berarti order TIDAK boleh ditutup GREEN.
 */
export async function getFinalAuditChecks(
  orderId: string
): Promise<ActionResult<{ checks: AuditCheck[]; hasCritical: boolean }>> {
  try {
    const tenant = await requireTenant();
    await requireUser();
    await requireEntitlement(tenant.id, "audit_trail");
    const checks = await computeAuditChecks(tenant.id, orderId);
    if (!checks) return fail("Order tidak ditemukan.");
    return ok({ checks, hasCritical: checks.some((c) => c.severity === "CRIT") });
  } catch (e) {
    console.error("getFinalAuditChecks:", e);
    return fail(safeError(e, "Gagal memuat pemeriksaan audit."));
  }
}

/** Hitung 5 area rekonsiliasi audit. `null` = order tidak ditemukan. */
async function computeAuditChecks(tenantId: string, orderId: string): Promise<AuditCheck[] | null> {
  {
    const tenant = { id: tenantId };

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenant.id },
      include: {
        items: true,
        payments: { where: { status: "CONFIRMED" }, select: { amount: true } },
        production_jobs: { select: { job_code: true, status: true, planned_qty: true, actual_qty: true, parent_job_id: true } },
        pickup_records: { select: { notes: true }, orderBy: { released_at: "desc" }, take: 1 },
      },
    });
    if (!order) return null;

    const n = (d: unknown) => Number(d ?? 0);
    const checks: AuditCheck[] = [];

    // ── financial ──────────────────────────────────────────────
    const total = n(order.total);
    const paidConfirmed = order.payments.reduce((s, p) => s + n(p.amount), 0);
    const balance = total - paidConfirmed;
    const overridden = (order.pickup_records[0]?.notes ?? "").includes("OVERRIDE OWNER");
    if (balance <= 0.01) {
      checks.push({ area: "financial", severity: "OK", expected: rp(total), actual: rp(paidConfirmed), detail: "Lunas." });
    } else if (overridden) {
      checks.push({ area: "financial", severity: "WARN", expected: rp(total), actual: rp(paidConfirmed), detail: `Sisa ${rp(balance)} — barang dilepas via override Owner.` });
    } else {
      checks.push({ area: "financial", severity: "CRIT", expected: rp(total), actual: rp(paidConfirmed), detail: `Sisa tagihan ${rp(balance)} belum lunas & tanpa override.` });
    }
    if (Math.abs(n(order.paid_amount) - paidConfirmed) > 0.01) {
      checks.push({
        area: "financial", severity: "WARN",
        expected: `paid_amount ${rp(n(order.paid_amount))}`, actual: `pembayaran terkonfirmasi ${rp(paidConfirmed)}`,
        detail: "Angka terbayar di order tidak sama dengan total pembayaran terkonfirmasi.",
      });
    }

    // ── quantity ───────────────────────────────────────────────
    const liveJobs = order.production_jobs.filter((j) => !DEAD_JOB_STATUS.includes(j.status));
    const plannedQty = liveJobs.reduce((s, j) => s + j.planned_qty, 0);
    const actualQty = liveJobs.reduce((s, j) => s + j.actual_qty, 0);
    if (liveJobs.length === 0) {
      checks.push({ area: "quantity", severity: "WARN", expected: "-", actual: "-", detail: "Tidak ada job produksi (order tanpa item produksi?)." });
    } else if (actualQty === 0) {
      checks.push({ area: "quantity", severity: "CRIT", expected: `${plannedQty} pcs`, actual: "0 pcs", detail: "Tidak ada jumlah aktual tercatat di job mana pun." });
    } else if (actualQty < plannedQty) {
      checks.push({ area: "quantity", severity: "WARN", expected: `${plannedQty} pcs`, actual: `${actualQty} pcs`, detail: `Kurang ${plannedQty - actualQty} pcs dari rencana.` });
    } else {
      checks.push({ area: "quantity", severity: "OK", expected: `${plannedQty} pcs`, actual: `${actualQty} pcs`, detail: "Aktual memenuhi rencana." });
    }

    // ── production ─────────────────────────────────────────────
    const undecidedRework = order.production_jobs.filter((j) => j.status === "FAILED_REWORK");
    const notPickedUp = liveJobs.filter((j) => j.status !== "PICKED_UP");
    if (undecidedRework.length > 0) {
      checks.push({ area: "production", severity: "CRIT", expected: "semua job selesai", actual: `${undecidedRework.length} job gagal QC`, detail: `Belum diputuskan: ${undecidedRework.map((j) => j.job_code).join(", ")}.` });
    } else if (notPickedUp.length > 0) {
      checks.push({ area: "production", severity: "CRIT", expected: "semua job PICKED_UP", actual: `${notPickedUp.length} job belum`, detail: `Masih tertahan: ${notPickedUp.map((j) => `${j.job_code} (${j.status})`).join(", ")}.` });
    } else {
      checks.push({ area: "production", severity: "OK", expected: `${liveJobs.length} job`, actual: `${liveJobs.length} diserahkan`, detail: "Semua job selesai & diserahkan." });
    }

    // ── storage ───────────────────────────────────────────────
    const jobIds = order.production_jobs.map((j) => j.job_code); // for detail only
    const storageItems = await prisma.storageItem.findMany({
      where: { job: { order_id: orderId } },
      select: { status: true },
    });
    const stuck = storageItems.filter((s) => s.status === "STORED" || s.status === "IN_TRANSIT").length;
    const incident = storageItems.filter((s) => s.status === "INCIDENT").length;
    if (incident > 0) {
      checks.push({ area: "storage", severity: "CRIT", expected: "0 insiden", actual: `${incident} insiden`, detail: "Ada barang berstatus INCIDENT (hilang / tak ditemukan)." });
    } else if (stuck > 0) {
      checks.push({ area: "storage", severity: "CRIT", expected: "semua RELEASED", actual: `${stuck} belum`, detail: `${stuck} barang masih tercatat di rak/counter — belum keluar dari sistem.` });
    } else if (storageItems.length === 0) {
      checks.push({ area: "storage", severity: "WARN", expected: "≥1 storage item", actual: "0", detail: "Tidak ada catatan penyimpanan untuk order ini." });
    } else {
      checks.push({ area: "storage", severity: "OK", expected: `${storageItems.length} item`, actual: `${storageItems.length} RELEASED`, detail: "Semua barang sudah keluar dari gudang." });
    }

    // ── material ──────────────────────────────────────────────
    const moves = await prisma.materialMovement.findMany({
      where: { tenant_id: tenant.id, job: { order_id: orderId }, movement_type: { in: ["OUT", "WASTE"] } },
      select: { movement_type: true, quantity_usage: true },
    });
    const usage = moves.filter((m) => m.movement_type === "OUT").reduce((s, m) => s + n(m.quantity_usage), 0);
    const waste = moves.filter((m) => m.movement_type === "WASTE").reduce((s, m) => s + n(m.quantity_usage), 0);
    if (moves.length === 0) {
      checks.push({ area: "material", severity: "WARN", expected: "≥1 catatan pemakaian", actual: "0", detail: "Tidak ada pemakaian bahan tercatat." });
    } else {
      const ratio = usage + waste > 0 ? waste / (usage + waste) : 0;
      if (ratio > 0.2) {
        checks.push({ area: "material", severity: "WARN", expected: "waste ≤ 20%", actual: `${(ratio * 100).toFixed(0)}%`, detail: `Waste bahan ${(ratio * 100).toFixed(0)}% — di atas ambang anomali.` });
      } else {
        checks.push({ area: "material", severity: "OK", expected: "waste ≤ 20%", actual: `${(ratio * 100).toFixed(0)}%`, detail: "Pemakaian bahan wajar." });
      }
    }
    void jobIds;

    return checks;
  }
}

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
    await requireEntitlement(tenant.id, "audit_trail");
    if (!can(actor, "audit.submit")) return fail("Hanya Admin/Owner yang boleh submit final audit.");

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      if (!order) throw new Error("Order tidak ditemukan.");
      if (order.status !== "FINAL_AUDIT_PENDING") {
        throw new Error(`Order tidak dalam FINAL_AUDIT_PENDING (sekarang: ${order.status}).`);
      }

      // Safety net: rekonsiliasi otomatis. GREEN dilarang kalau ada temuan kritis
      // (job belum diserahkan, barang belum keluar gudang, tagihan belum lunas, dst).
      if (input.result === "GREEN") {
        const autoChecks = await computeAuditChecks(tenant.id, orderId);
        const crit = (autoChecks ?? []).filter((c) => c.severity === "CRIT");
        if (crit.length > 0) {
          throw new Error(
            `Tidak bisa GREEN — ada ${crit.length} temuan kritis: ${crit.map((c) => c.detail).join(" ")}`
          );
        }
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
    return fail(safeError(e, "Gagal submit final audit."));
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
    await requireEntitlement(tenant.id, "audit_trail");
    if (!can(actor, "audit.approve")) return fail("Hanya Owner yang boleh menyetujui audit.");

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
    return fail(safeError(e, "Gagal memproses persetujuan audit."));
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
  /** Wajib diisi kalau fieldName === "refund_amount": metode pengembalian dana. */
  refundMethod?: string;
}

const REFUND_FIELD_NAME = "refund_amount";

/**
 * Efek uang nyata dari koreksi FINANCIAL berkategori refund: kunci Order,
 * buat Payment negatif, kurangi paid_amount/balance. Sama seperti pola
 * refund pembatalan di cancel.ts, tapi tanpa mengubah status order (order
 * masih berjalan, cuma dikoreksi nilainya).
 */
export async function applyRefundCorrection(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  refundAmount: number,
  refundMethod: string,
  actorId: string,
  note: string
) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
  const order = await tx.order.findFirstOrThrow({ where: { id: orderId, tenant_id: tenantId } });
  const paid = Number(order.paid_amount);
  const amount = Math.max(0, Math.min(refundAmount, paid));
  if (amount <= 0) throw new Error("Nominal refund tidak valid saat diterapkan.");
  await tx.payment.create({
    data: {
      tenant_id: tenantId,
      order_id: orderId,
      amount: -amount,
      method: refundMethod,
      reference: `REFUND-KOREKSI ${order.order_code}`,
      status: "CONFIRMED",
      received_by: actorId,
      notes: note,
    },
  });
  const netPaid = paid - amount;
  await tx.order.update({
    where: { id: orderId },
    data: { paid_amount: netPaid, balance: Math.max(0, Number(order.total) - netPaid) },
  });
  await logActionInTransaction(tx, {
    tenantId,
    actorId,
    action: "CORRECTION_REFUND_APPLIED",
    entityType: "Order",
    entityId: orderId,
    newValueJson: { refund_amount: amount, method: refundMethod },
  });
}

/**
 * Koreksi order — record BARU, tidak mengubah data asli.
 * Owner: semua kategori. Admin: hanya non-FINANCIAL, dan butuh approve Owner.
 *
 * Operasional (MATERIAL/QUANTITY/OTHER) tetap CLOSED-only — masuk akal cuma
 * setelah job selesai. Koreksi FINANCIAL dibuka lebih awal: begitu
 * `paid_amount > 0`, karena justru saat itulah decideDiscount/requestDiscount
 * mengarahkan user ke alur ini (order yang masih berjalan tapi sudah dibayar
 * butuh refund/credit, bukan menunggu sampai CLOSED).
 */
export async function createCorrection(
  orderId: string,
  input: CreateCorrectionInput
): Promise<ActionResult<{ correctionId: string; needsApproval: boolean }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    await requireEntitlement(tenant.id, "audit_trail");
    if (!canAny(actor, "correction.create_operational", "correction.create_financial")) return fail("Hanya Owner/Admin yang boleh membuat koreksi.");
    // Koreksi FINANCIAL khusus Owner — batasan ini untuk yang bertindak sebagai
    // Admin saja (Owner di Solo Mode juga punya peran Admin, tetap boleh).
    if (!can(actor, "correction.create_financial") && input.category === "FINANCIAL") {
      return fail("Koreksi keuangan hanya boleh dibuat Owner.");
    }
    if (!input.reason || input.reason.trim().length < 20) {
      return fail("Alasan koreksi wajib minimal 20 karakter.");
    }

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
    if (!order) return fail("Order tidak ditemukan.");
    const eligible = order.status === "CLOSED" || (input.category === "FINANCIAL" && Number(order.paid_amount) > 0);
    if (!eligible) return fail("Koreksi hanya untuk order berstatus CLOSED, atau koreksi finansial pada order yang sudah menerima pembayaran.");

    let refundAmount: number | null = null;
    if (input.category === "FINANCIAL" && input.fieldName === REFUND_FIELD_NAME) {
      refundAmount = Math.round(Number(input.newValue));
      const paid = Number(order.paid_amount);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) return fail("Nominal refund harus lebih dari 0.");
      if (refundAmount > paid) return fail(`Nominal refund tidak boleh melebihi total yang sudah dibayar (${rp(paid)}).`);
      if (!input.refundMethod?.trim()) return fail("Metode pengembalian wajib diisi untuk koreksi refund.");
    }

    const isOwner = actor.roles.includes("owner");
    const correction = await prisma.$transaction(async (tx) => {
      const created = await tx.correction.create({
        data: {
          tenant_id: tenant.id,
          order_id: orderId,
          corrected_entity: input.correctedEntity,
          corrected_id: input.correctedId,
          category: input.category,
          field_name: input.fieldName,
          old_value: input.oldValue ?? null,
          new_value: refundAmount != null ? String(refundAmount) : (input.newValue ?? null),
          refund_method: refundAmount != null ? input.refundMethod!.trim() : null,
          reason: input.reason.trim(),
          created_by: actor.id,
          approved_by: isOwner ? actor.id : null,
          approved_at: isOwner ? new Date() : null,
        },
      });
      // Owner membuat koreksi = otomatis approved (lihat approved_by di atas),
      // jadi efek refund harus diterapkan sekarang juga, bukan menunggu approveCorrection
      // yang tidak akan pernah dipanggil untuk koreksi yang sudah approved.
      if (isOwner && refundAmount != null) {
        await applyRefundCorrection(
          tx,
          tenant.id,
          orderId,
          refundAmount,
          input.refundMethod!.trim(),
          actor.id,
          `Refund via koreksi (Owner): ${input.reason.trim()}`
        );
      }
      return created;
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
    return fail(safeError(e, "Gagal membuat koreksi."));
  }
}

export async function approveCorrection(
  correctionId: string,
  input: { approve: boolean }
): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    await requireEntitlement(tenant.id, "audit_trail");
    if (!can(actor, "correction.approve")) return fail("Hanya Owner yang boleh menyetujui koreksi.");

    const correction = await prisma.correction.findFirst({
      where: { id: correctionId, tenant_id: tenant.id },
    });
    if (!correction) return fail("Koreksi tidak ditemukan.");
    if (correction.approved_by) return fail("Koreksi sudah diputuskan.");

    if (input.approve) {
      await prisma.$transaction(async (tx) => {
        await tx.correction.update({
          where: { id: correctionId },
          data: { approved_by: actor.id, approved_at: new Date() },
        });
        if (correction.category === "FINANCIAL" && correction.field_name === REFUND_FIELD_NAME) {
          if (!correction.refund_method) throw new Error("Koreksi ini tidak punya metode refund — tidak bisa diterapkan.");
          await applyRefundCorrection(
            tx,
            tenant.id,
            correction.order_id,
            Math.round(Number(correction.new_value ?? 0)),
            correction.refund_method,
            actor.id,
            `Refund via koreksi (disetujui): ${correction.reason ?? ""}`
          );
        }
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
    return fail(safeError(e, "Gagal memproses koreksi."));
  }
}

export async function listCorrections(orderId?: string) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    await requireEntitlement(tenant.id, "audit_trail");
    const corrections = await prisma.correction.findMany({
      where: { tenant_id: tenant.id, ...(orderId ? { order_id: orderId } : {}) },
      orderBy: { created_at: "desc" },
      include: { order: { select: { order_code: true } } },
    });
    return ok(corrections);
  } catch (e) {
    console.error("listCorrections:", e);
    return fail(safeError(e, "Gagal memuat koreksi."));
  }
}
