"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { validateMachineMaterials } from "@/lib/production-materials";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { retryOnUnique } from "@/lib/retry";
import {
  fileExt,
  DESIGN_ALLOWED_EXT,
  DESIGN_MAX_UPLOAD_BYTES,
} from "@/lib/r2";
import { storageReady, presignPutUrl, isTenantKey } from "@/lib/storage";
import { randomUUID } from "crypto";
import { autoReleaseToProduction } from "@/lib/auto-release";
import { checkProductionReadiness, coveredDesignItemIds, latestDesignVersionsBySlot, type ReadinessItem } from "@/lib/production-readiness";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";

const isAdmin = (role: string[]) => role.includes("admin") || role.includes("owner");
const canDesign = (role: string[]) => isAdmin(role) || role.includes("designer_sales");
const DESIGN_MUTABLE_ORDER_STATUSES = ["DRAFT", "DESIGNING", "WAITING_APPROVAL", "WAITING_PAYMENT"];

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
    const actor = await requireUser();
    const job = await prisma.designJob.findUnique({
      where: { tenant_id_order_id: { tenant_id: tenant.id, order_id: orderId } },
      include: { versions: { orderBy: { version_no: "asc" } } },
    });
    if (!job) return fail("Job desain tidak ditemukan untuk order ini.");

    const designStaff = actor.roles.some((r) => r === "owner" || r === "admin") || can(actor, "design.upload") || can(actor, "design.approve_walkin") || can(actor, "design.approve_online");
    const canManage = designStaff && (actor.roles.some((r) => r === "owner" || r === "admin") || job.designer_id === actor.id);
    if (canManage) return ok(job);

    // Staf produksi hanya perlu metadata/file approved ketika order sudah
    // benar-benar masuk tahap operasional dan job menjadi tanggung jawabnya.
    if (job.status !== "APPROVED") return fail("Desain belum tersedia untuk tahap operasional.");
    const approved = job.versions.filter((v) => v.approval_status === "APPROVED" && (v.file_path || v.file_name));
    if (can(actor, "production.execute")) {
      const assigned = await prisma.productionJob.findFirst({ where: { tenant_id: tenant.id, order_id: orderId, operator_id: actor.id }, select: { id: true } });
      if (assigned) return ok({ ...job, versions: approved });
    }
    if (can(actor, "qc.submit") || can(actor, "finishing.execute")) {
      const operational = await prisma.productionJob.findFirst({
        where: { tenant_id: tenant.id, order_id: orderId, status: { in: ["PRODUCTION_COMPLETE", "QC_PENDING", "QC_PASSED", "FINISHING_STARTED", "FINISHING_COMPLETE", "STORAGE_PENDING", "STORED", "READY_FOR_PICKUP", "IN_TRANSIT"] } },
        select: { id: true },
      });
      if (operational) return ok({ ...job, versions: approved });
    }
    return fail("Anda tidak memiliki akses ke desain order ini.");
  } catch (e) {
    console.error("getDesignJob:", e);
    return fail(safeError(e, "Gagal memuat design job."));
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
  /**
   * Item sasaran file ini. null / kosong = berlaku seluruh order (order 1 item
   * atau file layout gabungan). Untuk order multi-item, isi per item.
   */
  orderItemId?: string | null;
}

/**
 * Set id item non-retail order yang SUDAH punya versi desain APPROVED ber-file
 * (file item itu sendiri, atau file berlingkup seluruh order). Dipakai untuk
 * menentukan DesignJob boleh APPROVED / order boleh maju.
 */
async function designCoverage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string
): Promise<{ nonRetailItemIds: string[]; coveredItemIds: string[]; fullyCovered: boolean }> {
  const items = await tx.orderItem.findMany({
    where: { order_id: orderId, tenant_id: tenantId, retail_product_id: null },
    select: { id: true },
  });
  const nonRetailItemIds = items.map((i) => i.id);
  const approved = await tx.designVersion.findMany({
    where: { design_job: { order_id: orderId }, tenant_id: tenantId },
    select: { order_item_id: true, file_path: true, file_name: true, version_no: true, uploaded_at: true, approval_status: true },
  });
  const latest = latestDesignVersionsBySlot(approved);
  const wholeOrder = latest.some((v) => v.order_item_id == null && (v.file_path || v.file_name));
  const per = new Set(
    latest.filter((v) => v.order_item_id != null && (v.file_path || v.file_name)).map((v) => v.order_item_id as string)
  );
  const coveredItemIds = wholeOrder ? [...nonRetailItemIds] : nonRetailItemIds.filter((id) => per.has(id));
  return {
    nonRetailItemIds,
    coveredItemIds,
    fullyCovered: nonRetailItemIds.length > 0 && coveredItemIds.length === nonRetailItemIds.length,
  };
}

