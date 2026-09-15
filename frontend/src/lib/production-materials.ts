import { Prisma } from "@prisma/client";

export const ACTIVE_PRINT_STATUSES = ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_PAUSED"];

export async function validateMachineMaterials(tx: Prisma.TransactionClient, tenantId: string, machineId: string, materialIds: (string | null)[]) {
  const ids = [...new Set(materialIds.filter((id): id is string => !!id))];
  if (!ids.length || materialIds.some(id => !id)) throw new Error("Bahan rencana belum lengkap. Minta Admin meninjau item job.");
  const count = await tx.machineMaterial.count({ where: { tenant_id: tenantId, machine_id: machineId, material_id: { in: ids }, material: { active: true, tenant_id: tenantId } } });
  if (count !== ids.length) throw new Error("Bahan job belum terdaftar pada mesin ini atau sudah nonaktif. Atur material mesin melalui Gudang.");
}

export async function getJobMaterialPlan(tx: Prisma.TransactionClient, tenantId: string, job: { id: string; order_id: string; machine_id: string }) {
  const links = await tx.productionJobItem.findMany({ where: { tenant_id: tenantId, job_id: job.id }, include: {
    order_item: { include: { product: { include: { material_options: { where: { tenant_id: tenantId, active: true, role: "PRIMARY", material: { active: true, purpose: "PRIMARY", type: { not: "INK" } } } } } } } },
  } });
  if (!links.length) throw new Error("Item job belum ditetapkan. Admin perlu meninjau item dan bahan job lama.");
  for (const link of links) {
    const item = link.order_item;
    if (item.tenant_id !== tenantId || item.order_id !== job.order_id || item.retail_product_id || !link.material_id) throw new Error("Item/bahan job tidak valid untuk order ini.");
    if (!item.product_id && link.material_id !== item.material_id) throw new Error("Bahan item custom harus sesuai order. Revisi order untuk menggantinya.");
    if (item.product_id && !item.product?.material_options.some(m => m.material_id === link.material_id)) throw new Error(`Bahan item ${item.description || item.id} tidak diizinkan untuk produknya. Tinjau konfigurasi atau substitusi sebelum melanjutkan.`);
  }
  const plannedIds = [...new Set(links.map(l => l.material_id!))];
  await validateMachineMaterials(tx, tenantId, job.machine_id, plannedIds);
  const consumables = await tx.machineMaterial.findMany({ where: { tenant_id: tenantId, machine_id: job.machine_id, material: { tenant_id: tenantId, active: true, purpose: "CONSUMABLE" } }, select: { material_id: true } });
  return { links, plannedIds, consumableIds: consumables.map(m => m.material_id) };
}

/** Convert usage units to stock units once, with ledger precision. */
export function stockUsage(usage: number, waste: number, conversionFactor: number) {
  if (![usage, waste, conversionFactor].every(Number.isFinite) || usage <= 0 || waste < 0 || conversionFactor <= 0) throw new Error("Pemakaian/konversi material tidak valid.");
  const used = new Prisma.Decimal(usage).div(conversionFactor).toDecimalPlaces(6);
  const wasted = new Prisma.Decimal(waste).div(conversionFactor).toDecimalPlaces(6);
  if (used.lte(0) || (waste > 0 && wasted.lte(0))) throw new Error("Pemakaian terlalu kecil untuk presisi stok (6 desimal).");
  return { used, wasted, total: used.plus(wasted) };
}

export function validateUsageIds(plannedIds: string[], consumableIds: string[], submittedIds: string[]) {
  if (!plannedIds.length) throw new Error("Bahan utama job belum ditetapkan.");
  if (new Set(submittedIds).size !== submittedIds.length) throw new Error("Gabungkan pemakaian bahan yang sama menjadi satu baris.");
  if (submittedIds.some(id => !plannedIds.includes(id) && !consumableIds.includes(id))) throw new Error("Material bukan bahan rencana job atau bahan pendukung mesin. Minta Admin meninjau substitusi.");
  if (plannedIds.some(id => !submittedIds.includes(id))) throw new Error("Catat pemakaian setiap bahan utama job sebelum menyelesaikan produksi.");
}
