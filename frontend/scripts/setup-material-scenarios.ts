import { PrismaClient } from "@prisma/client";

/**
 * Local/staging-only material fixture. It is deliberately idempotent and never
 * deletes rows. Set ALLOW_LOCAL_MATERIAL_SCENARIO=true before running.
 */
const prisma = new PrismaClient();
const slug = process.env.MATERIAL_SCENARIO_TENANT_SLUG ?? "duniapercetakan";

type MaterialSpec = {
  code: string;
  name: string;
  groupName: string;
  specifications: string;
  purpose: "PRIMARY" | "CONSUMABLE";
  type: "MEDIA" | "INK" | "OTHER";
  unitStock: string;
  unitUsage: string;
  unitCustom?: string;
  conversionFactor: number;
  minStock: number;
  openingStock: number;
  standardCost: number;
  machineCodes: string[];
};

const materials: MaterialSpec[] = [
  { code: "MAT-0001", name: "Flexi China 280 gr", groupName: "BANNER", specifications: "280 gsm · lebar roll 320 cm", purpose: "PRIMARY", type: "MEDIA", unitStock: "ROLL", unitUsage: "METER", conversionFactor: 50, minStock: 10, openingStock: 100, standardCost: 12000, machineCodes: ["MCH-001", "MCH-002"] },
  { code: "MAT-0002", name: "Flexi China 350 gr", groupName: "BANNER", specifications: "350 gsm · lebar roll 320 cm", purpose: "PRIMARY", type: "MEDIA", unitStock: "ROLL", unitUsage: "METER", conversionFactor: 50, minStock: 10, openingStock: 50.5, standardCost: 14500, machineCodes: ["MCH-001", "MCH-002"] },
  { code: "MAT-0003", name: "Flexi China 400 gr", groupName: "BANNER", specifications: "400 gsm · lebar roll 320 cm", purpose: "PRIMARY", type: "MEDIA", unitStock: "ROLL", unitUsage: "METER", conversionFactor: 50, minStock: 10, openingStock: 0, standardCost: 17000, machineCodes: ["MCH-001", "MCH-002"] },
  { code: "MAT-0004", name: "Sticker Vinyl", groupName: "STICKER", specifications: "Vinyl indoor · lebar roll 122 cm", purpose: "PRIMARY", type: "MEDIA", unitStock: "ROLL", unitUsage: "METER", conversionFactor: 50, minStock: 5, openingStock: 25, standardCost: 22000, machineCodes: ["MCH-003"] },
  { code: "MAT-0005", name: "Art Paper", groupName: "KERTAS", specifications: "260 gsm · 1 rim = 500 lembar", purpose: "PRIMARY", type: "MEDIA", unitStock: "RIM", unitUsage: "LEMBAR", conversionFactor: 500, minStock: 2, openingStock: 10, standardCost: 650000, machineCodes: ["MCH-003"] },
  { code: "MAT-0006", name: "Tinta Eco Solvent", groupName: "TINTA", specifications: "Tinta mesin outdoor · botol 1 liter", purpose: "CONSUMABLE", type: "INK", unitStock: "LITER", unitUsage: "ML", conversionFactor: 1000, minStock: 1, openingStock: 5, standardCost: 350000, machineCodes: ["MCH-001", "MCH-002", "MCH-003"] },
  { code: "QA-UNIT-KG", name: "QA - Bubuk Laminasi (KG)", groupName: "QA — UJI SATUAN", specifications: "Fixture pengujian satuan kilogram", purpose: "CONSUMABLE", type: "OTHER", unitStock: "KG", unitUsage: "GRAM", conversionFactor: 1000, minStock: 5, openingStock: 25, standardCost: 80000, machineCodes: [] },
  { code: "QA-UNIT-PCS", name: "QA - Core Roll (PCS)", groupName: "QA — UJI SATUAN", specifications: "Fixture pengujian satuan pcs", purpose: "CONSUMABLE", type: "OTHER", unitStock: "PCS", unitUsage: "PCS", conversionFactor: 1, minStock: 2, openingStock: 20, standardCost: 15000, machineCodes: [] },
  { code: "QA-UNIT-CUSTOM", name: "QA - Bahan Khusus (PAKET)", groupName: "QA — UJI SATUAN", specifications: "Fixture pengujian satuan custom", purpose: "CONSUMABLE", type: "OTHER", unitStock: "PAKET", unitUsage: "PAKET", unitCustom: "PAKET", conversionFactor: 1, minStock: 1, openingStock: 7, standardCost: 50000, machineCodes: [] },
];

