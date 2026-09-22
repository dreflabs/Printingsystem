"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { requireMutableActor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { getJobMaterialPlan, ACTIVE_PRINT_STATUSES } from "@/lib/production-materials";
import { safeError } from "@/lib/safe-error";
import { ok, fail } from "@/types";
import { revalidatePath } from "next/cache";

export async function getJobMaterialReview(jobCode: string) {
  try {
    const tenant = await requireTenant(); const actor = await requireMutableActor();
    await requireEntitlement(tenant.id, "inventory");
    if (!can(actor, "production.assign")) return fail("Hanya Admin/Owner yang boleh meninjau bahan job.");
    const job = await prisma.productionJob.findFirst({
      where: { tenant_id: tenant.id, job_code: jobCode },
      include: {
        items: true,
        machine: { select: { name: true } },
        order: {
          select: {
            items: {
              where: { retail_product_id: null },
              include: {
                material: { select: { name: true } },
                product: {
                  include: {
                    material_options: {
                      where: { tenant_id: tenant.id, active: true, role: "PRIMARY", material: { active: true, purpose: "PRIMARY", type: { not: "INK" } } },
                      include: { material: { select: { name: true, machines: { select: { machine_id: true } } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!job || !ACTIVE_PRINT_STATUSES.includes(job.status)) return fail("Job tidak tersedia untuk peninjauan.");
    return ok({ jobCode, machine: job.machine.name, scopeLocked: job.items.length > 0, started: !!job.actual_start,
      history: job.material_plan_history,
      items: job.order.items.map(it => ({
        id: it.id, name: it.description || it.product?.name || "Item cetak", quantity: it.quantity,
        selected: job.items.some(l => l.order_item_id === it.id),
        materialId: job.items.find(l => l.order_item_id === it.id)?.material_id ?? it.material_id ?? "",
        originalMaterial: it.material?.name ?? "Belum diatur",
        options: it.product?.material_options.filter(m => m.material.machines.some(machine => machine.machine_id === job.machine_id)).map(m => ({ id: m.material_id, name: m.material.name })) ?? (it.material_id ? [{ id: it.material_id, name: it.material?.name ?? "Bahan order" }] : []),
      })) });
  } catch (e) { return fail(safeError(e, "Gagal memuat peninjauan bahan job.")); }
}

export async function saveJobMaterialReview(jobCode: string, input: { items: { itemId: string; materialId: string }[]; reason: string; confirmed: boolean }) {
  try {
    const tenant = await requireTenant(); const actor = await requireMutableActor();
    await requireEntitlement(tenant.id, "inventory");
    if (!can(actor, "production.assign")) return fail("Hanya Admin/Owner yang boleh menetapkan bahan job.");
    if (input.confirmed !== true || (input.reason?.trim().length ?? 0) < 10) return fail("Konfirmasi kesesuaian desain/harga dan isi alasan minimal 10 karakter.");
    if (!input.items?.length || input.items.length !== new Set(input.items.map(i => i.itemId)).size) return fail("Pilih item job tanpa duplikasi.");
    const result = await prisma.$transaction(async tx => {
      const initial = await tx.productionJob.findFirst({ where: { tenant_id: tenant.id, job_code: jobCode }, select: { order_id: true, id: true } });
      if (!initial) throw new Error("Job tidak ditemukan.");
      // Serialize scope recovery across jobs of the same order, then with start/finish.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${initial.order_id} AND tenant_id = ${tenant.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "ProductionJob" WHERE id = ${initial.id} AND tenant_id = ${tenant.id} FOR UPDATE`;
      const job = await tx.productionJob.findUniqueOrThrow({ where: { id: initial.id }, include: { items: true, order: { select: { items: { where: { retail_product_id: null } } } } } });
      if (!ACTIVE_PRINT_STATUSES.includes(job.status)) throw new Error("Job sudah melewati proses cetak.");
      if (job.items.length && (job.items.length !== input.items.length || job.items.some(l => !input.items.some(i => i.itemId === l.order_item_id)))) throw new Error("Lingkup item job yang sudah ditetapkan tidak dapat diganti.");
      const changes = [];
      for (const row of input.items) {
        const item = job.order.items.find(it => it.id === row.itemId && it.tenant_id === tenant.id);
        if (!item || !row.materialId) throw new Error("Item/bahan tidak valid untuk order ini.");
        const previous = job.items.find(l => l.order_item_id === row.itemId)?.material_id ?? item.material_id;
        if (previous !== row.materialId && (job.actual_start || !["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED"].includes(job.status))) throw new Error("Produksi sudah dimulai. Substitusi bahan harus melalui revisi/rework terpisah; jangan mengganti rencana pemakaian berjalan.");
        if (!job.items.length && await tx.productionJobItem.count({ where: { tenant_id: tenant.id, order_item_id: row.itemId, job_id: { not: job.id }, job: { id: { not: job.parent_job_id ?? "" }, status: { notIn: ["SUPERSEDED", "CANCELLED"] } } } })) throw new Error("Item sudah termasuk job lain. Periksa pembagian mesin sebelum menyimpan.");
        await tx.productionJobItem.upsert({ where: { job_id_order_item_id: { job_id: job.id, order_item_id: row.itemId } }, create: { tenant_id: tenant.id, job_id: job.id, order_item_id: row.itemId, material_id: row.materialId }, update: { material_id: row.materialId } });
        changes.push({ item_id: row.itemId, before: previous, after: row.materialId });
      }
      await getJobMaterialPlan(tx, tenant.id, job);
      const history = Array.isArray(job.material_plan_history) ? job.material_plan_history : [];
      const event = { at: new Date().toISOString(), actor_id: actor.id, reason: input.reason.trim(), design_customer_price_confirmed: true, changes };
      await tx.productionJob.update({ where: { id: job.id }, data: { material_plan_history: [...history, event], ...(!job.items.length ? { planned_qty: job.order.items.filter(i => input.items.some(row => row.itemId === i.id)).reduce((n, i) => n + i.quantity, 0) } : {}) } });
      return { id: job.id, event };
    });
    await logAction(actor.id, "PRODUCTION_MATERIAL_PLAN_REVIEWED", "ProductionJob", result.id, null, result.event);
    revalidatePath("/admin/production"); revalidatePath("/operator"); revalidatePath("/scan");
    return ok({ jobCode });
  } catch (e) { return fail(safeError(e, "Gagal menyimpan rencana bahan job.")); }
}
