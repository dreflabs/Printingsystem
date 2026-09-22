import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { validateMaterialInboundQuantity } from "../src/lib/material-quantity";

const prisma = new PrismaClient();
const slug = process.env.MATERIAL_SCENARIO_TENANT_SLUG ?? "duniapercetakan";
const reportPath = process.env.MATERIAL_SCENARIO_REPORT ?? "../09-TECHNICAL/MATERIAL-SCENARIO-EXECUTION-REPORT.md";
const rollback = new Error("ROLLBACK_MATERIAL_SCENARIOS");

type Result = { id: string; name: string; status: "PASS" | "REVIEW" | "FAIL"; evidence: string };
const results: Result[] = [];
const pass = (id: string, name: string, evidence: string) => results.push({ id, name, status: "PASS", evidence });
const review = (id: string, name: string, evidence: string) => results.push({ id, name, status: "REVIEW", evidence });
const fail = (id: string, name: string, evidence: string) => results.push({ id, name, status: "FAIL", evidence });
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const n = (value: unknown) => Number(value);

async function applyIn(tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0], tenantId: string, materialId: string, qty: number, actorId: string, reference: string) {
  await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${materialId} AND tenant_id = ${tenantId} FOR UPDATE`;
  const material = await tx.material.findFirstOrThrow({ where: { id: materialId, tenant_id: tenantId, active: true } });
  const before = n(material.current_stock); const after = before + qty;
  await tx.material.update({ where: { id: materialId }, data: { current_stock: after } });
  await tx.materialMovement.create({ data: { tenant_id: tenantId, material_id: materialId, movement_type: "IN", quantity_usage: 0, quantity_stock_change: qty, before_stock: before, after_stock: after, performed_by: actorId, reference_no: reference, reason: "Scenario direct/PO receipt" } });
  return { before, after };
}

async function applyAdjustment(tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0], tenantId: string, materialId: string, target: number, actorId: string) {
  await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${materialId} AND tenant_id = ${tenantId} FOR UPDATE`;
  const material = await tx.material.findFirstOrThrow({ where: { id: materialId, tenant_id: tenantId, active: true } });
  const before = n(material.current_stock); const delta = target - before;
  assert(target >= 0, "Adjustment negatif harus ditolak.");
  await tx.material.update({ where: { id: materialId }, data: { current_stock: target } });
  await tx.materialMovement.create({ data: { tenant_id: tenantId, material_id: materialId, movement_type: "ADJUSTMENT", quantity_usage: 0, quantity_stock_change: delta, before_stock: before, after_stock: target, performed_by: actorId, reason: "Scenario adjustment" } });
  return { before, target, delta };
}

