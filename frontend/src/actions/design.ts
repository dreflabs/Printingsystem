"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { retryOnUnique } from "@/lib/retry";
import {
  r2Configured,
  presignPut,
  fileExt,
  DESIGN_ALLOWED_EXT,
  DESIGN_MAX_UPLOAD_BYTES,
} from "@/lib/r2";
import { randomUUID } from "crypto";
import { autoReleaseToProduction } from "@/lib/auto-release";
import { ok, fail, type ActionResult } from "@/types";

const isAdmin = (role: string[]) => role.includes("admin") || role.includes("owner");
const canDesign = (role: string[]) => isAdmin(role) || role.includes("designer_sales");

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
    await requireUser();
    const job = await prisma.designJob.findFirst({
      where: { order_id: orderId, tenant_id: tenant.id },
      include: { versions: { orderBy: { version_no: "asc" } } },
    });
    if (!job) return fail("Job desain tidak ditemukan untuk order ini.");
    return ok(job);
  } catch (e) {
    console.error("getDesignJob:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat design job.");
  }
}

export interface UploadDesignVersionInput {
  /** Key objek R2 (dari createDesignUploadUrl) atau link/teks bebas (mis. MAKLOON manual). */
  filePath: string;
  fileName?: string | null;
  fileSize?: number | null;
  contentType?: string | null;
  previewPath?: string | null;
  notes?: string | null;
}

/**
 * Langkah 1 upload desain: validasi & keluarkan presigned PUT URL R2.
 * Browser meng-upload file langsung ke URL itu, lalu memanggil
 * uploadDesignVersion() dengan `filePath` = objectKey yang dikembalikan di sini.
 */
