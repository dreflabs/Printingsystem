"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { ok, fail } from "@/types";

type PurchaseItemInput = { materialId: string; quantity: number; unitCost: number; notes?: string };

const dateOnly = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Tanggal tidak valid.");
  return parsed;
};

export async function getSuppliers() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "purchase.view")) return fail("Anda tidak memiliki akses melihat supplier.");
    const rows = await prisma.supplier.findMany({ where: { tenant_id: tenant.id }, orderBy: [{ active: "desc" }, { name: "asc" }] });
    return ok(rows);
  } catch (e) {
    console.error("getSuppliers:", e);
    return fail(safeError(e, "Gagal memuat supplier."));
  }
}

export async function createSupplier(data: { name: string; code?: string; phone?: string; email?: string; address?: string; notes?: string }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "purchase.create")) return fail("Hanya Admin/Owner yang boleh mengelola supplier.");
    const name = data.name?.trim();
    if (!name) return fail("Nama supplier wajib diisi.");
    const code = data.code?.trim().toUpperCase() || `SUP-${randomUUID().slice(0, 6).toUpperCase()}`;
    const supplier = await prisma.supplier.create({ data: { tenant_id: tenant.id, code, name, phone: data.phone?.trim() || null, email: data.email?.trim() || null, address: data.address?.trim() || null, notes: data.notes?.trim() || null } });
    await logAction(actor.id, "SUPPLIER_CREATED", "Supplier", supplier.id, null, { code, name });
    revalidatePath("/finishing");
    return ok(supplier);
  } catch (e) {
    console.error("createSupplier:", e);
    return fail(safeError(e, "Gagal menyimpan supplier."));
  }
}

export async function getPurchaseOrders() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "purchase.view")) return fail("Anda tidak memiliki akses melihat purchase order.");
    const rows = await prisma.purchaseOrder.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { order_date: "desc" },
      take: 100,
      include: { supplier: { select: { id: true, code: true, name: true } }, creator: { select: { name: true } }, items: { include: { material: { select: { id: true, material_code: true, name: true, unit_stock: true } } }, orderBy: { id: "asc" } } },
    });
    return ok(rows.map((po) => ({
      id: po.id, poNumber: po.po_number, status: po.status, orderDate: po.order_date, expectedDate: po.expected_date,
      notes: po.notes, supplier: po.supplier, createdBy: po.creator.name,
      items: po.items.map((item) => ({ id: item.id, materialId: item.material_id, material: item.material, orderedQty: Number(item.ordered_qty), receivedQty: Number(item.received_qty), unitCost: Number(item.unit_cost), notes: item.notes })),
    })));
  } catch (e) {
    console.error("getPurchaseOrders:", e);
    return fail(safeError(e, "Gagal memuat purchase order."));
  }
}

