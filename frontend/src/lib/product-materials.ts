import type { Prisma } from "@prisma/client";

export type MaterialRate = { material_id: string; unit_price: number | null };
export const OPEN_ORDER_EXCLUSIONS = ["CLOSED", "CANCELLED"];

/** All catalog writers use this path; never widen a product from a default alone. */
export async function saveProductMaterials(
  tx: Prisma.TransactionClient, tenantId: string, productId: string,
  input: { material_ids: string[]; default_material_id: string | null; material_rates?: MaterialRate[] }
) {
  const ids = [...new Set(input.material_ids)];
  const def = input.default_material_id;
  if (def && !ids.includes(def)) throw new Error("Bahan default harus berasal dari bahan yang dipilih.");
  const materials = await tx.material.findMany({
    where: { tenant_id: tenantId, id: { in: ids }, active: true, purpose: "PRIMARY", type: { not: "INK" } },
    select: { id: true },
  });
  if (materials.length !== ids.length) throw new Error("Pilih bahan utama aktif milik toko ini. Tinta/bahan pendukung diatur pada mesin.");
  const rates = input.material_rates ?? [];
  if (new Set(rates.map(r => r.material_id)).size !== rates.length || rates.some(r => !ids.includes(r.material_id) || (r.unit_price != null && (!Number.isFinite(r.unit_price) || r.unit_price <= 0)))) {
    throw new Error("Tarif bahan harus positif dan berasal dari bahan yang dipilih.");
  }
  const old = await tx.productMaterial.findMany({ where: { tenant_id: tenantId, product_id: productId, active: true } });
  const removed = old.filter(r => !ids.includes(r.material_id)).map(r => r.material_id);
  if (removed.length && await tx.orderItem.count({ where: {
    tenant_id: tenantId, product_id: productId, material_id: { in: removed },
    order: { status: { notIn: OPEN_ORDER_EXCLUSIONS } },
  } })) throw new Error("Bahan masih dipakai order terbuka. Selesaikan atau revisi order tersebut sebelum menghapus relasi bahan.");
  await tx.productMaterial.updateMany({ where: { tenant_id: tenantId, product_id: productId }, data: { is_default: false } });
  await tx.productMaterial.updateMany({ where: { tenant_id: tenantId, product_id: productId, material_id: { notIn: ids } }, data: { active: false } });
  for (const [index, id] of ids.entries()) {
    const rate = rates.find(r => r.material_id === id);
    await tx.productMaterial.upsert({
      where: { tenant_id_product_id_material_id: { tenant_id: tenantId, product_id: productId, material_id: id } },
      create: { tenant_id: tenantId, product_id: productId, material_id: id, role: "PRIMARY", is_default: def === id, sort_order: index, unit_price: rate?.unit_price ?? null },
      update: { active: true, role: "PRIMARY", is_default: def === id, sort_order: index, ...(rate ? { unit_price: rate.unit_price } : {}) },
    });
  }
  await tx.product.update({ where: { id: productId }, data: { default_material_id: def } });
}

export async function validateCatalogMachine(tx: Prisma.TransactionClient, tenantId: string, machineId?: string | null) {
  if (machineId && !await tx.machine.findFirst({ where: { id: machineId, tenant_id: tenantId, status: "ACTIVE" }, select: { id: true } })) {
    throw new Error("Mesin default harus aktif dan milik toko ini.");
  }
}

/** Kategori dicek harus punya minimal 1 mesin ACTIVE milik toko ini saat produk disimpan; auto-release tetap mengecek ulang saat order dirilis (mesin bisa berubah status setelahnya). */
export async function validateCatalogMachineCategory(tx: Prisma.TransactionClient, tenantId: string, category?: string | null) {
  if (category && !await tx.machine.findFirst({ where: { tenant_id: tenantId, category, status: "ACTIVE" }, select: { id: true } })) {
    throw new Error("Kategori mesin default harus punya minimal satu mesin aktif.");
  }
}