export async function createDesignUploadUrl(
  orderId: string,
  input: { fileName: string; contentType?: string | null; size: number }
): Promise<ActionResult<{ uploadUrl: string; objectKey: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!canDesign(actor.roles)) {
      return fail("Hanya Designer Sales/Admin/Owner yang boleh upload desain.");
    }
    if (!r2Configured()) {
      return fail("Penyimpanan file (R2) belum dikonfigurasi. Hubungi admin sistem.");
    }

    const name = (input.fileName ?? "").trim();
    const ext = fileExt(name);
    if (!ext || !DESIGN_ALLOWED_EXT.includes(ext)) {
      return fail(`Format tidak didukung. Pakai: ${DESIGN_ALLOWED_EXT.join(", ")}.`);
    }
    if (!Number.isFinite(input.size) || input.size <= 0) return fail("Ukuran file tidak valid.");
    if (input.size > DESIGN_MAX_UPLOAD_BYTES) {
      return fail(`File terlalu besar. Maksimum ${Math.round(DESIGN_MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
    }

    const job = await prisma.designJob.findFirst({
      where: { order_id: orderId, tenant_id: tenant.id },
      select: { id: true, current_version: true },
    });
    if (!job) return fail("Job desain tidak ditemukan untuk order ini.");

    const nextVer = job.current_version + 1;
    const objectKey = `tenants/${tenant.id}/design/${job.id}/v${nextVer}-${randomUUID().slice(0, 8)}.${ext}`;
    const uploadUrl = await presignPut(objectKey);

    return ok({ uploadUrl, objectKey });
  } catch (e) {
    console.error("createDesignUploadUrl:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyiapkan upload.");
  }
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
    if (!canDesign(actor.roles)) {
      return fail("Hanya Designer Sales/Admin/Owner yang boleh upload desain.");
    }
    if (!input.filePath?.trim()) return fail("File desain wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job) throw new Error("Job desain tidak ditemukan.");

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
          file_name: input.fileName?.trim() || null,
          file_size: input.fileSize && input.fileSize > 0 ? Math.round(input.fileSize) : null,
          content_type: input.contentType?.trim() || null,
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
      if (!job) throw new Error("Job desain tidak ditemukan.");

      const version = await tx.designVersion.findFirst({
        where: { design_job_id: job.id, version_no: job.current_version },
      });
      if (!version) throw new Error("Versi desain aktif tidak ditemukan.");
      if (version.approval_status === "APPROVED") throw new Error("Versi ini sudah disetujui.");

      const method = input.approvalMethodOverride || job.approval_method;
      if (method === "ONLINE" && !isAdmin(actor.roles)) {
        throw new Error("Persetujuan desain ONLINE harus dilakukan oleh Admin.");
      }
      if (method !== "ONLINE" && actor.roles.includes("designer_sales") && version.uploaded_by !== actor.id && !isAdmin(actor.roles)) {
        throw new Error("Hanya designer pembuat atau Admin yang boleh menyetujui.");
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

      // Desain ACC → WAITING_PAYMENT. Tapi kalau DP sudah lunas (mis. dibayar saat
      // order dibuat), langsung CONFIRMED supaya order tidak nyangkut.
      const ord = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      let release: Awaited<ReturnType<typeof autoReleaseToProduction>> = { released: false, jobCodes: [], missing: [] };
      if (ord && ["DRAFT", "DESIGNING", "WAITING_APPROVAL", "CONFIRMED"].includes(ord.status)) {
        const dpReq = Number(ord.dp_required ?? Math.round(Number(ord.total) * 0.5));
        const dpMet = Number(ord.paid_amount) + 1e-6 >= dpReq;
        await tx.order.update({
          where: { id: ord.id },
          data: { status: dpMet ? "CONFIRMED" : "WAITING_PAYMENT" },
        });
        if (dpMet) release = await autoReleaseToProduction(tx, tenant.id, ord.id);
      }

      return { versionNo: version.version_no, release };
    });

    await logAction(actor.id, "DESIGN_APPROVED", "Order", orderId, null, {
      version_no: result.versionNo,
      notes: input.notes,
    });
    if (result.release.released) {
      await logAction(actor.id, "ORDER_AUTO_RELEASED", "Order", orderId, null, {
        job_codes: result.release.jobCodes,
        trigger: "DESIGN_APPROVED",
      });
      revalidatePath("/operator");
    }
    revalidatePath("/designer");
    revalidatePath("/admin");
    return ok({ versionNo: result.versionNo });
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
    if (!isAdmin(actor.roles) && !actor.roles.includes("designer_sales")) {
      return fail("Hanya Designer Sales/Admin/Owner yang boleh meminta revisi desain.");
    }
    if (!input.reason?.trim()) return fail("Alasan revisi wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job) throw new Error("Job desain tidak ditemukan.");
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

/** Mesin ACTIVE + operator aktif tenant ini — untuk form "Assign ke Produksi". */
export async function getProductionAssignData(): Promise<
  ActionResult<{ machines: { id: string; name: string; machineCode: string; category: string }[]; operators: { id: string; name: string }[] }>
> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Admin/Owner yang boleh assign produksi.");
    const [machines, operators] = await Promise.all([
      prisma.machine.findMany({
        where: { tenant_id: tenant.id, status: "ACTIVE" },
        select: { id: true, name: true, machine_code: true, category: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          tenant_id: tenant.id,
          active: true,
          OR: [
            { role: { name: "operator" } },
            { extra_roles: { some: { role: { name: "operator" } } } },
          ],
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return ok({
      machines: machines.map((m) => ({ id: m.id, name: m.name, machineCode: m.machine_code, category: m.category })),
      operators,
    });
  } catch (e) {
    console.error("getProductionAssignData:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat data assign produksi.");
  }
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
    if (!isAdmin(actor.roles)) return fail("Hanya Admin/Owner yang boleh assign produksi.");
    const assignments = (input.assignments ?? []).filter((a) => a.plannedQty > 0);
    if (assignments.length === 0) return fail("Minimal 1 assignment produksi.");

    const result = await retryOnUnique(() => prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
      if (!order) throw new Error("Order tidak ditemukan.");

      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job || job.status !== "APPROVED") throw new Error("Desain belum disetujui.");

      // Aturan 14: order dengan diskon menggantung belum boleh masuk produksi.
      if (Number(order.discount) > 0 && !order.discount_approved_by) {
        throw new Error("Diskon masih menunggu keputusan Owner — order belum bisa masuk produksi.");
      }

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

      // Aturan 17: mesin MAINTENANCE / INACTIVE tidak boleh menerima job baru.
      const down = machines.find((m) => m.status !== "ACTIVE");
      if (down) throw new Error(`Mesin ${down.name} sedang ${down.status} — tidak bisa menerima job.`);

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
    }));

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

/**
 * Ambil tugas desain yang belum ada PIC-nya (designer_id === null).
 */
export async function takeDesignJob(orderId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    if (!canDesign(actor.roles)) {
      return fail("Hanya Designer / Admin yang boleh mengambil tugas ini.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findFirst({
        where: { order_id: orderId, tenant_id: tenant.id },
      });
      if (!job) throw new Error("Job desain tidak ditemukan.");
      if (job.designer_id) {
        if (job.designer_id === actor.id) return { success: true };
        throw new Error("Job ini sudah diambil oleh designer lain.");
      }

      await tx.designJob.update({
        where: { id: job.id },
        data: { designer_id: actor.id },
      });
      return { success: true };
    });

    await logAction(actor.id, "DESIGN_JOB_TAKEN", "Order", orderId, null);
    revalidatePath("/designer");
    return ok(result);
  } catch (e) {
    console.error("takeDesignJob:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengambil tugas desain.");
  }
}
