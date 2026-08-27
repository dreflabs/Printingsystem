"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

const isAdmin = (role: string) => role === "admin" || role === "owner";

async function nextJobCode(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const startOfDay = new Date(y, now.getMonth(), now.getDate());
  const countToday = await tx.productionJob.count({
    where: { tenant_id: tenantId, created_at: { gte: startOfDay } },
  });
  return `JOB-${y}${m}${d}-${String(countToday + 1).padStart(4, "0")}`;
}

/** Ambil DesignJob sebuah order beserta semua versinya. */
export async function getDesignJob(orderId: string) {
  try {
    const tenant = await requireTenant();
    const job = await prisma.designJob.findFirst({
      where: { order_id: orderId, tenant_id: tenant.id },
      include: { versions: { orderBy: { version_no: "asc" } } },
    });
    if (!job) return fail("Design job tidak ditemukan untuk order ini.");
    return ok(job);
  } catch (e) {
    console.error("getDesignJob:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat design job.");
  }
}

export interface UploadDesignVersionInput {
  filePath: string;
  previewPath?: string | null;
  notes?: string | null;
}

/**
 * Upload versi desain baru. Untuk MAKLOON (file dari konsumen) versi langsung
 * APPROVED. Untuk WALK_IN / ONLINE versi berstatus PENDING menunggu approve.
 */
export async function uploadDesignVersion(
  orderId: string,
  input: UploadDesignVersionInput
): Promise<ActionResult<{ versionNo: number; approvalStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!input.filePath?.trim()) return fail("Path file desain wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job) throw new Error("Design job tidak ditemukan.");

      const last = await tx.designVersion.findFirst({
        where: { design_job_id: job.id },
        orderBy: { version_no: "desc" },
      });
      const versionNo = (last?.version_no ?? 0) + 1;

      const makloon = job.approval_method === "MAKLOON";
      const approvalStatus = makloon ? "APPROVED" : "PENDING";

      await tx.designVersion.create({
        data: {
          tenant_id: tenant.id,
          design_job_id: job.id,
          version_no: versionNo,
          file_path: input.filePath.trim(),
          preview_path: input.previewPath || null,
          uploaded_by: actor.id,
          approval_status: approvalStatus,
          approval_method: job.approval_method,
          approval_notes: input.notes || null,
          approved_at: makloon ? new Date() : null,
          approved_by: makloon ? actor.id : null,
        },
      });

      await tx.designJob.update({
        where: { id: job.id },
        data: { current_version: versionNo, status: makloon ? "APPROVED" : "DESIGNING" },
      });

      if (makloon) {
        await tx.order.updateMany({
          where: { id: orderId, tenant_id: tenant.id, status: { in: ["DRAFT", "DESIGNING", "WAITING_APPROVAL"] } },
          data: { status: "WAITING_PAYMENT" },
        });
      } else {
        await tx.order.updateMany({
          where: { id: orderId, tenant_id: tenant.id, status: { in: ["DRAFT"] } },
          data: { status: "DESIGNING" },
        });
      }

      return { versionNo, approvalStatus };
    });

    await logAction(actor.id, "DESIGN_VERSION_UPLOADED", "Order", orderId, null, result);
    revalidatePath("/designer");
    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("uploadDesignVersion:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengupload versi desain.");
  }
}

/**
 * Setujui versi desain terkini.
 * - ONLINE: hanya Admin/Owner (Designer tidak boleh approve desainnya sendiri).
 * - WALK_IN / MAKLOON: Designer pembuat atau Admin.
 */
export async function approveDesign(
  orderId: string,
  input: { notes?: string; approvalMethodOverride?: "WALK_IN" | "MAKLOON" | "ONLINE" }
): Promise<ActionResult<{ versionNo: number }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job) throw new Error("Design job tidak ditemukan.");

      const version = await tx.designVersion.findFirst({
        where: { design_job_id: job.id, version_no: job.current_version },
      });
      if (!version) throw new Error("Versi desain aktif tidak ditemukan.");
      if (version.approval_status === "APPROVED") throw new Error("Versi ini sudah disetujui.");

      const method = input.approvalMethodOverride || job.approval_method;
      if (method === "ONLINE" && !isAdmin(actor.role)) {
        throw new Error("Persetujuan desain ONLINE harus dilakukan oleh Admin.");
      }
      if (method !== "ONLINE" && actor.role === "designer_sales" && version.uploaded_by !== actor.id && !isAdmin(actor.role)) {
        throw new Error("Hanya designer pembuat atau Admin yang bisa menyetujui.");
      }

      await tx.designVersion.update({
        where: { id: version.id },
        data: {
          approval_status: "APPROVED",
          approved_at: new Date(),
          approved_by: actor.id,
          approval_method: method,
          approval_notes: input.notes || version.approval_notes,
        },
      });
      await tx.designJob.update({ where: { id: job.id }, data: { status: "APPROVED" } });
      await tx.order.updateMany({
        where: {
          id: orderId,
          tenant_id: tenant.id,
          status: { in: ["DRAFT", "DESIGNING", "WAITING_APPROVAL"] },
        },
        data: { status: "WAITING_PAYMENT" },
      });

      return { versionNo: version.version_no };
    });

    await logAction(actor.id, "DESIGN_APPROVED", "Order", orderId, null, {
      version_no: result.versionNo,
      notes: input.notes,
    });
    revalidatePath("/designer");
    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("approveDesign:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyetujui desain.");
  }
}