/**
 * Langkah 1 upload desain: validasi & keluarkan presigned PUT URL R2.
 * Browser meng-upload file langsung ke URL itu, lalu memanggil
 * uploadDesignVersion() dengan `filePath` = objectKey yang dikembalikan di sini.
 */
export async function createDesignUploadUrl(
  orderId: string,
  input: { fileName: string; contentType?: string | null; size: number; orderItemId?: string | null }
): Promise<ActionResult<{ uploadUrl: string; objectKey: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!canDesign(actor.roles)) {
      return fail("Hanya Designer Sales/Admin/Owner yang boleh upload desain.");
    }
    if (!storageReady()) {
      return fail("Penyimpanan file belum dikonfigurasi (R2 / lokal). Hubungi admin sistem.");
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

    const job = await prisma.designJob.findUnique({
      where: { tenant_id_order_id: { tenant_id: tenant.id, order_id: orderId } },
      select: { id: true, designer_id: true, status: true, approval_method: true, order: { select: { status: true } } },
    });
    if (!job) return fail("Job desain tidak ditemukan untuk order ini.");
    if (!DESIGN_MUTABLE_ORDER_STATUSES.includes(job.order.status)) {
      return fail(
        job.order.status === "ON_HOLD"
          ? "Order sedang dibekukan — cairkan order terlebih dahulu sebelum mengunggah desain."
          : "Desain tidak dapat diubah setelah order masuk produksi."
      );
    }
    if (!isAdmin(actor.roles) && job.designer_id !== actor.id) {
      return fail("Claim job ini terlebih dahulu sebelum mengunggah desain.");
    }
    if (!["PENDING", "DESIGNING"].includes(job.status)) {
      return fail("Job desain tidak sedang menerima versi baru.");
    }

    // Nomor versi mengikuti slot item yang sama dengan uploadDesignVersion:
    // null = seluruh order, id = item tertentu. current_version adalah ringkasan
    // global dan tidak boleh dipakai untuk menebak versi item berikutnya.
    const itemId = input.orderItemId?.trim() || null;
    if (itemId) {
      const item = await prisma.orderItem.findFirst({
        where: { id: itemId, order_id: orderId, tenant_id: tenant.id },
        select: { id: true, retail_product_id: true },
      });
      if (!item) return fail("Item pesanan tidak ditemukan di order ini.");
      if (item.retail_product_id) return fail("Item retail tidak butuh desain.");
    }
    const latest = await prisma.designVersion.findFirst({
      where: { design_job_id: job.id, order_item_id: itemId },
      orderBy: { version_no: "desc" },
      select: { approval_status: true },
    });
    if (job.approval_method === "ONLINE" && latest?.approval_status === "PENDING") {
      return fail("Versi Online ini masih menunggu approval Admin. Tunggu keputusan atau minta revisi resmi terlebih dahulu.");
    }
    if (job.approval_method !== "MAKLOON" && latest?.approval_status === "PENDING") {
      return fail("Versi ini masih menunggu ACC. Setujui atau minta revisi resmi sebelum upload versi baru.");
    }
    if (latest?.approval_status === "APPROVED") {
      return fail("Slot ini sudah memiliki desain approved. Minta revisi resmi sebelum mengganti file.");
    }
    // Nomor versi resmi dialokasikan saat record DesignVersion dibuat. Object
    // key tidak memuat nomor versi agar upload paralel tidak pernah membuat
    // nama file storage yang menyesatkan; folder slot tetap menjaga organisasi.
    const slotKey = itemId ?? "order";
    const objectKey = `tenants/${tenant.id}/design/${job.id}/${slotKey}/${randomUUID()}.${ext}`;
    const uploadUrl = await presignPutUrl(objectKey);

    return ok({ uploadUrl, objectKey });
  } catch (e) {
    console.error("createDesignUploadUrl:", e);
    return fail(safeError(e, "Gagal menyiapkan upload."));
  }
}

