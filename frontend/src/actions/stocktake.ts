"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { requireOperationalCheckIn } from "@/lib/attendance-policy";
import { logAction } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";
import { revalidatePath } from "next/cache";

const ACTIVE_STATUSES = ["DRAFT", "SUBMITTED"] as const;

function shapeStocktake(stocktake: {
  id: string;
  status: string;
  notes: string | null;
  created_at: Date;
  submitted_at: Date | null;
  approved_at: Date | null;
  creator: { name: string };
  submitter: { name: string } | null;
  approver: { name: string } | null;
  items: Array<{
    id: string;
    material_id: string;
    system_stock: unknown;
    counted_stock: unknown;
    variance: unknown;
    notes: string | null;
    material: { material_code: string; name: string; unit_stock: string; current_stock: unknown };
  }>;
}) {
  return {
    id: stocktake.id,
    status: stocktake.status,
    notes: stocktake.notes,
    createdAt: stocktake.created_at,
    submittedAt: stocktake.submitted_at,
    approvedAt: stocktake.approved_at,
    createdBy: stocktake.creator.name,
    submittedBy: stocktake.submitter?.name ?? null,
    approvedBy: stocktake.approver?.name ?? null,
    items: stocktake.items.map((item) => ({
      id: item.id,
      materialId: item.material_id,
      materialCode: item.material.material_code,
      materialName: item.material.name,
      unitStock: item.material.unit_stock,
      systemStock: Number(item.system_stock),
      countedStock: item.counted_stock == null ? null : Number(item.counted_stock),
      variance: item.variance == null ? null : Number(item.variance),
      currentStock: Number(item.material.current_stock),
      notes: item.notes,
    })),
  };
}

const STOCKTAKE_INCLUDE = {
  creator: { select: { name: true } },
  submitter: { select: { name: true } },
  approver: { select: { name: true } },
  items: {
    orderBy: { material: { name: "asc" as const } },
    include: { material: { select: { material_code: true, name: true, unit_stock: true, current_stock: true } } },
  },
} as const;

export async function getMaterialStocktake(): Promise<ActionResult<ReturnType<typeof shapeStocktake> | null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "material.view")) return fail("Anda tidak memiliki akses melihat stock opname.");
    const stocktake = await prisma.materialStocktake.findFirst({
      where: { tenant_id: tenant.id, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { created_at: "desc" },
      include: STOCKTAKE_INCLUDE,
    });
    return ok(stocktake ? shapeStocktake(stocktake) : null);
  } catch (e) {
    console.error("getMaterialStocktake:", e);
    return fail(safeError(e, "Gagal memuat stock opname."));
  }
}

export async function startMaterialStocktake(notes?: string): Promise<ActionResult<ReturnType<typeof shapeStocktake>>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "material.stocktake")) return fail("Hanya Gudang/Owner yang boleh memulai stock opname.");
    await requireOperationalCheckIn(tenant.id, actor);

    const stocktake = await prisma.$transaction(async (tx) => {
      const active = await tx.materialStocktake.findFirst({ where: { tenant_id: tenant.id, status: { in: [...ACTIVE_STATUSES] } }, orderBy: { created_at: "desc" }, include: STOCKTAKE_INCLUDE });
      if (active) return active;
      const materials = await tx.material.findMany({ where: { tenant_id: tenant.id, active: true }, orderBy: { name: "asc" }, select: { id: true, current_stock: true } });
      if (!materials.length) throw new Error("Belum ada material aktif untuk dihitung.");
      const created = await tx.materialStocktake.create({
        data: {
          tenant_id: tenant.id,
          created_by: actor.id,
          notes: notes?.trim() || null,
          items: { create: materials.map((material) => ({ tenant_id: tenant.id, material_id: material.id, system_stock: material.current_stock })) },
        },
        include: STOCKTAKE_INCLUDE,
      });
      return created;
    });
    await logAction(actor.id, "MATERIAL_STOCKTAKE_STARTED", "MaterialStocktake", stocktake.id, null, { notes });
    revalidatePath("/finishing");
    return ok(shapeStocktake(stocktake));
  } catch (e) {
    console.error("startMaterialStocktake:", e);
    return fail(safeError(e, "Gagal memulai stock opname."));
  }
}