export async function createPurchaseOrder(data: { supplierId: string; expectedDate?: string; notes?: string; items: PurchaseItemInput[] }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "purchase.create")) return fail("Hanya Admin/Owner yang boleh membuat purchase order.");
    if (!data.supplierId) return fail("Supplier wajib dipilih.");
    if (!Array.isArray(data.items) || data.items.length === 0) return fail("Minimal satu material harus dipilih.");
    const dedupe = new Set<string>();
    for (const item of data.items) {
      if (dedupe.has(item.materialId)) return fail("Material tidak boleh diulang dalam satu purchase order.");
      dedupe.add(item.materialId);
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return fail("Jumlah order material harus lebih dari 0.");
      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) return fail("Harga beli material tidak valid.");
    }
    const expectedDate = dateOnly(data.expectedDate);
    const [supplier, materials] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: data.supplierId, tenant_id: tenant.id, active: true } }),
      prisma.material.findMany({ where: { tenant_id: tenant.id, active: true, id: { in: data.items.map((i) => i.materialId) } }, select: { id: true } }),
    ]);
    if (!supplier) return fail("Supplier tidak ditemukan atau nonaktif.");
    if (materials.length !== data.items.length) return fail("Ada material yang tidak ditemukan atau nonaktif.");
    const dateKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const poNumber = `PO-${dateKey}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const po = await prisma.purchaseOrder.create({ data: { tenant_id: tenant.id, po_number: poNumber, supplier_id: supplier.id, status: "SUBMITTED", expected_date: expectedDate, notes: data.notes?.trim() || null, created_by: actor.id, items: { create: data.items.map((item) => ({ tenant_id: tenant.id, material_id: item.materialId, ordered_qty: item.quantity, unit_cost: item.unitCost, notes: item.notes?.trim() || null })) } } });
    await logAction(actor.id, "PURCHASE_ORDER_CREATED", "PurchaseOrder", po.id, null, { po_number: poNumber, supplier_id: supplier.id, item_count: data.items.length });
    revalidatePath("/finishing");
    return ok({ id: po.id, poNumber });
  } catch (e) {
    console.error("createPurchaseOrder:", e);
    return fail(safeError(e, "Gagal membuat purchase order."));
  }
}

export async function receivePurchaseOrder(poItemId: string, quantity: number, data?: { receivedAt?: string; referenceNo?: string; notes?: string }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "purchase.receive")) return fail("Anda tidak memiliki akses menerima purchase order.");
    if (!Number.isFinite(quantity) || quantity <= 0) return fail("Jumlah penerimaan harus lebih dari 0.");
    const receivedAt = dateOnly(data?.receivedAt) ?? new Date();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PurchaseOrderItem" WHERE id = ${poItemId} AND tenant_id = ${tenant.id} FOR UPDATE`;
      const item = await tx.purchaseOrderItem.findFirst({ where: { id: poItemId, tenant_id: tenant.id }, include: { purchase_order: { include: { supplier: true } }, material: true } });
      if (!item) throw new Error("Item purchase order tidak ditemukan.");
      if (["CANCELLED", "RECEIVED", "DRAFT"].includes(item.purchase_order.status)) throw new Error("Purchase order tidak dapat menerima barang pada status ini.");
      const remaining = Number(item.ordered_qty) - Number(item.received_qty);
      if (quantity > remaining + 0.000001) throw new Error(`Jumlah melebihi sisa PO (${remaining}).`);
      await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${item.material_id} AND tenant_id = ${tenant.id} FOR UPDATE`;
      const material = await tx.material.findFirst({ where: { id: item.material_id, tenant_id: tenant.id, active: true } });
      if (!material) throw new Error("Material tidak ditemukan atau nonaktif.");
      const before = Number(material.current_stock); const after = before + quantity;
      await tx.material.update({ where: { id: material.id }, data: { current_stock: after } });
      const nextReceived = Number(item.received_qty) + quantity;
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { received_qty: nextReceived } });
      const allItems = await tx.purchaseOrderItem.findMany({ where: { purchase_order_id: item.purchase_order_id }, select: { ordered_qty: true, received_qty: true } });
      const complete = allItems.every((row) => Number(row.received_qty) >= Number(row.ordered_qty) - 0.000001);
      await tx.purchaseOrder.update({ where: { id: item.purchase_order_id }, data: { status: complete ? "RECEIVED" : "PARTIAL" } });
      await tx.materialMovement.create({ data: { tenant_id: tenant.id, material_id: material.id, movement_type: "IN", quantity_usage: 0, quantity_stock_change: quantity, before_stock: before, after_stock: after, supplier: item.purchase_order.supplier.name, supplier_id: item.purchase_order.supplier.id, unit_cost: item.unit_cost, reference_no: data?.referenceNo?.trim() || item.purchase_order.po_number, purchase_order_id: item.purchase_order_id, purchase_order_item_id: item.id, received_at: receivedAt, performed_by: actor.id, reason: data?.notes?.trim() || `Penerimaan ${item.purchase_order.po_number}` } });
      return { poNumber: item.purchase_order.po_number, material: material.name, received: quantity, after, status: complete ? "RECEIVED" : "PARTIAL" };
    });
    await logAction(actor.id, "PURCHASE_ORDER_RECEIVED", "PurchaseOrderItem", poItemId, null, result);
    revalidatePath("/finishing"); revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("receivePurchaseOrder:", e);
    return fail(safeError(e, "Gagal mencatat penerimaan purchase order."));
  }
}