/**
 * Upload versi desain baru. Untuk MAKLOON (file dari konsumen) versi langsung
 * APPROVED. Untuk WALK_IN / ONLINE versi berstatus PENDING menunggu approve.
 */
export async function uploadDesignVersion(
  orderId: string,
  input: UploadDesignVersionInput
): Promise<ActionResult<{ versionNo: number; approvalStatus: string; itemId: string | null; fullyCovered: boolean; autoReleasedJobs: string[] }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!canDesign(actor.roles)) {
      return fail("Hanya Designer Sales/Admin/Owner yang boleh upload desain.");
    }
    const filePath = input.filePath?.trim();
    if (!filePath) return fail("File desain wajib diisi.");
    // filePath boleh berupa object key R2 milik tenant ini (dari createDesignUploadUrl,
    // namespace "tenants/<tenantId>/design/…") atau link http(s) bebas (MAKLOON manual).
    // Tanpa ini, client bisa mengarahkan file_path ke object key milik tenant lain —
    // /api/design/[versionId] menyajikan isinya tanpa cek tenant pada key itu sendiri.
    if (!/^https?:\/\//i.test(filePath) && !isTenantKey(filePath, tenant.id, ["tenants"])) {
      return fail("File desain tidak valid.");
    }
    const previewPath = input.previewPath?.trim() || null;
    if (previewPath && !/^https?:\/\//i.test(previewPath) && !isTenantKey(previewPath, tenant.id, ["tenants"])) {
      return fail("File pratinjau tidak valid.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findUnique({
        where: { tenant_id_order_id: { tenant_id: tenant.id, order_id: orderId } },
      });
      if (!job) throw new Error("Job desain tidak ditemukan.");

      // Serialisasi allocator versi per DesignJob. Object key sudah UUID acak;
      // lock ini memastikan dua upload paralel tetap mendapat nomor record yang
      // berbeda ketika sama-sama membaca versi terakhir.
      await tx.$queryRaw`SELECT id FROM "DesignJob" WHERE id = ${job.id} FOR UPDATE`;

      const order = await tx.order.findFirst({
        where: { id: orderId, tenant_id: tenant.id },
        select: { status: true },
      });
      if (!order || !DESIGN_MUTABLE_ORDER_STATUSES.includes(order.status)) {
        throw new Error(
          order?.status === "ON_HOLD"
            ? "Order sedang dibekukan — cairkan order terlebih dahulu sebelum mengunggah desain."
            : "Desain tidak dapat diubah setelah order masuk produksi."
        );
      }
      if (!isAdmin(actor.roles) && job.designer_id !== actor.id) {
        throw new Error("Claim job ini terlebih dahulu sebelum mengunggah desain.");
      }
      if (!["PENDING", "DESIGNING"].includes(job.status)) {
        throw new Error("Job desain tidak sedang menerima versi baru.");
      }

      // Validasi item sasaran (kalau ada).
      const itemId = input.orderItemId?.trim() || null;
      if (itemId) {
        const it = await tx.orderItem.findFirst({
          where: { id: itemId, order_id: orderId, tenant_id: tenant.id },
          select: { id: true, retail_product_id: true },
        });
        if (!it) throw new Error("Item pesanan tidak ditemukan di order ini.");
        if (it.retail_product_id) throw new Error("Item retail tidak butuh desain.");
      }

      // Deret versi per "slot" (job + item). Slot null = seluruh order.
      const last = await tx.designVersion.findFirst({
        where: { design_job_id: job.id, order_item_id: itemId },
        orderBy: { version_no: "desc" },
      });
      const makloon = job.approval_method === "MAKLOON";
      if (job.approval_method === "ONLINE" && last?.approval_status === "PENDING") {
        throw new Error("Versi Online ini masih menunggu approval Admin. Tunggu keputusan atau minta revisi resmi terlebih dahulu.");
      }
      if (!makloon && last?.approval_status === "PENDING") {
        throw new Error("Versi ini masih menunggu ACC. Setujui atau minta revisi resmi sebelum upload versi baru.");
      }
      if (last?.approval_status === "APPROVED") {
        throw new Error("Slot ini sudah memiliki desain approved. Minta revisi resmi sebelum mengganti file.");
      }
      const versionNo = (last?.version_no ?? 0) + 1;

      const approvalStatus = makloon ? "APPROVED" : "PENDING";

      await tx.designVersion.create({
        data: {
          tenant_id: tenant.id,
          design_job_id: job.id,
          order_item_id: itemId,
          version_no: versionNo,
          file_path: filePath,
          file_name: input.fileName?.trim() || null,
          file_size: input.fileSize && input.fileSize > 0 ? Math.round(input.fileSize) : null,
          content_type: input.contentType?.trim() || null,
          preview_path: previewPath,
          uploaded_by: actor.id,
          approval_status: approvalStatus,
          approval_method: job.approval_method,
          approval_notes: input.notes || null,
          approved_at: makloon ? new Date() : null,
          approved_by: makloon ? actor.id : null,
        },
      });

      // current_version = nomor versi tertinggi lintas slot (untuk tampilan "Vn").
      const top = await tx.designVersion.findFirst({
        where: { design_job_id: job.id },
        orderBy: { version_no: "desc" },
        select: { version_no: true },
      });

      const cov = await designCoverage(tx, tenant.id, orderId);
      // Job APPROVED hanya kalau SEMUA item non-retail sudah punya file approved.
      const jobStatus = makloon && cov.fullyCovered ? "APPROVED" : "DESIGNING";
      await tx.designJob.update({
        where: { id: job.id },
        data: { current_version: top?.version_no ?? versionNo, status: jobStatus },
      });

      let autoReleasedJobs: string[] = [];
      if (makloon && cov.fullyCovered) {
        const ord = await tx.order.findFirst({
          where: { id: orderId, tenant_id: tenant.id },
          select: { status: true, total: true, dp_required: true, paid_amount: true },
        });
        if (ord && ["DRAFT", "DESIGNING", "WAITING_APPROVAL", "WAITING_PAYMENT"].includes(ord.status)) {
          const total = Number(ord.total);
          const dpRequired = Number(ord.dp_required ?? Math.round(total * 0.5));
          const dpMet = Number(ord.paid_amount) + 1e-6 >= dpRequired;
          await tx.order.update({
            where: { id: orderId },
            data: { status: dpMet ? "CONFIRMED" : "WAITING_PAYMENT" },
          });
          if (dpMet) {
            const release = await autoReleaseToProduction(tx, tenant.id, orderId);
            autoReleasedJobs = release.jobCodes;
          }
        }
      } else {
        await tx.order.updateMany({
          where: { id: orderId, tenant_id: tenant.id, status: { in: ["DRAFT"] } },
          data: { status: "DESIGNING" },
        });
      }

      return { versionNo, approvalStatus, itemId, fullyCovered: cov.fullyCovered, autoReleasedJobs };
    });

    await logAction(actor.id, "DESIGN_VERSION_UPLOADED", "Order", orderId, null, result);
    if (result.autoReleasedJobs.length > 0) {
      await logAction(actor.id, "ORDER_AUTO_RELEASED", "Order", orderId, null, {
        job_codes: result.autoReleasedJobs,
        trigger: "MAKLOON_DESIGN_UPLOADED",
      });
    }
    revalidatePath("/designer");
    revalidatePath("/admin");
    if (result.autoReleasedJobs.length > 0) revalidatePath("/operator");
    return ok(result);
  } catch (e) {
    console.error("uploadDesignVersion:", e);
    return fail(safeError(e, "Gagal mengupload versi desain."));
  }
}

