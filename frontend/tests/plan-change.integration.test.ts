import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { changePlanCore } from "../src/lib/plan-change";
import { getTenantEntitlements } from "../src/lib/entitlements";
import { SAAS_PLANS } from "../src/lib/saas-catalog";

/**
 * Jalur ganti paket self-serve (`changePlanCore`):
 *   - upgrade Starter → Pro memakai kuota dari BARIS PAKET (bukan katalog)
 *   - kursi add-on dipertahankan
 *   - downgrade ditolak bila pegawai aktif melebihi kapasitas paket tujuan
 *   - tepat di batas kapasitas → diizinkan
 */
test("ganti paket: upgrade pakai kuota baris paket, downgrade dibatasi pegawai aktif", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  const created: { tenantId?: string; planIds: string[] } = { planIds: [] };

  const ensurePlan = async (key: "starter" | "pro" | "business") => {
    const def = SAAS_PLANS[key];
    const found = await db.subscriptionPlan.findUnique({ where: { slug: def.slug } });
    if (found) return found;
    const made = await db.subscriptionPlan.create({
      data: {
        name: def.name,
        slug: def.slug,
        price_monthly: def.price_monthly,
        max_users: def.max_users,
        max_orders_per_month: def.max_orders_per_month,
        features_json: JSON.stringify(def.features),
      },
    });
    created.planIds.push(made.id);
    return made;
  };

  try {
    const starter = await ensurePlan("starter");
    const pro = await ensurePlan("pro");

    // Role global untuk pegawai (dibuat bila belum ada).
    const role = await db.role.upsert({ where: { name: "operator" }, update: {}, create: { name: "operator" } });

    const tenant = await db.tenant.create({
      data: {
        slug: `pc-${tag}`,
        name: "Plan Change Co",
        plan: "STARTER",
        status: "ACTIVE",
        max_users: starter.max_users,
        addon_users: 1,
      },
    });
    created.tenantId = tenant.id;
    const sub = await db.tenantSubscription.create({
      data: { tenant_id: tenant.id, plan_id: starter.id, status: "ACTIVE", term_months: 1 },
    });

    const owner = await db.user.create({
      data: {
        tenant_id: tenant.id,
        name: "Owner Uji",
        username: `owner-${tag}`,
        email: `owner-${tag}@contoh.test`,
        password_hash: "x",
        role_id: role.id,
        active: true,
      },
    });
    for (let i = 0; i < 4; i += 1) {
      await db.user.create({
        data: {
          tenant_id: tenant.id,
          name: `Staff ${i + 1}`,
          username: `staff${i}-${tag}`,
          email: `staff${i}-${tag}@contoh.test`,
          password_hash: "x",
          role_id: role.id,
          active: true,
        },
      });
    }

    // ── Upgrade ke Pro: kuota dari baris paket, add-on tetap ──
    const up = await changePlanCore({
      tenantId: tenant.id,
      targetPlan: "PRO",
      maxUsers: pro.max_users ?? null,
      actor: { type: "platform" },
    });
    assert.equal(up.success, true);
    const afterUp = await getTenantEntitlements(tenant.id);
    assert.equal(afterUp.maxUsers, (pro.max_users ?? 0) + 1, "kuota baris paket + add-on");
    assert.ok(afterUp.features.has("qc") && afterUp.features.has("layout"), "fitur Pro terbuka");
    assert.equal(afterUp.features.has("purchase_orders"), false, "Business tetap terkunci");

    // ── Lanjut naik ke Business: purchase order terbuka, kapasitas 10 + add-on ──
    const business = await ensurePlan("business");
    const upTop = await changePlanCore({
      tenantId: tenant.id,
      targetPlan: "BUSINESS",
      maxUsers: business.max_users ?? null,
      actor: { type: "platform" },
    });
    assert.equal(upTop.success, true);
    const afterTop = await getTenantEntitlements(tenant.id);
    assert.equal(afterTop.maxUsers, (business.max_users ?? 0) + 1);
    assert.ok(afterTop.features.has("purchase_orders"), "purchase order terbuka di Business");

    // ── Downgrade ke Starter: 5 pegawai aktif > kapasitas 3 + 1 add-on → ditolak ──
    const downBlocked = await changePlanCore({
      tenantId: tenant.id,
      targetPlan: "STARTER",
      maxUsers: starter.max_users ?? null,
      actor: { type: "owner", userId: owner.id },
    });
    assert.equal(downBlocked.success, false, "downgrade harus ditolak saat pegawai melebihi kapasitas");

    // ── Nonaktifkan satu pegawai → 4 aktif = kapasitas 4 → diizinkan ──
    await db.user.updateMany({ where: { tenant_id: tenant.id, username: `staff0-${tag}` }, data: { active: false } });
    const downOk = await changePlanCore({
      tenantId: tenant.id,
      targetPlan: "STARTER",
      maxUsers: starter.max_users ?? null,
      actor: { type: "owner", userId: owner.id },
    });
    assert.equal(downOk.success, true);
    const afterDown = await getTenantEntitlements(tenant.id);
    assert.equal(afterDown.maxUsers, (starter.max_users ?? 0) + 1);
    assert.equal(afterDown.features.has("qc"), false, "fitur Pro tertutup lagi");

    // Subscription aktif mengikuti paket terakhir.
    const activeSub = await db.tenantSubscription.findFirstOrThrow({
      where: { tenant_id: tenant.id, status: "ACTIVE" },
      select: { plan: { select: { slug: true } } },
    });
    assert.equal(activeSub.plan.slug, "starter");
    assert.ok(sub.id);
  } finally {
    if (created.tenantId) {
      await db.auditLog.deleteMany({ where: { tenant_id: created.tenantId } }).catch(() => {});
      await db.tenantAuditLog.deleteMany({ where: { tenant_id: created.tenantId } }).catch(() => {});
      await db.user.deleteMany({ where: { tenant_id: created.tenantId } }).catch(() => {});
      await db.tenantSubscription.deleteMany({ where: { tenant_id: created.tenantId } }).catch(() => {});
      await db.tenant.delete({ where: { id: created.tenantId } }).catch(() => {});
    }
    for (const id of created.planIds) await db.subscriptionPlan.delete({ where: { id } }).catch(() => {});
    await db.$disconnect();
  }
});