export async function recordMaterialStocktakeCount(
  stocktakeId: string,
  materialId: string,
  countedStock: number,
  notes?: string
): Promise<ActionResult<{ variance: number }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "material.stocktake")) return fail("Anda tidak memiliki akses mengisi stock opname.");
    await requireOperationalCheckIn(tenant.id, actor);
    if (!Number.isFinite(countedStock) || countedStock < 0) return fail("Jumlah fisik tidak valid.");
    const result = await prisma.$transaction(async (tx) => {
      const stocktake = await tx.materialStocktake.findFirst({ where: { id: stocktakeId, tenant_id: tenant.id, status: "DRAFT" }, select: { id: true } });
      if (!stocktake) throw new Error("Stock opname tidak dalam status DRAFT.");
      const row = await tx.materialStocktakeItem.findFirst({ where: { stocktake_id: stocktakeId, tenant_id: tenant.id, material_id: materialId } });
      if (!row) throw new Error("Material tidak termasuk dalam sesi opname.");
      const variance = countedStock - Number(row.system_stock);
      await tx.materialStocktakeItem.update({ where: { id: row.id }, data: { counted_stock: countedStock, variance, notes: notes?.trim() || null, counted_by: actor.id, counted_at: new Date() } });
      return { variance };
    });
    revalidatePath("/finishing");
    return ok(result);
  } catch (e) {
    console.error("recordMaterialStocktakeCount:", e);
    return fail(safeError(e, "Gagal menyimpan hitung fisik."));
  }
}

export async function submitMaterialStocktake(stocktakeId: string): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "material.stocktake")) return fail("Hanya Gudang/Owner yang boleh mengirim stock opname.");
    await requireOperationalCheckIn(tenant.id, actor);
    await prisma.$transaction(async (tx) => {
      const missing = await tx.materialStocktakeItem.count({ where: { stocktake_id: stocktakeId, tenant_id: tenant.id, counted_stock: null } });
      if (missing > 0) throw new Error(`Masih ada ${missing} material yang belum dihitung.`);
      const moved = await tx.materialStocktake.updateMany({ where: { id: stocktakeId, tenant_id: tenant.id, status: "DRAFT" }, data: { status: "SUBMITTED", submitted_by: actor.id, submitted_at: new Date() } });
      if (moved.count === 0) throw new Error("Stock opname sudah dikirim atau tidak ditemukan.");
    });
    await logAction(actor.id, "MATERIAL_STOCKTAKE_SUBMITTED", "MaterialStocktake", stocktakeId, null, null);
    revalidatePath("/finishing");
    revalidatePath("/owner");
    return ok(null);
  } catch (e) {
    console.error("submitMaterialStocktake:", e);
    return fail(safeError(e, "Gagal mengirim stock opname."));
  }
}

export async function approveMaterialStocktake(stocktakeId: string): Promise<ActionResult<{ adjustments: number }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "material.stocktake_approve")) return fail("Hanya Owner yang boleh menyetujui stock opname.");
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MaterialStocktake" WHERE id = ${stocktakeId} AND tenant_id = ${tenant.id} FOR UPDATE`;
      const stocktake = await tx.materialStocktake.findFirst({ where: { id: stocktakeId, tenant_id: tenant.id, status: "SUBMITTED" }, include: { items: true } });
      if (!stocktake) throw new Error("Stock opname tidak dalam status SUBMITTED.");
      if (stocktake.items.some((item) => item.counted_stock == null)) throw new Error("Semua material harus memiliki hitung fisik.");
      let adjustments = 0;
      for (const item of stocktake.items) {
        await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${item.material_id} AND tenant_id = ${tenant.id} FOR UPDATE`;
        const material = await tx.material.findFirst({ where: { id: item.material_id, tenant_id: tenant.id, active: true } });
        if (!material) throw new Error("Material pada opname sudah tidak aktif.");
        const systemAtSnapshot = Number(item.system_stock);
        const current = Number(material.current_stock);
        const counted = Number(item.counted_stock);
        if (Math.abs(current - systemAtSnapshot) > 0.000001) throw new Error(`Stok ${material.name} berubah selama opname. Buat sesi opname baru.`);
        const variance = counted - current;
        if (Math.abs(variance) <= 0.000001) continue;
        await tx.material.update({ where: { id: material.id }, data: { current_stock: counted } });
        await tx.materialMovement.create({ data: { tenant_id: tenant.id, material_id: material.id, movement_type: "ADJUSTMENT", quantity_usage: 0, quantity_stock_change: variance, before_stock: current, after_stock: counted, performed_by: actor.id, reason: `Stock opname ${stocktake.id}${item.notes ? `: ${item.notes}` : ""}` } });
        adjustments += 1;
      }
      const approved = await tx.materialStocktake.updateMany({ where: { id: stocktakeId, tenant_id: tenant.id, status: "SUBMITTED" }, data: { status: "APPROVED", approved_by: actor.id, approved_at: new Date() } });
      if (approved.count === 0) throw new Error("Stock opname sudah diproses petugas lain.");
      return { adjustments };
    });
    await logAction(actor.id, "MATERIAL_STOCKTAKE_APPROVED", "MaterialStocktake", stocktakeId, null, result);
    revalidatePath("/finishing");
    revalidatePath("/owner");
    return ok(result);
  } catch (e) {
    console.error("approveMaterialStocktake:", e);
    return fail(safeError(e, "Gagal menyetujui stock opname."));
  }
}