/**
 * Setujui desain.
 * - Tanpa `itemId`: ACC versi PENDING terbaru DI SETIAP slot (tiap item + slot
 *   seluruh-order). Untuk order multi-item, semua item yang sudah diupload
 *   di-ACC sekaligus.
 * - Dengan `itemId`: ACC hanya slot item itu.
 * DesignJob baru jadi APPROVED (dan order maju) kalau SEMUA item non-retail
 * sudah punya file approved.
 * - ONLINE: hanya Admin/Owner. WALK_IN / MAKLOON: Designer pembuat atau Admin.
 */
export async function approveDesign(
  orderId: string,
  input: { notes?: string; itemId?: string | null }
): Promise<ActionResult<{ approvedCount: number; fullyApproved: boolean; pendingItems: string[] }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!canDesign(actor.roles)) {
      return fail("Hanya Designer Sales/Admin/Owner yang boleh menyetujui desain.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findUnique({
        where: { tenant_id_order_id: { tenant_id: tenant.id, order_id: orderId } },
      });
      if (!job) throw new Error("Job desain tidak ditemukan.");

      const method = job.approval_method;
      if (method === "ONLINE" && !isAdmin(actor.roles)) {
        throw new Error("Persetujuan desain ONLINE harus dilakukan oleh Admin.");
      }
      const approvalNotes = input.notes?.trim() ?? "";
      if (method !== "MAKLOON" && approvalNotes.length < 5) {
        throw new Error("Catatan bukti persetujuan wajib diisi (min. 5 karakter).");
      }
      if (!isAdmin(actor.roles) && job.designer_id !== actor.id) {
        throw new Error("Hanya PIC Designer yang boleh menyetujui job ini.");
      }
      const order = await tx.order.findFirst({
        where: { id: orderId, tenant_id: tenant.id },
        select: { status: true },
      });
      if (!order || !DESIGN_MUTABLE_ORDER_STATUSES.includes(order.status) && order.status !== "CONFIRMED") {
        throw new Error("Approval desain tidak dapat dilakukan setelah produksi dimulai.");
      }

      // Versi terbaru per slot (job + order_item_id).
      const all = await tx.designVersion.findMany({
        where: { design_job_id: job.id },
        orderBy: { version_no: "desc" },
      });
      const seen = new Set<string>();
      const latestPerSlot = all.filter((v) => {
        const k = v.order_item_id ?? "__order__";
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      const targets = latestPerSlot.filter((v) => {
        if (v.approval_status !== "PENDING") return false;
        if (input.itemId != null) return v.order_item_id === input.itemId;
        return true;
      });
      if (targets.length === 0) throw new Error("Tidak ada versi desain yang menunggu persetujuan.");

      for (const v of targets) {
        if (
          method !== "ONLINE" &&
          actor.roles.includes("designer_sales") &&
          v.uploaded_by !== actor.id &&
          !isAdmin(actor.roles)
        ) {
          throw new Error("Hanya designer pembuat atau Admin yang boleh menyetujui.");
        }
        // Hanya satu versi aktif per slot. Versi approved lama tetap tersimpan
        // untuk histori, tetapi tidak boleh lagi muncul sebagai file produksi.
        await tx.designVersion.updateMany({
          where: {
            tenant_id: tenant.id,
            design_job_id: job.id,
            order_item_id: v.order_item_id,
            approval_status: "APPROVED",
            id: { not: v.id },
          },
          data: { approval_status: "SUPERSEDED" },
        });
        await tx.designVersion.update({
          where: { id: v.id },
          data: {
            approval_status: "APPROVED",
            approved_at: new Date(),
            approved_by: actor.id,
            approval_method: method,
            approval_notes: approvalNotes || v.approval_notes,
          },
        });
      }

      const cov = await designCoverage(tx, tenant.id, orderId);
      const pendingItemRows = cov.fullyCovered
        ? []
        : await tx.orderItem.findMany({
            where: { id: { in: cov.nonRetailItemIds.filter((id) => !cov.coveredItemIds.includes(id)) } },
            select: { description: true, product: { select: { name: true } } },
          });
      const pendingItems = pendingItemRows.map((i) => i.description || i.product?.name || "item");

      await tx.designJob.update({
        where: { id: job.id },
        data: { status: cov.fullyCovered ? "APPROVED" : "DESIGNING" },
      });

      let release: Awaited<ReturnType<typeof autoReleaseToProduction>> = { released: false, jobCodes: [], missing: [] };
      if (cov.fullyCovered) {
        // Desain lengkap → WAITING_PAYMENT, atau CONFIRMED + auto-release kalau DP sudah lunas.
        const ord = await tx.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
        if (ord && ["DRAFT", "DESIGNING", "WAITING_APPROVAL", "CONFIRMED"].includes(ord.status)) {
          const dpReq = Number(ord.dp_required ?? Math.round(Number(ord.total) * 0.5));
          const dpMet = Number(ord.paid_amount) + 1e-6 >= dpReq;
          await tx.order.update({
            where: { id: ord.id },
            data: { status: dpMet ? "CONFIRMED" : "WAITING_PAYMENT" },
          });
          if (dpMet) release = await autoReleaseToProduction(tx, tenant.id, ord.id);
        }
      }

      return { approvedCount: targets.length, fullyApproved: cov.fullyCovered, pendingItems, release };
    });

    await logAction(actor.id, "DESIGN_APPROVED", "Order", orderId, null, {
      approved_count: result.approvedCount,
      fully_approved: result.fullyApproved,
      notes: input.notes?.trim() || null,
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
    return ok({
      approvedCount: result.approvedCount,
      fullyApproved: result.fullyApproved,
      pendingItems: result.pendingItems,
    });
  } catch (e) {
    console.error("approveDesign:", e);
    return fail(safeError(e, "Gagal menyetujui desain."));
  }
}