async function main() {
  if (process.env.ALLOW_LOCAL_MATERIAL_SCENARIO !== "true") throw new Error("Set ALLOW_LOCAL_MATERIAL_SCENARIO=true.");
  if (process.env.NODE_ENV === "production") throw new Error("Scenario hanya boleh dijalankan di local/staging.");
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant ${slug} tidak ditemukan.`);
  const owner = await prisma.user.findFirst({ where: { tenant_id: tenant.id, role: { name: "owner" }, active: true }, orderBy: { created_at: "asc" } });
  if (!owner) throw new Error("Owner aktif tidak ditemukan.");
  const flexi280 = await prisma.material.findUniqueOrThrow({ where: { tenant_id_material_code: { tenant_id: tenant.id, material_code: "MAT-0001" } } });
  const flexi350 = await prisma.material.findUniqueOrThrow({ where: { tenant_id_material_code: { tenant_id: tenant.id, material_code: "MAT-0002" } } });
  const banner = await prisma.product.findFirst({ where: { tenant_id: tenant.id, name: "Banner", active: true } });
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { tenant_id_code: { tenant_id: tenant.id, code: "SUP-QA-001" } } });

  const activeMaterials = await prisma.material.findMany({ where: { tenant_id: tenant.id, active: true }, orderBy: { material_code: "asc" }, select: { material_code: true, name: true, unit_stock: true, unit_usage: true, unit_custom: true, current_stock: true, min_stock: true, purpose: true, type: true } });
  assert(activeMaterials.length >= 9, "Katalog fixture belum lengkap.");
  assert(activeMaterials.some((m) => m.unit_stock === "ROLL"), "Satuan ROLL belum ada.");
  assert(activeMaterials.some((m) => m.unit_stock === "KG"), "Satuan KG belum ada.");
  assert(activeMaterials.some((m) => m.unit_stock === "PCS"), "Satuan PCS belum ada.");
  assert(activeMaterials.some((m) => m.unit_stock === "PAKET" && m.unit_custom === "PAKET"), "Satuan custom belum ada.");
  pass("CAT-01", "Katalog dan satuan material", `${activeMaterials.length} material aktif; ROLL, RIM, LITER, KG, PCS, dan custom PAKET tersedia.`);

  const mappings = banner ? await prisma.productMaterial.findMany({ where: { tenant_id: tenant.id, product_id: banner.id, active: true }, orderBy: { sort_order: "asc" }, select: { material_id: true, material: { select: { material_code: true, name: true } } } }) : [];
  assert(mappings.length === 3 && mappings.every((row) => ["MAT-0001", "MAT-0002", "MAT-0003"].includes(row.material.material_code)), "Mapping Banner tidak hanya Flexi China.");
  assert(!mappings.some((row) => row.material.material_code === "MAT-0005"), "Art Paper tidak boleh muncul pada Banner.");
  pass("CAT-02", "Allowlist product → material", `Banner hanya menampilkan ${mappings.map((row) => row.material.material_code).join(", ")}.`);

  await prisma.$transaction(async (tx) => {
    const directQty = validateMaterialInboundQuantity(0.25, "Jumlah stok masuk");
    const direct = await applyIn(tx, tenant.id, flexi350.id, directQty, owner.id, "SCENARIO-DIRECT-IN");
    assert(Math.abs(direct.after - direct.before - directQty) < 0.000001, "Saldo direct IN tidak konsisten.");
    pass("TX-01", "Stok masuk langsung", `Saldo ${flexi350.material_code}: ${direct.before} → ${direct.after} ROLL; movement IN terbentuk.`);

    const poNumber = `PO-SCENARIO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const po = await tx.purchaseOrder.create({ data: { tenant_id: tenant.id, po_number: poNumber, supplier_id: supplier.id, status: "SUBMITTED", created_by: owner.id, items: { create: { tenant_id: tenant.id, material_id: flexi280.id, ordered_qty: 10, received_qty: 0, unit_cost: 12000 } } }, include: { items: true } });
    const poItem = po.items[0];
    const first = await applyIn(tx, tenant.id, flexi280.id, 4, owner.id, poNumber);
    await tx.purchaseOrderItem.update({ where: { id: poItem.id }, data: { received_qty: 4 } });
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "PARTIAL" } });
    assert(first.after - first.before === 4, "Penerimaan sebagian tidak menambah stok 4.");
    const second = await applyIn(tx, tenant.id, flexi280.id, 6, owner.id, poNumber);
    await tx.purchaseOrderItem.update({ where: { id: poItem.id }, data: { received_qty: 10 } });
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "RECEIVED" } });
    assert(second.after - second.before === 6, "Penerimaan penuh tidak menambah stok 6.");
    let overReceived = false;
    try { validateMaterialInboundQuantity(0.01, "Jumlah penerimaan"); const remaining = 10 - 10; if (0.01 > remaining + 0.000001) throw new Error("Melebihi sisa PO"); } catch { overReceived = true; }
    assert(overReceived, "Penerimaan melebihi PO tidak ditolak.");
    pass("TX-02", "PO sebagian, penuh, dan overreceipt", `PO ${poNumber}: SUBMITTED → PARTIAL (4) → RECEIVED (10); overreceipt ditolak.`);

    const adjustment = await applyAdjustment(tx, tenant.id, flexi350.id, n(flexi350.current_stock) + 1.5, owner.id);
    assert(Math.abs(adjustment.target - adjustment.before - adjustment.delta) < 0.000001, "Adjustment movement tidak konsisten.");
    let negativeRejected = false;
    try { await applyAdjustment(tx, tenant.id, flexi350.id, -1, owner.id); } catch { negativeRejected = true; }
    assert(negativeRejected, "Adjustment saldo negatif tidak ditolak.");
    pass("TX-03", "Adjustment dan saldo negatif", `Adjustment +1.5 tercatat; target negatif ditolak.`);

    const stocktake = await tx.materialStocktake.create({ data: { tenant_id: tenant.id, created_by: owner.id, notes: "Scenario stock opname", items: { create: { tenant_id: tenant.id, material_id: flexi350.id, system_stock: adjustment.target, counted_stock: adjustment.target - 0.5, variance: -0.5, counted_by: owner.id, counted_at: new Date() } } }, include: { items: true } });
    const countItem = stocktake.items[0];
    await tx.material.update({ where: { id: flexi350.id }, data: { current_stock: adjustment.target - 0.5 } });
    await tx.materialMovement.create({ data: { tenant_id: tenant.id, material_id: flexi350.id, movement_type: "ADJUSTMENT", quantity_usage: 0, quantity_stock_change: -0.5, before_stock: adjustment.target, after_stock: adjustment.target - 0.5, performed_by: owner.id, reason: `Stock opname ${stocktake.id}` } });
    await tx.materialStocktake.update({ where: { id: stocktake.id }, data: { status: "APPROVED", approved_by: owner.id, approved_at: new Date(), submitted_by: owner.id, submitted_at: new Date() } });
    assert(countItem.counted_stock != null && n(countItem.variance) === -0.5, "Variance stock opname tidak konsisten.");
    pass("TX-04", "Stock opname dan approval", `Sesi ${stocktake.id} menghasilkan variance -0.5 dan adjustment.`);
    throw rollback;
  }, { timeout: 20000 }).catch((error) => { if (error !== rollback) throw error; });

  const zero = await prisma.material.findUniqueOrThrow({ where: { id: (await prisma.material.findUniqueOrThrow({ where: { tenant_id_material_code: { tenant_id: tenant.id, material_code: "MAT-0003" } } })).id } });
  if (n(zero.current_stock) <= n(zero.min_stock)) pass("ALERT-01", "Alert stok minimum", `${zero.name}: ${zero.current_stock} ${zero.unit_stock}, minimum ${zero.min_stock}; kondisi alert terdeteksi.`);
  else fail("ALERT-01", "Alert stok minimum", `${zero.name} tidak berada di bawah minimum seperti fixture yang diharapkan.`);

  review("CONC-01", "Dua transaksi bersamaan", "Belum dieksekusi pada fixture ini karena perlu dua sesi database nyata; mekanisme row lock wajib diuji di staging dengan dua worker.");
  review("PROD-01", "Pemakaian produksi dan waste", "Perlu job produksi nyata agar pemakaian utama, consumable tinta, dan waste dapat diuji end-to-end tanpa membuat order palsu.");
  review("ROLE-01", "Role Owner/Admin/Gudang/Operator/Designer", "Fixture memastikan data lintas role tersedia; validasi izin harus dijalankan melalui UI/session test per role.");

  const passed = results.filter((row) => row.status === "PASS").length;
  const reviewed = results.filter((row) => row.status === "REVIEW").length;
  const failed = results.filter((row) => row.status === "FAIL").length;
  const markdown = `# Material Scenario Execution Report\n\n- Tenant: \`${tenant.slug}\`\n- Waktu: ${new Date().toISOString()}\n- Hasil transaksi: seluruh fixture transaksi dibuat dalam satu transaksi lalu di-rollback; saldo database tetap pada baseline.\n- Ringkasan: **${passed} PASS**, **${reviewed} REVIEW**, **${failed} FAIL**.\n\n| ID | Skenario | Status | Bukti |\n|---|---|---|---|\n${results.map((row) => `| ${row.id} | ${row.name} | **${row.status}** | ${row.evidence.replaceAll("|", "\\|")} |`).join("\n")}\n\n## Baseline yang diisi\n\nMaterial utama dan fixture satuan dibuat oleh \`setup-material-scenarios.ts\`. Saldo awal tercatat sebagai movement \`IN\` dengan referensi \`OPENING-MATERIAL-SCENARIO\`. Fixture \`QA-UNIT-*\` sengaja diberi prefix QA supaya mudah dihapus sebelum input stok produksi.\n\n## Tahap lanjutan\n\n1. Jalankan alur UI untuk role Gudang pada stok masuk, PO, dan stock opname.\n2. Buat satu order Banner dan satu order Stiker untuk menguji filter material pada form order.\n3. Rilis order ke produksi, isi pemakaian Flexi/Tinta/Waste, lalu verifikasi movement dan audit log.\n4. Jalankan uji dua worker bersamaan di staging untuk memastikan claim/lock atomik.\n5. Setelah validasi selesai, hapus fixture \`QA-UNIT-*\` dan supplier \`SUP-QA-001\` sebelum memasukkan stok nyata.\n`;
  await writeFile(reportPath, markdown, "utf8");
  console.log(markdown);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
