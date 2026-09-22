import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getTenantEntitlements, requireEntitlement, type EntitlementKey } from "../src/lib/entitlements";
import { SAAS_PLANS } from "../src/lib/saas-catalog";

// Explicit opt-in. Fixtures are committed then deleted in a finally block —
// unlike the rollback-only pattern elsewhere, `requireEntitlement` reads
// through the app's own global `prisma` client (src/lib/prisma.ts), a
// different connection than any local `tx`, so uncommitted rows in a
// transaction here would be invisible to it.
//
// Verifies the 2026-09-17 decision (SAAS-MODEL.md: QC locked for Starter)
// actually holds for a tenant reading its ACTIVE subscription plan's
// features_json — not just the LEGACY_PLAN_DEFAULTS fallback used when a
// tenant has no subscription row at all.
test("requireEntitlement locks qc for Starter and allows it for Pro", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  let starterTenantId, proTenantId, starterPlanId, proPlanId;
  try {
    const starterPlan = await db.subscriptionPlan.create({
      data: { name: "Starter test", slug: `starter-${tag}`, price_monthly: 0, features_json: JSON.stringify(["dashboard", "kanban"]) },
    });
    starterPlanId = starterPlan.id;
    const proPlan = await db.subscriptionPlan.create({
      data: { name: "Pro test", slug: `pro-${tag}`, price_monthly: 0, features_json: JSON.stringify(["dashboard", "kanban", "qc", "storage", "whatsapp_unlimited", "audit_trail"]) },
    });
    proPlanId = proPlan.id;
    const starterTenant = await db.tenant.create({ data: { slug: `st-${tag}`, name: "Starter Co", plan: "STARTER", status: "ACTIVE" } });
    starterTenantId = starterTenant.id;
    const proTenant = await db.tenant.create({ data: { slug: `pr-${tag}`, name: "Pro Co", plan: "PRO", status: "ACTIVE" } });
    proTenantId = proTenant.id;
    await db.tenantSubscription.create({ data: { tenant_id: starterTenant.id, plan_id: starterPlan.id, status: "ACTIVE" } });
    await db.tenantSubscription.create({ data: { tenant_id: proTenant.id, plan_id: proPlan.id, status: "ACTIVE" } });

    await assert.rejects(requireEntitlement(starterTenant.id, "qc"), /belum tersedia/);
    await assert.doesNotReject(requireEntitlement(proTenant.id, "qc"));
  } finally {
    if (starterTenantId) await db.tenantSubscription.deleteMany({ where: { tenant_id: starterTenantId } });
    if (proTenantId) await db.tenantSubscription.deleteMany({ where: { tenant_id: proTenantId } });
    if (starterTenantId) await db.tenant.delete({ where: { id: starterTenantId } }).catch(() => {});
    if (proTenantId) await db.tenant.delete({ where: { id: proTenantId } }).catch(() => {});
    if (starterPlanId) await db.subscriptionPlan.delete({ where: { id: starterPlanId } }).catch(() => {});
    if (proPlanId) await db.subscriptionPlan.delete({ where: { id: proPlanId } }).catch(() => {});
    await db.$disconnect();
  }
});

// Kursi add-on harus menambah kuota user paket tanpa mengubah fitur.
test("addon_users menambah maxUsers di atas kuota paket", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  let tenantId, planId;
  try {
    const plan = await db.subscriptionPlan.create({
      data: {
        name: "Starter addon test",
        slug: `starter-addon-${tag}`,
        price_monthly: 0,
        max_users: 3,
        features_json: JSON.stringify(["dashboard", "kanban"]),
      },
    });
    planId = plan.id;
    const tenant = await db.tenant.create({
      data: {
        slug: `ad-${tag}`,
        name: "Addon Co",
        plan: "STARTER",
        status: "ACTIVE",
        max_users: 3,
        addon_users: 2,
      },
    });
    tenantId = tenant.id;
    await db.tenantSubscription.create({ data: { tenant_id: tenant.id, plan_id: plan.id, status: "ACTIVE" } });

    const entitlements = await getTenantEntitlements(tenant.id);
    assert.equal(entitlements.maxUsers, 5, "3 kursi paket + 2 kursi add-on = 5");
  } finally {
    if (tenantId) await db.tenantSubscription.deleteMany({ where: { tenant_id: tenantId } });
    if (tenantId) await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    if (planId) await db.subscriptionPlan.delete({ where: { id: planId } }).catch(() => {});
    await db.$disconnect();
  }
});

// Regresi audit paket Starter (2026-09-21): seluruh fitur Pro/Business harus
// terkunci di Starter, dan fitur Starter harus terbuka. Daftar fitur dibangun
// dari katalog supaya test ikut berubah saat katalog berubah.
test("Starter mengunci seluruh fitur Pro/Business dan membuka fitur Starter", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  let tenantId: string | undefined;
  let planId: string | undefined;
  try {
    const starterFeatures: string[] = [...SAAS_PLANS.starter.features];
    const allKeys: EntitlementKey[] = [
      "dashboard", "kanban", "pos", "reports",
      "qc", "storage", "audit_trail", "hrm", "inventory", "layout",
      "reports_finance", "whatsapp_unlimited", "purchase_orders", "api",
    ];
    const shouldBeOpen = allKeys.filter((k) => starterFeatures.includes(k));
    const shouldBeLocked = allKeys.filter((k) => !starterFeatures.includes(k));

    const plan = await db.subscriptionPlan.create({
      data: {
        name: "Starter regresi",
        slug: `starter-regress-${tag}`,
        price_monthly: 199000,
        max_users: 3,
        max_orders_per_month: 200,
        features_json: JSON.stringify(starterFeatures),
      },
    });
    planId = plan.id;
    const tenant = await db.tenant.create({
      data: { slug: `sr-${tag}`, name: "Starter Regresi", plan: "STARTER", status: "ACTIVE", max_users: 3 },
    });
    tenantId = tenant.id;
    await db.tenantSubscription.create({ data: { tenant_id: tenant.id, plan_id: plan.id, status: "ACTIVE" } });

    assert.ok(shouldBeLocked.length >= 8, "katalog Starter seharusnya mengunci banyak fitur Pro");

    for (const key of shouldBeOpen) {
      await assert.doesNotReject(requireEntitlement(tenant.id, key), `${key} harus terbuka di Starter`);
    }
    for (const key of shouldBeLocked) {
      await assert.rejects(requireEntitlement(tenant.id, key), /belum tersedia/, `${key} harus terkunci di Starter`);
    }
  } finally {
    if (tenantId) await db.tenantSubscription.deleteMany({ where: { tenant_id: tenantId } });
    if (tenantId) await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    if (planId) await db.subscriptionPlan.delete({ where: { id: planId } }).catch(() => {});
    await db.$disconnect();
  }
});
