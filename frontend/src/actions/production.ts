"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

const isGudang = (r: string) => r === "gudang";

/** Cari ProductionJob (aktif) berdasarkan job_code atau order_code. */
async function findJobByCode(tx: Prisma.TransactionClient, tenantId: string, code: string) {
  const c = code.trim();
  let job = await tx.productionJob.findFirst({
    where: { tenant_id: tenantId, job_code: c },
    include: { order: true },
  });
  if (!job) {
    const order = await tx.order.findFirst({ where: { tenant_id: tenantId, order_code: c } });
    if (order) {
      job = await tx.productionJob.findFirst({
        where: { tenant_id: tenantId, order_id: order.id },
        include: { order: true },
        orderBy: { created_at: "desc" },
      });
    }
  }
  return job;
}

/** Naikkan status order kalau SEMUA production job order tsb sudah mencapai `reached`. */
async function advanceOrderWhenAllJobs(
  tx: Prisma.TransactionClient,
  orderId: string,
  reached: string[],
  newOrderStatus: string,
  fromOrderStatuses: string[]
) {
  const jobs = await tx.productionJob.findMany({
    where: { order_id: orderId, parent_job_id: null },
  });
  const allReached = jobs.length > 0 && jobs.every((j) => reached.includes(j.status));
  if (allReached) {
    await tx.order.updateMany({
      where: { id: orderId, status: { in: fromOrderStatuses } },
      data: { status: newOrderStatus },
    });
  }
  return allReached;
}