/** Minta revisi: versi terkini ditandai REJECTED, job kembali DESIGNING. */
export async function requestDesignRevision(
  orderId: string,
  input: { reason: string }
): Promise<ActionResult<{ versionNo: number }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!input.reason?.trim()) return fail("Alasan revisi wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job) throw new Error("Design job tidak ditemukan.");
      const version = await tx.designVersion.findFirst({
        where: { design_job_id: job.id, version_no: job.current_version },
      });
      if (!version) throw new Error("Versi desain aktif tidak ditemukan.");

      await tx.designVersion.update({
        where: { id: version.id },
        data: { approval_status: "REJECTED", rejection_reason: input.reason.trim() },
      });
      await tx.designJob.update({ where: { id: job.id }, data: { status: "DESIGNING" } });

      return { versionNo: version.version_no };
    });

    await logAction(actor.id, "DESIGN_REVISION_REQUESTED", "Order", orderId, null, {
      version_no: result.versionNo,
      reason: input.reason,
    });
    revalidatePath("/designer");
    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("requestDesignRevision:", e);
    return fail(e instanceof Error ? e.message : "Gagal meminta revisi.");
  }
}

export interface ProductionAssignment {
  machineId: string;
  operatorId: string;
  plannedQty: number;
  priority?: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  notes?: string | null;
}

/**
 * Antrikan order ke produksi. Syarat: desain APPROVED + DP terpenuhi.
 * Membuat satu ProductionJob per assignment (status PRODUCTION_ASSIGNED).
 */
export async function assignProductionJob(
  orderId: string,
  input: { assignments: ProductionAssignment[] }
): Promise<ActionResult<{ jobCodes: string[] }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Admin/Owner yang bisa assign produksi.");
    const assignments = (input.assignments ?? []).filter((a) => a.plannedQty > 0);
    if (assignments.length === 0) return fail("Minimal 1 assignment produksi.");

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      if (!order) throw new Error("Order tidak ditemukan.");

      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job || job.status !== "APPROVED") throw new Error("Desain belum disetujui.");

      const dpRequired = Number(order.dp_required ?? Math.round(Number(order.total) * 0.5));
      if (Number(order.paid_amount) + 1e-6 < dpRequired) {
        throw new Error("DP belum terpenuhi — order belum bisa masuk produksi.");
      }

      const machineIds = [...new Set(assignments.map((a) => a.machineId))];
      const operatorIds = [...new Set(assignments.map((a) => a.operatorId))];
      const [machines, operators] = await Promise.all([
        tx.machine.findMany({ where: { id: { in: machineIds }, tenant_id: tenant.id } }),
        tx.user.findMany({ where: { id: { in: operatorIds }, tenant_id: tenant.id } }),
      ]);
      if (machines.length !== machineIds.length) throw new Error("Ada mesin yang tidak valid.");
      if (operators.length !== operatorIds.length) throw new Error("Ada operator yang tidak valid.");

      const jobCodes: string[] = [];
      for (const a of assignments) {
        const code = await nextJobCode(tx, tenant.id);
        await tx.productionJob.create({
          data: {
            tenant_id: tenant.id,
            order_id: orderId,
            job_code: code,
            machine_id: a.machineId,
            operator_id: a.operatorId,
            status: "PRODUCTION_ASSIGNED",
            priority: a.priority ?? 1,
            planned_qty: a.plannedQty,
            planned_start: a.plannedStart ? new Date(a.plannedStart) : null,
            planned_end: a.plannedEnd ? new Date(a.plannedEnd) : null,
            notes: a.notes || null,
          },
        });
        jobCodes.push(code);
      }

      await tx.order.update({ where: { id: orderId }, data: { status: "PRODUCTION_ASSIGNED" } });
      return { jobCodes };
    });

    await logAction(actor.id, "PRODUCTION_ASSIGNED", "Order", orderId, null, {
      job_codes: result.jobCodes,
    });
    revalidatePath("/admin");
    revalidatePath("/operator");
    return ok(result);
  } catch (e) {
    console.error("assignProductionJob:", e);
    return fail(e instanceof Error ? e.message : "Gagal assign produksi.");
  }
}