const productMaterialMap: Record<string, { materialCodes: string[]; defaultCode: string; machineCode: string; rates: Record<string, number> }> = {
  "Banner": { materialCodes: ["MAT-0001", "MAT-0002", "MAT-0003"], defaultCode: "MAT-0001", machineCode: "MCH-001", rates: { "MAT-0001": 15000, "MAT-0002": 18000, "MAT-0003": 22000 } },
  "Stiker Viny A3": { materialCodes: ["MAT-0004"], defaultCode: "MAT-0004", machineCode: "MCH-003", rates: { "MAT-0004": 24000 } },
  "Kartu Nama 2 Sisi": { materialCodes: ["MAT-0005"], defaultCode: "MAT-0005", machineCode: "MCH-003", rates: { "MAT-0005": 750000 } },
  "Brosur A4 Lipat 3": { materialCodes: ["MAT-0005"], defaultCode: "MAT-0005", machineCode: "MCH-003", rates: { "MAT-0005": 750000 } },
  "Lanyard Custom": { materialCodes: ["MAT-0004"], defaultCode: "MAT-0004", machineCode: "MCH-003", rates: { "MAT-0004": 24000 } },
};

async function main() {
  if (process.env.ALLOW_LOCAL_MATERIAL_SCENARIO !== "true") {
    throw new Error("Fixture lokal tidak dijalankan. Set ALLOW_LOCAL_MATERIAL_SCENARIO=true.");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Fixture material hanya boleh dijalankan di local/staging.");

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant ${slug} tidak ditemukan.`);
  const owner = await prisma.user.findFirst({ where: { tenant_id: tenant.id, role: { name: "owner" }, active: true }, orderBy: { created_at: "asc" } });
  const warehouse = await prisma.user.findFirst({ where: { tenant_id: tenant.id, role: { name: "gudang" }, active: true }, orderBy: { created_at: "asc" } });
  if (!owner) throw new Error("User Owner aktif tidak ditemukan.");
  const stockActor = warehouse ?? owner;

  const machineRows = await prisma.machine.findMany({ where: { tenant_id: tenant.id }, select: { id: true, machine_code: true, status: true, default_operator_id: true } });
  const machinesByCode = new Map(machineRows.map((machine) => [machine.machine_code, machine]));

  const materialRows = new Map<string, { id: string; current_stock: number }>();
  for (const spec of materials) {
    const existing = await prisma.material.findUnique({ where: { tenant_id_material_code: { tenant_id: tenant.id, material_code: spec.code } } });
    const material = existing ?? await prisma.material.create({ data: {
      tenant_id: tenant.id, material_code: spec.code, name: spec.name, group_name: spec.groupName,
      specifications: spec.specifications, purpose: spec.purpose, type: spec.type,
      unit_stock: spec.unitStock, unit_usage: spec.unitUsage, unit_custom: spec.unitCustom ?? null,
      conversion_factor: spec.conversionFactor, is_shared: false, min_stock: spec.minStock,
      current_stock: 0, standard_cost: spec.standardCost, added_by: owner.id, active: true,
    } });
    if (existing) {
      await prisma.material.update({ where: { id: existing.id }, data: {
        name: spec.name, group_name: spec.groupName, specifications: spec.specifications,
        purpose: spec.purpose, type: spec.type, unit_stock: spec.unitStock, unit_usage: spec.unitUsage,
        unit_custom: spec.unitCustom ?? null, conversion_factor: spec.conversionFactor,
        min_stock: spec.minStock, standard_cost: spec.standardCost, active: true,
      } });
    }
    const current = Number(material.current_stock);
    materialRows.set(spec.code, { id: material.id, current_stock: current });

    for (const machineCode of spec.machineCodes) {
      const machine = machinesByCode.get(machineCode);
      if (!machine || machine.status !== "ACTIVE") throw new Error(`Mesin aktif ${machineCode} tidak tersedia.`);
      await prisma.machineMaterial.upsert({ where: { tenant_id_machine_id_material_id: { tenant_id: tenant.id, machine_id: machine.id, material_id: material.id } }, update: {}, create: { tenant_id: tenant.id, machine_id: machine.id, material_id: material.id } });
    }
    if (!existing && spec.openingStock > 0) {
      await prisma.$transaction(async (tx) => {
        const before = 0;
        await tx.material.update({ where: { id: material.id }, data: { current_stock: spec.openingStock } });
        await tx.materialMovement.create({ data: {
          tenant_id: tenant.id, material_id: material.id, movement_type: "IN", quantity_usage: 0,
          quantity_stock_change: spec.openingStock, before_stock: before, after_stock: spec.openingStock,
          unit_cost: spec.standardCost, reference_no: "OPENING-MATERIAL-SCENARIO", received_at: new Date(),
          performed_by: stockActor.id, reason: "Saldo awal fixture skenario material",
        } });
      });
    }
  }

  const supplier = await prisma.supplier.upsert({ where: { tenant_id_code: { tenant_id: tenant.id, code: "SUP-QA-001" } }, update: { name: "Supplier Uji Material", active: true }, create: { tenant_id: tenant.id, code: "SUP-QA-001", name: "Supplier Uji Material", active: true } });
  const productRows = await prisma.product.findMany({ where: { tenant_id: tenant.id, active: true }, select: { id: true, name: true } });
  const productsByName = new Map(productRows.map((product) => [product.name, product]));
  for (const [productName, mapping] of Object.entries(productMaterialMap)) {
    const product = productsByName.get(productName);
    if (!product) continue;
    const machine = machinesByCode.get(mapping.machineCode);
    if (!machine || machine.status !== "ACTIVE") throw new Error(`Mesin aktif ${mapping.machineCode} tidak tersedia.`);
    await prisma.product.update({ where: { id: product.id }, data: { default_material_id: materialRows.get(mapping.defaultCode)!.id, default_machine_id: machine.id } });
    for (const [sortOrder, code] of mapping.materialCodes.entries()) {
      const material = materialRows.get(code)!;
      await prisma.productMaterial.upsert({ where: { tenant_id_product_id_material_id: { tenant_id: tenant.id, product_id: product.id, material_id: material.id } }, update: { active: true, role: "PRIMARY", is_default: code === mapping.defaultCode, sort_order: sortOrder, unit_price: mapping.rates[code] ?? null }, create: { tenant_id: tenant.id, product_id: product.id, material_id: material.id, role: "PRIMARY", is_default: code === mapping.defaultCode, sort_order: sortOrder, unit_price: mapping.rates[code] ?? null } });
    }
  }

  const operatorRows = await prisma.user.findMany({ where: { tenant_id: tenant.id, active: true, role: { name: "operator" } }, select: { id: true } });
  const assigner = owner;
  for (const operator of operatorRows) {
    const assignedMachines = machineRows.filter((row) => row.default_operator_id === operator.id);
    for (const machine of assignedMachines) {
      await prisma.userMachine.upsert({ where: { user_id_machine_id: { user_id: operator.id, machine_id: machine.id } }, update: { assigned_by: assigner.id }, create: { tenant_id: tenant.id, user_id: operator.id, machine_id: machine.id, assigned_by: assigner.id } });
    }
  }

  console.log(JSON.stringify({ tenant: tenant.slug, supplier: supplier.code, materials: materials.map((spec) => ({ code: spec.code, name: spec.name, openingStock: spec.openingStock, unit: spec.unitStock })), mappings: Object.keys(productMaterialMap).filter((name) => productsByName.has(name)) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