async function nextJobCode(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const startOfDay = new Date(y, now.getMonth(), now.getDate());
  const n = await tx.productionJob.count({ where: { tenant_id: tenantId, created_at: { gte: startOfDay } } });
  return `JOB-${y}${m}${d}-${String(n + 1).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// SCAN ROUTER
// ─────────────────────────────────────────────────────────────

export interface ScanAction {
  action: string;
  label: string;
}

/**
 * Router scan: dari kode job/order + role user, tentukan konteks & aksi yang tersedia.
 * QR = identitas, bukan otorisasi — aksi tetap divalidasi ulang saat dipanggil.
 */
export async function getScanContext(code: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const job = await findJobByCode(prisma, tenant.id, code);
    if (!job) return fail("Job/Order tidak ditemukan.");

    const order = job.order;
    const actions: ScanAction[] = [];
    const s = job.status;

    if (actor.role === "operator" && job.operator_id === actor.id) {
      if (s === "PRODUCTION_ASSIGNED") actions.push({ action: "start_production", label: "Mulai Produksi (SCAN 1)" });
      if (s === "PRODUCTION_STARTED") {
        actions.push({ action: "finish_production", label: "Selesai Produksi (SCAN 2)" });
        actions.push({ action: "pause_production", label: "Jeda Produksi" });
      }
      if (s === "PRODUCTION_PAUSED") actions.push({ action: "resume_production", label: "Lanjutkan Produksi" });
    }
    if (isGudang(actor.role)) {
      if (s === "PRODUCTION_COMPLETE") actions.push({ action: "submit_qc", label: "Isi Form QC (SCAN 3)" });
      if (s === "QC_PASSED") actions.push({ action: "start_finishing", label: "Mulai Finishing (SCAN 4)" });
      if (s === "FINISHING_STARTED") actions.push({ action: "finish_finishing", label: "Selesai Finishing (SCAN 5)" });
      if (s === "FINISHING_COMPLETE") actions.push({ action: "assign_storage", label: "Simpan ke Gudang (SCAN 6+7)" });
      if (s === "STORED" && order.status === "READY_FOR_PICKUP") {
        actions.push({ action: "confirm_counter", label: "Barang di Counter (SCAN 9)" });
      }
      if (s !== "PICKED_UP") actions.push({ action: "report_incident", label: "Lapor Barang Tidak Ditemukan" });
    }
    if (actor.role === "owner" && s === "FAILED_REWORK") {
      actions.push({ action: "decide_rework", label: "Putuskan Rework" });
    }
    if ((actor.role === "admin" || actor.role === "owner") && ["IN_TRANSIT", "READY_FOR_PICKUP"].includes(order.status)) {
      actions.push({ action: "release", label: "Serahkan ke Konsumen (SCAN 10)" });
    }
    actions.push({ action: "view", label: "Lihat Detail" });

    return ok({
      jobCode: job.job_code,
      orderCode: order.order_code,
      orderId: order.id,
      jobStatus: job.status,
      orderStatus: order.status,
      plannedQty: job.planned_qty,
      actualQty: job.actual_qty,
      isAssignedOperator: job.operator_id === actor.id,
      paidAmount: Number(order.paid_amount),
      balance: Number(order.balance),
      availableActions: actions,
    });
  } catch (e) {
    console.error("getScanContext:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat konteks scan.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 1 — MULAI PRODUKSI
// ─────────────────────────────────────────────────────────────

export async function startProduction(jobCode: string): Promise<ActionResult<{ jobStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.operator_id !== actor.id) throw new Error("Anda bukan operator yang di-assign ke job ini.");
      if (job.status !== "PRODUCTION_ASSIGNED") throw new Error(`Job tidak bisa dimulai dari status ${job.status}.`);

      // 1 job aktif per operator
      const active = await tx.productionJob.findFirst({
        where: { tenant_id: tenant.id, operator_id: actor.id, status: "PRODUCTION_STARTED" },
      });
      if (active) throw new Error(`Selesaikan dulu job aktif Anda (${active.job_code}).`);

      await tx.productionJob.update({
        where: { id: job.id },
        data: { status: "PRODUCTION_STARTED", actual_start: new Date() },
      });
      await tx.order.updateMany({
        where: { id: job.order_id, status: { in: ["PRODUCTION_ASSIGNED", "CONFIRMED"] } },
        data: { status: "PRODUCTION_STARTED" },
      });
      return { jobCode: job.job_code, orderId: job.order_id, jobStatus: "PRODUCTION_STARTED" };
    });

    await logAction(actor.id, "PRODUCTION_STARTED", "ProductionJob", result.jobCode, null, null);
    revalidatePath("/operator");
    revalidatePath("/scan");
    return ok({ jobStatus: result.jobStatus });
  } catch (e) {
    console.error("startProduction:", e);
    return fail(e instanceof Error ? e.message : "Gagal memulai produksi.");
  }
}

export async function pauseProduction(jobCode: string, reason: string): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!reason?.trim()) return fail("Alasan jeda wajib diisi.");
    const job = await findJobByCode(prisma, tenant.id, jobCode);
    if (!job) return fail("Job tidak ditemukan.");
    if (job.operator_id !== actor.id) return fail("Anda bukan operator job ini.");
    if (job.status !== "PRODUCTION_STARTED") return fail("Hanya job berjalan yang bisa dijeda.");
    await prisma.productionJob.update({
      where: { id: job.id },
      data: { status: "PRODUCTION_PAUSED", notes: `${job.notes ? job.notes + " | " : ""}JEDA: ${reason.trim()}` },
    });
    await logAction(actor.id, "PRODUCTION_PAUSED", "ProductionJob", job.job_code, null, { reason });
    revalidatePath("/operator");
    return ok(null);
  } catch (e) {
    console.error("pauseProduction:", e);
    return fail(e instanceof Error ? e.message : "Gagal menjeda produksi.");
  }
}

export async function resumeProduction(jobCode: string): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    const job = await findJobByCode(prisma, tenant.id, jobCode);
    if (!job) return fail("Job tidak ditemukan.");
    if (job.operator_id !== actor.id) return fail("Anda bukan operator job ini.");
    if (job.status !== "PRODUCTION_PAUSED") return fail("Job tidak sedang dijeda.");
    await prisma.productionJob.update({ where: { id: job.id }, data: { status: "PRODUCTION_STARTED" } });
    await logAction(actor.id, "PRODUCTION_RESUMED", "ProductionJob", job.job_code, null, null);
    revalidatePath("/operator");
    return ok(null);
  } catch (e) {
    console.error("resumeProduction:", e);
    return fail(e instanceof Error ? e.message : "Gagal melanjutkan produksi.");
  }
}

// ─────────────────────────────────────────────────────────────
// REASSIGNMENT JOB PRODUKSI
// ─────────────────────────────────────────────────────────────

export interface ReassignJobInput {
  machineId: string;
  operatorId: string;
  reason: string;
}

/**
 * Pindahkan job produksi ke mesin/operator lain.
 * Admin: maks 2x per 24 jam per job — percobaan ke-3 diblokir, wajib Owner.
 * Owner: selalu boleh (dicatat sebagai override limit).
 */
export async function reassignProductionJob(
  jobCode: string,
  input: ReassignJobInput
): Promise<ActionResult<{ machineId: string; operatorId: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "admin" && actor.role !== "owner") return fail("Hanya Admin/Owner yang boleh reassign job.");
    if (!input.reason?.trim()) return fail("Alasan reassignment wajib diisi.");

    const job = await findJobByCode(prisma, tenant.id, jobCode);
    if (!job) return fail("Job tidak ditemukan.");
    if (!["PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_PAUSED"].includes(job.status)) {
      return fail(`Job tidak bisa direassign dari status ${job.status}.`);
    }

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const recentReassigns = await prisma.auditLog.count({
      where: { tenant_id: tenant.id, action: "PRODUCTION_JOB_REASSIGNED", entity_id: job.job_code, created_at: { gte: dayAgo } },
    });
    const limitReached = recentReassigns >= 2;
    if (limitReached && actor.role !== "owner") {
      return fail("Batas 2x reassignment / 24 jam tercapai. Butuh keputusan Owner.");
    }

    const [machine, operator] = await Promise.all([
      prisma.machine.findFirst({ where: { id: input.machineId, tenant_id: tenant.id } }),
      prisma.user.findFirst({ where: { id: input.operatorId, tenant_id: tenant.id } }),
    ]);
    if (!machine) return fail("Mesin tidak valid.");
    if (!operator) return fail("Operator tidak valid.");
    // Aturan 17: jangan pindahkan job ke mesin yang sedang MAINTENANCE / INACTIVE.
    if (machine.status !== "ACTIVE" && machine.id !== job.machine_id) {
      return fail(`Mesin ${machine.name} sedang ${machine.status} — tidak bisa menerima job.`);
    }

    const before = { machine_id: job.machine_id, operator_id: job.operator_id };
    await prisma.productionJob.update({
      where: { id: job.id },
      data: { machine_id: input.machineId, operator_id: input.operatorId },
    });
    await logAction(actor.id, "PRODUCTION_JOB_REASSIGNED", "ProductionJob", job.job_code, before, {
      machine_id: input.machineId,
      operator_id: input.operatorId,
      reason: input.reason.trim(),
    });
    if (limitReached) {
      await logAction(actor.id, "PRODUCTION_JOB_REASSIGN_LIMIT_REACHED", "ProductionJob", job.job_code, null, {
        attempt: recentReassigns + 1,
        by_owner_override: true,
      });
    }

    revalidatePath("/owner");
    revalidatePath("/admin");
    return ok({ machineId: input.machineId, operatorId: input.operatorId });
  } catch (e) {
    console.error("reassignProductionJob:", e);
    return fail(e instanceof Error ? e.message : "Gagal reassign job.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 2 — SELESAI PRODUKSI (+ pemakaian material wajib)
// ─────────────────────────────────────────────────────────────

export interface MaterialUsageInput {
  materialId: string;
  usageQty: number;
  wasteQty?: number;
  wasteReason?: string;
}

export interface FinishProductionInput {
  actualQty: number;
  wasteQty?: number;
  wasteReason?: string;
  notes?: string;
  materials: MaterialUsageInput[];
}

export async function finishProduction(
  jobCode: string,
  input: FinishProductionInput
): Promise<ActionResult<{ jobStatus: string; lowStock: string[] }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!(input.actualQty > 0)) return fail("Jumlah aktual tidak boleh 0.");
    if ((input.wasteQty ?? 0) > 0 && !input.wasteReason?.trim()) {
      return fail("Waste > 0 wajib disertai alasan.");
    }
    if (!input.materials || input.materials.length === 0) {
      return fail("Pemakaian material wajib dicatat (minimal 1).");
    }
    for (const m of input.materials) {
      if (!(m.usageQty > 0)) return fail("Jumlah pemakaian material harus > 0.");
      if ((m.wasteQty ?? 0) > 0 && !m.wasteReason?.trim()) {
        return fail("Waste material wajib disertai alasan.");
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.operator_id !== actor.id) throw new Error("Anda bukan operator job ini.");
      if (job.status !== "PRODUCTION_STARTED" && job.status !== "PRODUCTION_PAUSED") {
        throw new Error(`Job tidak bisa diselesaikan dari status ${job.status}.`);
      }

      const lowStock: string[] = [];
      for (const m of input.materials) {
        const material = await tx.material.findFirst({ where: { id: m.materialId, tenant_id: tenant.id } });
        if (!material) throw new Error("Material tidak ditemukan.");

        const usageTotal = m.usageQty + (m.wasteQty ?? 0);
        // Pengurangan atomik — cegah lost update saat 2 operator pakai bahan shared
        // bersamaan. Stok boleh minus (dicatat sbg anomali, produksi tidak diblokir).
        await tx.material.update({
          where: { id: material.id },
          data: { current_stock: { decrement: usageTotal } },
        });
        const fresh = await tx.material.findUnique({
          where: { id: material.id },
          select: { current_stock: true },
        });
        const after = Number(fresh!.current_stock);
        const before = after + usageTotal;

        await tx.materialMovement.create({
          data: {
            tenant_id: tenant.id,
            material_id: material.id,
            machine_id: job.machine_id,
            job_id: job.id,
            movement_type: "OUT",
            quantity_usage: m.usageQty,
            quantity_stock_change: -m.usageQty,
            before_stock: before,
            after_stock: before - m.usageQty,
            performed_by: actor.id,
            reason: `Pemakaian produksi ${job.job_code}`,
          },
        });
        if ((m.wasteQty ?? 0) > 0) {
          await tx.materialMovement.create({
            data: {
              tenant_id: tenant.id,
              material_id: material.id,
              machine_id: job.machine_id,
              job_id: job.id,
              movement_type: "WASTE",
              quantity_usage: m.wasteQty!,
              quantity_stock_change: -(m.wasteQty!),
              before_stock: before - m.usageQty,
              after_stock: after,
              performed_by: actor.id,
              reason: m.wasteReason!.trim(),
            },
          });
        }
        if (after <= Number(material.min_stock)) lowStock.push(material.name);
      }

      await tx.productionJob.update({
        where: { id: job.id },
        data: {
          status: "PRODUCTION_COMPLETE",
          actual_end: new Date(),
          actual_qty: input.actualQty,
          waste_qty: input.wasteQty ?? 0,
          waste_reason: input.wasteReason?.trim() || null,
          notes: input.notes || job.notes,
        },
      });

      // order → PRODUCTION_COMPLETE → QC_PENDING kalau semua job selesai
      const allDone = await advanceOrderWhenAllJobs(
        tx,
        job.order_id,
        ["PRODUCTION_COMPLETE"],
        "QC_PENDING",
        ["PRODUCTION_STARTED", "PRODUCTION_COMPLETE"]
      );

      return { jobCode: job.job_code, orderId: job.order_id, jobStatus: "PRODUCTION_COMPLETE", lowStock, allDone };
    });

    await logAction(actor.id, "PRODUCTION_COMPLETE", "ProductionJob", result.jobCode, null, {
      actual_qty: input.actualQty,
      waste_qty: input.wasteQty ?? 0,
    });
    for (const name of result.lowStock) {
      await logAction(actor.id, "MATERIAL_LOW_STOCK", "Material", name, null, { material: name });
    }
    revalidatePath("/operator");
    revalidatePath("/scan");
    return ok({ jobStatus: result.jobStatus, lowStock: result.lowStock });
  } catch (e) {
    console.error("finishProduction:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyelesaikan produksi.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 3 — QC
// ─────────────────────────────────────────────────────────────

export interface SubmitQCInput {
  result: "PASS" | "FAIL";
  checklist: Record<string, "OK" | "MINOR" | "MAJOR">;
  notes?: string;
  photoPath?: string;
  category?: string;
  reworkRecommendation?: "rework" | "reprint" | "escalate";
}

export async function submitQC(
  jobCode: string,
  input: SubmitQCInput
): Promise<ActionResult<{ result: string; jobStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.role)) return fail("Hanya role Gudang yang boleh melakukan QC.");
    if (input.result === "FAIL") {
      if (!input.notes || input.notes.trim().length < 20) {
        return fail("QC FAIL wajib deskripsi masalah minimal 20 karakter.");
      }
      if (!input.category) return fail("QC FAIL wajib kategori masalah.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.status !== "PRODUCTION_COMPLETE") {
        throw new Error(`QC hanya untuk job PRODUCTION_COMPLETE (status sekarang: ${job.status}).`);
      }

      await tx.qcRecord.create({
        data: {
          tenant_id: tenant.id,
          job_id: job.id,
          inspector_id: actor.id,
          result: input.result,
          checklist_json: JSON.stringify(input.checklist ?? {}),
          notes: input.notes || null,
          photo_path: input.photoPath || null,
          rework_recommendation: input.reworkRecommendation || null,
        },
      });

      if (input.result === "PASS") {
        await tx.productionJob.update({ where: { id: job.id }, data: { status: "QC_PASSED" } });
        await advanceOrderWhenAllJobs(tx, job.order_id, ["QC_PASSED"], "QC_PASSED", ["QC_PENDING", "PRODUCTION_COMPLETE"]);
        return { jobCode: job.job_code, orderId: job.order_id, result: "PASS", jobStatus: "QC_PASSED" };
      }

      // FAIL → job FAILED_REWORK, order QC_FAILED → QC_REWORK_PENDING
      await tx.productionJob.update({ where: { id: job.id }, data: { status: "FAILED_REWORK", rework_reason: input.notes } });
      await tx.order.updateMany({
        where: { id: job.order_id, status: { in: ["QC_PENDING", "PRODUCTION_COMPLETE"] } },
        data: { status: "QC_REWORK_PENDING" },
      });
      return { jobCode: job.job_code, orderId: job.order_id, result: "FAIL", jobStatus: "FAILED_REWORK" };
    });

    await logAction(actor.id, result.result === "PASS" ? "QC_PASSED" : "QC_FAILED", "ProductionJob", result.jobCode, null, {
      notes: input.notes,
      category: input.category,
    });
    revalidatePath("/finishing");
    revalidatePath("/scan");
    revalidatePath("/owner");
    return ok({ result: result.result, jobStatus: result.jobStatus });
  } catch (e) {
    console.error("submitQC:", e);
    return fail(e instanceof Error ? e.message : "Gagal submit QC.");
  }
}

export async function getQCHistory() {
  try {
    const tenant = await requireTenant();
    const records = await prisma.qcRecord.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { created_at: "desc" },
      take: 50,
      include: {
        job: { include: { order: { include: { customer: true } } } },
        inspector: { select: { name: true } },
      },
    });
    return ok(records);
  } catch (e) {
    console.error("getQCHistory:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat riwayat QC.");
  }
}


/** Keputusan rework atas job yang FAILED_REWORK — Owner saja. */
export async function decideRework(
  jobCode: string,
  input: { decision: "APPROVED" | "REJECTED" | "HOLD"; reason: string }
): Promise<ActionResult<{ decision: string; childJobCode?: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh memutuskan rework.");
    if (!input.reason?.trim()) return fail("Alasan keputusan wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.status !== "FAILED_REWORK") throw new Error("Job tidak dalam status rework.");

      const qc = await tx.qcRecord.findFirst({
        where: { job_id: job.id, result: "FAIL" },
        orderBy: { created_at: "desc" },
      });
      if (qc) {
        await tx.qcRecord.update({
          where: { id: qc.id },
          data: {
            rework_decision: input.decision,
            rework_decided_by: actor.id,
            rework_decided_at: new Date(),
            rework_reason: input.reason.trim(),
          },
        });
      }

      if (input.decision === "HOLD") {
        await tx.order.update({ where: { id: job.order_id }, data: { status: "ON_HOLD" } });
        return { decision: "HOLD" as const };
      }

      if ((job.rework_count ?? 0) >= 2 && input.decision === "APPROVED") {
        throw new Error("Batas kedalaman rework (2 level) tercapai — wajib keputusan lain.");
      }

      // APPROVED → child job ; REJECTED → reprint job tanpa parent
      const childCode =
        input.decision === "APPROVED"
          ? `${job.job_code}-R${(job.rework_count ?? 0) + 1}`
          : await nextJobCode(tx, tenant.id);

      await tx.productionJob.create({
        data: {
          tenant_id: tenant.id,
          order_id: job.order_id,
          job_code: childCode,
          machine_id: job.machine_id,
          operator_id: job.operator_id,
          status: "PRODUCTION_ASSIGNED",
          priority: job.priority,
          planned_qty: job.planned_qty,
          parent_job_id: input.decision === "APPROVED" ? job.id : null,
          rework_count: input.decision === "APPROVED" ? (job.rework_count ?? 0) + 1 : 0,
          rework_reason: input.reason.trim(),
        },
      });
      await tx.order.updateMany({
        where: { id: job.order_id, status: { in: ["QC_REWORK_PENDING", "ON_HOLD"] } },
        data: { status: "PRODUCTION_ASSIGNED" },
      });

      return { decision: input.decision, childJobCode: childCode };
    });

    await logAction(
      actor.id,
      result.decision === "APPROVED" ? "QC_REWORK_APPROVED" : result.decision === "REJECTED" ? "QC_REWORK_REJECTED" : "QC_HOLD",
      "ProductionJob",
      jobCode,
      null,
      { reason: input.reason, child_job: result.childJobCode }
    );
    revalidatePath("/owner");
    revalidatePath("/operator");
    return ok(result);
  } catch (e) {
    console.error("decideRework:", e);
    return fail(e instanceof Error ? e.message : "Gagal memproses keputusan rework.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 4 & 5 — FINISHING
// ─────────────────────────────────────────────────────────────

export async function startFinishing(jobCode: string): Promise<ActionResult<{ jobStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.role)) return fail("Hanya role Gudang yang boleh mulai finishing.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.status !== "QC_PASSED") throw new Error(`Finishing hanya untuk job QC_PASSED (sekarang: ${job.status}).`);

      await tx.finishingJob.create({
        data: {
          tenant_id: tenant.id,
          job_id: job.id,
          operator_id: actor.id,
          status: "STARTED",
          started_at: new Date(),
          job_qr_scanned_at: new Date(),
        },
      });
      await tx.productionJob.update({ where: { id: job.id }, data: { status: "FINISHING_STARTED" } });
      await advanceOrderWhenAllJobs(tx, job.order_id, ["FINISHING_STARTED"], "FINISHING_STARTED", ["QC_PASSED"]);
      return { jobCode: job.job_code, jobStatus: "FINISHING_STARTED" };
    });

    await logAction(actor.id, "FINISHING_STARTED", "ProductionJob", result.jobCode, null, null);
    revalidatePath("/finishing");
    revalidatePath("/scan");
    return ok({ jobStatus: result.jobStatus });
  } catch (e) {
    console.error("startFinishing:", e);
    return fail(e instanceof Error ? e.message : "Gagal memulai finishing.");
  }
}

export async function finishFinishing(
  jobCode: string,
  input: { actualQty: number; notes?: string }
): Promise<ActionResult<{ jobStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.role)) return fail("Hanya role Gudang yang boleh menyelesaikan finishing.");
    if (!(input.actualQty > 0)) return fail("Jumlah aktual finishing tidak boleh 0.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.status !== "FINISHING_STARTED") throw new Error(`Status job bukan FINISHING_STARTED (sekarang: ${job.status}).`);

      const fj = await tx.finishingJob.findFirst({
        where: { job_id: job.id, status: "STARTED" },
        orderBy: { created_at: "desc" },
      });
      if (!fj) throw new Error("Finishing job aktif tidak ditemukan.");

      await tx.finishingJob.update({
        where: { id: fj.id },
        data: {
          status: "COMPLETE",
          completed_at: new Date(),
          actual_qty: input.actualQty,
          notes: input.notes || null,
          label_printed_at: new Date(),
        },
      });
      await tx.productionJob.update({ where: { id: job.id }, data: { status: "FINISHING_COMPLETE" } });
      // Catatan: FINISHING_COMPLETE saja TIDAK membuat order READY_FOR_PICKUP —
      // wajib lewat storage (SCAN 6+7) di Sprint 5.
      await advanceOrderWhenAllJobs(
        tx,
        job.order_id,
        ["FINISHING_COMPLETE"],
        "FINISHING_COMPLETE",
        ["FINISHING_STARTED"]
      );
      return { jobCode: job.job_code, jobStatus: "FINISHING_COMPLETE" };
    });

    await logAction(actor.id, "FINISHING_COMPLETE", "ProductionJob", result.jobCode, null, {
      actual_qty: input.actualQty,
    });
    revalidatePath("/finishing");
    revalidatePath("/scan");
    return ok({ jobStatus: result.jobStatus });
  } catch (e) {
    console.error("finishFinishing:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyelesaikan finishing.");
  }
}
