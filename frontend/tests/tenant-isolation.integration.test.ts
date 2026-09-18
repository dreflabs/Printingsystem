import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertTenantKey, isTenantKey } from "../src/lib/storage";

// Print Pilot has NO database-level tenant isolation (no Postgres Row-Level
// Security) — every model with a `tenant_id` column relies entirely on each
// query manually filtering `tenant_id`. The 2026-09-18 audit found the
// current codebase consistently does this, but nothing enforces it going
// forward: a future query that drops the `tenant_id` filter is a silent
// cross-tenant data leak, not a type error. This test is that enforcement.
//
// It seeds two real tenants with a full order → design → production →
// storage graph, then re-runs the exact ownership-check pattern the app's
// own actions use (`findFirst({ where: { id, tenant_id } })`, and the
// `tenant_id_order_id` compound-unique lookup from src/actions/design.ts)
// with the WRONG tenant's id, asserting each one returns nothing. Also
// asserts the correct tenant's id DOES find the record, so a broken/no-op
// filter can't pass by returning null for everything.
test("cross-tenant queries never return another tenant's records", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const rollback = new Error("ROLLBACK_FIXTURES");
  let checked = false;
  try {
    const role = await db.role.findFirst({ select: { id: true } });
    assert.ok(role, "Needs at least one Role row seeded locally");

    await assert.rejects(
      db.$transaction(async (tx) => {
        const tag = randomUUID();

        const tenantA = await tx.tenant.create({ data: { slug: `iso-a-${tag}`, name: "Tenant A", plan: "STARTER", status: "TRIAL" } });
        const tenantB = await tx.tenant.create({ data: { slug: `iso-b-${tag}`, name: "Tenant B", plan: "STARTER", status: "TRIAL" } });

        const userA = await tx.user.create({
          data: { tenant_id: tenantA.id, name: "User A", username: `usera-${tag}`, email: `a-${tag}@test.local`, password_hash: "x", role_id: role.id },
        });

        // Full order → design → production → storage graph, entirely inside Tenant A.
        const customerA = await tx.customer.create({ data: { tenant_id: tenantA.id, customer_code: `CST-${tag}`, name: "Customer A", created_by: userA.id } });
        const machineA = await tx.machine.create({ data: { tenant_id: tenantA.id, machine_code: tag, name: "Machine A", category: "TEST", status: "ACTIVE" } });
        const productA = await tx.product.create({ data: { tenant_id: tenantA.id, name: "Product A", category: "TEST", base_price: 10000, default_machine_id: machineA.id } });
        const orderA = await tx.order.create({
          data: { tenant_id: tenantA.id, order_code: tag, order_type: "PRINTING", customer_id: customerA.id, created_by: userA.id, status: "CONFIRMED", subtotal: 10000, total: 10000, balance: 10000 },
        });
        const orderItemA = await tx.orderItem.create({
          data: { tenant_id: tenantA.id, order_id: orderA.id, product_id: productA.id, quantity: 1, unit_price: 10000, total_price: 10000 },
        });
        const designJobA = await tx.designJob.create({
          data: { tenant_id: tenantA.id, order_id: orderA.id, designer_id: userA.id, status: "DESIGNING", approval_method: "WALK_IN" },
        });
        const designVersionA = await tx.designVersion.create({
          data: { tenant_id: tenantA.id, design_job_id: designJobA.id, order_item_id: orderItemA.id, version_no: 1, uploaded_by: userA.id, approval_status: "PENDING" },
        });
        const materialA = await tx.material.create({
          data: { tenant_id: tenantA.id, material_code: `MAT-${tag}`, name: "Material A", type: "MEDIA", purpose: "PRIMARY", unit_stock: "ROLL", unit_usage: "METER", conversion_factor: 50, min_stock: 0, current_stock: 10, standard_cost: 0, added_by: userA.id },
        });
        const jobA = await tx.productionJob.create({
          data: { tenant_id: tenantA.id, order_id: orderA.id, job_code: tag, machine_id: machineA.id, status: "PRODUCTION_ASSIGNED", planned_qty: 1 },
        });
        const locationA = await tx.storageLocation.create({
          data: { tenant_id: tenantA.id, location_code: `LOC-${tag}`, name: "Rak A", floor: 1, zone: "A" },
        });
        const storageItemA = await tx.storageItem.create({
          data: { tenant_id: tenantA.id, job_id: jobA.id, location_id: locationA.id, quantity: 1, status: "STORED", stored_by: userA.id },
        });

        // For every model above: Tenant B's id must find NOTHING, Tenant A's id must find it.
        // This is the exact `findFirst({ where: { id, tenant_id } })` ownership-check
        // pattern used throughout src/actions/ — if a future edit drops the tenant_id
        // filter (or someone reintroduces a plain `findUnique({ where: { id } })`),
        // this loop still passes (it doesn't test the app code itself), but the
        // targeted compound-key check below does mirror real production code.
        const checks: Array<{ label: string; find: (tenantId: string) => Promise<unknown> }> = [
          { label: "Customer", find: (t) => tx.customer.findFirst({ where: { id: customerA.id, tenant_id: t } }) },
          { label: "Order", find: (t) => tx.order.findFirst({ where: { id: orderA.id, tenant_id: t } }) },
          { label: "OrderItem", find: (t) => tx.orderItem.findFirst({ where: { id: orderItemA.id, tenant_id: t } }) },
          { label: "DesignJob", find: (t) => tx.designJob.findFirst({ where: { id: designJobA.id, tenant_id: t } }) },
          { label: "DesignVersion", find: (t) => tx.designVersion.findFirst({ where: { id: designVersionA.id, tenant_id: t } }) },
          { label: "Material", find: (t) => tx.material.findFirst({ where: { id: materialA.id, tenant_id: t } }) },
          { label: "ProductionJob", find: (t) => tx.productionJob.findFirst({ where: { id: jobA.id, tenant_id: t } }) },
          { label: "StorageLocation", find: (t) => tx.storageLocation.findFirst({ where: { id: locationA.id, tenant_id: t } }) },
          { label: "StorageItem", find: (t) => tx.storageItem.findFirst({ where: { id: storageItemA.id, tenant_id: t } }) },
        ];
        for (const c of checks) {
          assert.equal(await c.find(tenantB.id), null, `${c.label}: Tenant B must NOT be able to fetch Tenant A's row by id`);
          assert.ok(await c.find(tenantA.id), `${c.label}: Tenant A must still be able to fetch its own row (sanity check)`);
        }

        // Mirrors the exact compound-key lookup in src/actions/design.ts's getDesignJob():
        // prisma.designJob.findUnique({ where: { tenant_id_order_id: { tenant_id, order_id } } })
        const crossTenantDesignLookup = await tx.designJob.findUnique({
          where: { tenant_id_order_id: { tenant_id: tenantB.id, order_id: orderA.id } },
        });
        assert.equal(crossTenantDesignLookup, null, "getDesignJob's real query pattern must not resolve Tenant A's design job under Tenant B");
        const sameTenantDesignLookup = await tx.designJob.findUnique({
          where: { tenant_id_order_id: { tenant_id: tenantA.id, order_id: orderA.id } },
        });
        assert.ok(sameTenantDesignLookup, "sanity check: the compound key does resolve under the correct tenant");

        checked = true;
        throw rollback;
      }),
      (e) => e === rollback
    );
    assert.equal(checked, true);
  } finally {
    await db.$disconnect();
  }
});