/**
 * Minta revisi. Tanpa `itemId`: versi terbaru SETIAP slot ditandai REJECTED
 * (revisi seluruh order). Dengan `itemId`: hanya slot item itu. Job → DESIGNING.
 */
export async function requestDesignRevision(
  orderId: string,
  input: { reason: string; itemId?: string | null }
): Promise<ActionResult<{ rejectedCount: number }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles) && !actor.roles.includes("designer_sales")) {
      return fail("Hanya Designer Sales/Admin/Owner yang boleh meminta revisi desain.");
    }
    if (!input.reason?.trim()) return fail("Alasan revisi wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.designJob.findUnique({
        where: { tenant_id_order_id: { tenant_id: tenant.id, order_id: orderId } },
      });
      if (!job) throw new Error("Job desain tidak ditemukan.");
      if (!isAdmin(actor.roles) && job.designer_id !== actor.id) {
        throw new Error("Hanya PIC Designer yang boleh meminta revisi job ini.");
      }
      const order = await tx.order.findFirst({
        where: { id: orderId, tenant_id: tenant.id },
        select: { status: true },
      });
      if (!order || !DESIGN_MUTABLE_ORDER_STATUSES.includes(order.status)) {
        throw new Error("Revisi setelah produksi harus melalui alur correction/reprint Admin.");
      }

      const all = await tx.designVersion.findMany({
        where: { design_job_id: job.id },
        orderBy: { version_no: "desc" },
      });
      const seen = new Set<string>();
      const latestPerSlot = all.filter((v) => {
        const k = v.order_item_id ?? "__order__";
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const targets = latestPerSlot.filter(
        (v) => v.approval_status !== "REJECTED" && (input.itemId == null || v.order_item_id === input.itemId)
      );
      if (targets.length === 0) throw new Error("Tidak ada versi desain untuk direvisi.");

      for (const v of targets) {
        // Putuskan coverage versi approved lama pada slot yang direvisi. Tanpa
        // ini, helper readiness masih dapat menganggap file lama aktif.
        await tx.designVersion.updateMany({
          where: {
            tenant_id: tenant.id,
            design_job_id: job.id,
            order_item_id: v.order_item_id,
            approval_status: "APPROVED",
          },
          data: { approval_status: "SUPERSEDED" },
        });
        await tx.designVersion.update({
          where: { id: v.id },
          data: { approval_status: "REJECTED", rejection_reason: input.reason.trim() },
        });
      }
      await tx.designJob.update({ where: { id: job.id }, data: { status: "DESIGNING" } });

      return { rejectedCount: targets.length };
    });

    await logAction(actor.id, "DESIGN_REVISION_REQUESTED", "Order", orderId, null, {
      rejected_count: result.rejectedCount,
      item_id: input.itemId ?? null,
      reason: input.reason,
    });
    revalidatePath("/designer");
    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("requestDesignRevision:", e);
    return fail(safeError(e, "Gagal meminta revisi."));
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
  ActionResult<{
    machines: { id: string; name: string; machineCode: string; category: string }[];
    operators: { id: string; name: string; machineIds: string[] }[];
  }>
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
        select: {
          id: true,
          name: true,
          user_machines: { where: { tenant_id: tenant.id }, select: { machine_id: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);
    return ok({
      machines: machines.map((m) => ({ id: m.id, name: m.name, machineCode: m.machine_code, category: m.category })),
      operators: operators.map((operator) => ({
        id: operator.id,
        name: operator.name,
        machineIds: operator.user_machines.map((grant) => grant.machine_id),
      })),
    });
  } catch (e) {
    console.error("getProductionAssignData:", e);
    return fail(safeError(e, "Gagal memuat data assign produksi."));
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
      const order = await tx.order.findFirst({
        where: { id: orderId, tenant_id: tenant.id },
        include: {
          customer: { select: { name: true, phone: true, email: true } },
          items: {
            where: { retail_product_id: null },
            include: {
              product: {
                select: {
                  unit: true,
                  default_machine_id: true,
                  material_options: {
                    where: { tenant_id: tenant.id, active: true, role: "PRIMARY", material: { active: true, purpose: "PRIMARY", type: { not: "INK" } } },
                    select: { material_id: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!order) throw new Error("Order tidak ditemukan.");
      if (order.status !== "CONFIRMED") throw new Error("Order belum berstatus CONFIRMED.");

      const job = await tx.designJob.findUnique({
        where: { tenant_id_order_id: { tenant_id: tenant.id, order_id: orderId } },
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

      const approvedVersions = await tx.designVersion.findMany({
        where: { tenant_id: tenant.id, design_job: { order_id: orderId } },
        select: { order_item_id: true, approval_status: true, file_path: true, file_name: true, version_no: true, uploaded_at: true },
      });
      const materialIds = [...new Set(order.items.map((it) => it.material_id).filter((v): v is string => !!v))];
      const materials = materialIds.length
        ? await tx.material.findMany({ where: { id: { in: materialIds }, tenant_id: tenant.id }, select: { id: true, current_stock: true } })
        : [];
      const stockById = new Map(materials.map((m) => [m.id, Number(m.current_stock)]));
      const readinessItems: ReadinessItem[] = order.items.map((it) => ({
        id: it.id,
        label: it.description || "Item cetak",
        productId: it.product_id,
        productUnit: it.product?.unit ?? null,
        defaultMachineId: it.product?.default_machine_id ?? null,
        quantity: it.quantity,
        size: it.size,
        materialId: it.material_id,
        allowedMaterialIds: it.product?.material_options.map((option) => option.material_id) ?? [],
        materialCurrentStock: it.material_id ? stockById.get(it.material_id) ?? null : null,
        unitPrice: Number(it.unit_price),
        totalPrice: Number(it.total_price),
        deadline: it.deadline,
      }));
      const readiness = checkProductionReadiness({
        status: order.status,
        orderType: order.order_type,
        customerId: order.customer_id,
        customerName: order.customer?.name ?? null,
        customerContact: order.customer?.phone || order.customer?.email || null,
        deadline: order.deadline,
        discount: Number(order.discount),
        discountApprovedBy: order.discount_approved_by,
        paidAmount: Number(order.paid_amount),
        dpRequired,
        designApproved: job.status === "APPROVED",
        designReadyItemIds: coveredDesignItemIds(approvedVersions, readinessItems.map((it) => it.id)),
        items: readinessItems,
      });
      if (!readiness.ok) {
        throw new Error(`Order belum lolos completeness gate: ${readiness.missing.join("; ")}`);
      }

      const machineIds = [...new Set(assignments.map((a) => a.machineId))];
      const operatorIds = [...new Set(assignments.map((a) => a.operatorId))];
      const [machines, operators] = await Promise.all([
        tx.machine.findMany({ where: { id: { in: machineIds }, tenant_id: tenant.id } }),
        tx.user.findMany({
          where: {
            id: { in: operatorIds },
            tenant_id: tenant.id,
            active: true,
            OR: [
              { role: { name: "operator" } },
              { extra_roles: { some: { role: { name: "operator" } } } },
            ],
          },
        }),
      ]);
      if (machines.length !== machineIds.length) throw new Error("Ada mesin yang tidak valid.");
      if (operators.length !== operatorIds.length) throw new Error("Ada operator yang tidak valid.");

      // Penugasan manual wajib mengikuti grant mesin yang sama dengan jalur
      // auto-release dan reassign. Role Operator saja tidak cukup karena satu
      // Operator dapat dibatasi ke mesin tertentu oleh Owner.
      const grants = await tx.userMachine.findMany({
        where: {
          tenant_id: tenant.id,
          OR: assignments.map((assignment) => ({
            user_id: assignment.operatorId,
            machine_id: assignment.machineId,
          })),
        },
        select: { user_id: true, machine_id: true },
      });
      const grantKeys = new Set(grants.map((grant) => `${grant.user_id}:${grant.machine_id}`));
      const missingGrant = assignments.find(
        (assignment) => !grantKeys.has(`${assignment.operatorId}:${assignment.machineId}`),
      );
      if (missingGrant) {
        throw new Error("Operator belum memiliki akses ke mesin yang dipilih. Minta Owner mengatur Akses Mesin terlebih dahulu.");
      }

      // Aturan 17: mesin MAINTENANCE / INACTIVE tidak boleh menerima job baru.
      const down = machines.find((m) => m.status !== "ACTIVE");
      if (down) throw new Error(`Mesin ${down.name} sedang ${down.status} — tidak bisa menerima job.`);

      const assignedIds = new Set<string>();
      const scopedAssignments = assignments.map(a => {
        const selected = assignments.length === 1 ? order.items : order.items.filter(it => it.product?.default_machine_id === a.machineId);
        if (!selected.length || selected.some(it => assignedIds.has(it.id))) throw new Error("Penugasan mesin ambigu. Gunakan satu job per mesin dan pastikan mesin default setiap item sudah diatur.");
        selected.forEach(it => assignedIds.add(it.id));
        return { a, selected };
      });
      if (assignedIds.size !== order.items.length) throw new Error("Sebagian item belum mendapat mesin. Lengkapi mesin default produk atau gunakan satu penugasan untuk seluruh order.");
      const jobCodes: string[] = [];
      for (const { a, selected } of scopedAssignments) {
        await validateMachineMaterials(tx, tenant.id, a.machineId, selected.map(it => it.material_id));
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
            planned_qty: selected.reduce((n, it) => n + it.quantity, 0),
            items: { create: selected.map(it => ({ tenant_id: tenant.id, order_item_id: it.id, material_id: it.material_id })) },
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
    return fail(safeError(e, "Gagal assign produksi."));
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
      const job = await tx.designJob.findUnique({
        where: { tenant_id_order_id: { tenant_id: tenant.id, order_id: orderId } },
        include: { order: { select: { status: true } } },
      });
      if (!job) throw new Error("Job desain tidak ditemukan.");
      // Order dibekukan/dibatalkan/sudah masuk produksi — jangan biarkan job
      // diklaim, supaya tidak menjebak designer dengan tugas yang tidak bisa
      // diunggah (uploadDesignVersion menolaknya dengan guard yang sama).
      if (!DESIGN_MUTABLE_ORDER_STATUSES.includes(job.order.status)) {
        throw new Error("Order sedang tidak menerima pekerjaan desain (dibekukan/sudah masuk produksi).");
      }
      if (job.designer_id) {
        if (job.designer_id === actor.id) return { success: true };
        throw new Error("Job ini sudah diambil oleh designer lain.");
      }

      if (!["PENDING", "DESIGNING"].includes(job.status)) {
        throw new Error("Job ini sudah tidak tersedia untuk diambil.");
      }
      const claimed = await tx.designJob.updateMany({
        where: { id: job.id, tenant_id: tenant.id, designer_id: null, status: { in: ["PENDING", "DESIGNING"] } },
        data: { designer_id: actor.id },
      });
      if (claimed.count !== 1) throw new Error("Job ini sudah diambil oleh designer lain.");
      return { success: true };
    });

    await logAction(actor.id, "DESIGN_JOB_TAKEN", "Order", orderId, null);
    revalidatePath("/designer");
    return ok(result);
  } catch (e) {
    console.error("takeDesignJob:", e);
    return fail(safeError(e, "Gagal mengambil tugas desain."));
  }
}
