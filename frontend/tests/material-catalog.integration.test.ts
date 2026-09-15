import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { saveProductMaterials } from "../src/lib/product-materials";
import { getJobMaterialPlan, validateMachineMaterials } from "../src/lib/production-materials";

// Explicit opt-in. All fixture writes are rolled back; never run a seed/reset.
test("catalog and production rules against PostgreSQL (rollback only)", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient(); const rollback = new Error("ROLLBACK_FIXTURES"); let checked = false;
  try {
    const user = await db.user.findFirst({ select: { id: true, tenant_id: true } });
    assert.ok(user, "Needs one local tenant user for fixture foreign keys");
    await assert.rejects(db.$transaction(async tx => {
      const tid = user.tenant_id; const tag = randomUUID();
      const makeMaterial = (name: string, purpose = "PRIMARY", type = "MEDIA") => tx.material.create({ data: { tenant_id: tid, material_code: `${tag}-${name}`, name, type, purpose, unit_stock: "ROLL", unit_usage: "METER", conversion_factor: 50, min_stock: 0, current_stock: 2, standard_cost: 0, added_by: user.id } });
      const flexi = await makeMaterial("flexi"); const paper = await makeMaterial("paper"); const ink = await makeMaterial("ink", "CONSUMABLE", "INK");
      const machine = await tx.machine.create({ data: { tenant_id: tid, machine_code: tag, name: "Test", category: "TEST", status: "ACTIVE" } });
      const otherMachine = await tx.machine.create({ data: { tenant_id: tid, machine_code: tag+"-2", name: "Other", category: "TEST", status: "ACTIVE" } });
      const banner = await tx.product.create({ data: { tenant_id: tid, name: "Test banner", category: "TEST", base_price: 10000, default_machine_id: machine.id } });
      const brochure = await tx.product.create({ data: { tenant_id: tid, name: "Test brochure", category: "TEST", default_machine_id: otherMachine.id } });
      await saveProductMaterials(tx, tid, banner.id, { material_ids: [flexi.id], default_material_id: flexi.id, material_rates: [{ material_id: flexi.id, unit_price: 15000 }] });
      await saveProductMaterials(tx, tid, brochure.id, { material_ids: [paper.id], default_material_id: null });
      assert.equal(Number((await tx.productMaterial.findFirstOrThrow({ where: { product_id: banner.id, material_id: flexi.id } })).unit_price), 15000);
      await assert.rejects(saveProductMaterials(tx, tid, banner.id, { material_ids: [ink.id], default_material_id: null }), /bahan utama/);
      await assert.rejects(saveProductMaterials(tx, tid, banner.id, { material_ids: [flexi.id], default_material_id: paper.id }), /default/);
      await assert.rejects(saveProductMaterials(tx, "wrong-tenant", banner.id, { material_ids: [flexi.id], default_material_id: null }), /bahan utama/);
      await tx.machineMaterial.createMany({ data: [flexi, paper, ink].map(m => ({ tenant_id: tid, machine_id: machine.id, material_id: m.id })) });
      await assert.rejects(validateMachineMaterials(tx, tid, otherMachine.id, [flexi.id]), /mesin/);
      const order = await tx.order.create({ data: { tenant_id: tid, order_code: tag, order_type: "PRINTING", created_by: user.id, status: "PRODUCTION_ASSIGNED", subtotal: 30000, total: 30000, balance: 30000 } });
      const first = await tx.orderItem.create({ data: { tenant_id: tid, order_id: order.id, product_id: banner.id, material_id: flexi.id, quantity: 1, unit_price: 15000, total_price: 15000 } });
      const second = await tx.orderItem.create({ data: { tenant_id: tid, order_id: order.id, product_id: brochure.id, material_id: paper.id, quantity: 1, unit_price: 15000, total_price: 15000 } });
      const job = await tx.productionJob.create({ data: { tenant_id: tid, order_id: order.id, job_code: tag, machine_id: machine.id, status: "PRODUCTION_ASSIGNED", planned_qty: 1, items: { create: { tenant_id: tid, order_item_id: first.id, material_id: flexi.id } } } });
      const plan = await getJobMaterialPlan(tx, tid, job);
      assert.deepEqual(plan.plannedIds, [flexi.id]); assert.deepEqual(plan.consumableIds, [ink.id]);
      // Current catalog routing may change; frozen job scope must not.
      await tx.product.update({ where: { id: banner.id }, data: { default_machine_id: otherMachine.id } });
      assert.deepEqual((await getJobMaterialPlan(tx, tid, job)).links.map(l => l.order_item_id), [first.id]);
      // Another product's allowed material cannot validate the first item.
      await tx.productionJobItem.updateMany({ where: { job_id: job.id }, data: { material_id: paper.id } });
      await tx.productionJobItem.create({ data: { tenant_id: tid, job_id: job.id, order_item_id: second.id, material_id: paper.id } });
      await assert.rejects(getJobMaterialPlan(tx, tid, job), /tidak diizinkan/);
      await assert.rejects(saveProductMaterials(tx, tid, banner.id, { material_ids: [], default_material_id: null }), /order terbuka/);
      checked = true; throw rollback;
    }, { timeout: 20000 }), e => e === rollback);
    assert.equal(checked, true);
  } finally { await db.$disconnect(); }
});