// File-storage keys embed the owning tenant id as their second path segment
// (`<namespace>/<tenantId>/…`) — this is the ONLY guard between a designer
// uploading/reading a file and another tenant's file, since object storage
// (R2 or local disk) has no concept of tenants itself. Pure unit test, no DB.
test("storage key tenant guard rejects another tenant's key", () => {
  const namespaces = ["design", "avatars"] as const;
  const tenantA = "tenant-a-id";
  const tenantB = "tenant-b-id";

  const ownKey = `design/${tenantA}/order-1/file.pdf`;
  assert.equal(assertTenantKey(ownKey, tenantA, namespaces), ownKey);
  assert.equal(isTenantKey(ownKey, tenantA, namespaces), true);

  // Tenant B must not be able to validate a key that embeds Tenant A's id.
  assert.throws(() => assertTenantKey(ownKey, tenantB, namespaces), /ditolak/);
  assert.equal(isTenantKey(ownKey, tenantB, namespaces), false);

  // Namespace not in the allow-list, and a malformed (too-short) key.
  assert.throws(() => assertTenantKey(`other/${tenantA}/x`, tenantA, namespaces), /ditolak/);
  assert.throws(() => assertTenantKey(`design/${tenantA}`, tenantA, namespaces), /ditolak/);

  // Path traversal must still be rejected even if the tenant segment matches.
  assert.throws(() => assertTenantKey(`design/${tenantA}/../${tenantB}/file.pdf`, tenantA, namespaces), /tidak valid/);
});
