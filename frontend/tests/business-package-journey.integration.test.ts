import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getTenantEntitlements, requireEntitlement, type EntitlementKey } from "../src/lib/entitlements";
import { createInvoiceForSubscription, activateTenantForPaidInvoice } from "../src/lib/billing";
import { getPricingConfig } from "../src/lib/pricing-config";
import { checkMonthlyOrderQuota } from "../src/lib/order-quota";
import { SAAS_PLANS } from "../src/lib/saas-catalog";

const ALL_KEYS: EntitlementKey[] = [
  "dashboard", "kanban", "pos", "reports", "qc", "storage", "audit_trail",
  "hrm", "inventory", "layout", "reports_finance", "whatsapp_unlimited",
  "purchase_orders", "api",
];

/** Kunci yang masih roadmap — belum ada implementasinya, jadi tidak dijual di paket self-serve. */
const ROADMAP_KEYS: EntitlementKey[] = ["api"];

/**
 * Perjalanan paket Business end-to-end (setara registrasi → invoice → bayar →
 * aktif) memakai baris `SubscriptionPlan` asli:
 *   - Business adalah paket self-serve tertinggi → SEMUA entitlement terbuka
 *   - kursi add-on menambah kapasitas di atas 10 user
 *   - invoice memakai harga baris paket + kursi add-on
 *   - pembayaran mengaktifkan tenant dan mengisi periode sesuai termin
 */
test("paket Business: semua fitur terbuka, invoice paket + add-on, aktivasi sesuai termin", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  let tenantId: string | undefined;
  let invoiceId: string | undefined;
  let createdPlanId: string | undefined;

  try {
    let plan = await db.subscriptionPlan.findUnique({ where: { slug: "business" } });
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Business",
          slug: "business",
          price_monthly: SAAS_PLANS.business.price_monthly,
          max_users: SAAS_PLANS.business.max_users,
          max_orders_per_month: SAAS_PLANS.business.max_orders_per_month,
          features_json: JSON.stringify(SAAS_PLANS.business.features),
        },
      });
      createdPlanId = plan.id;
    }

    // Business harus mencakup SELURUH kunci entitlement yang SUDAH ADA.
    // Kunci roadmap (mis. `api`) sengaja tidak diberikan sampai implementasinya jadi.
    const businessFeatures = new Set<string>(JSON.parse(plan.features_json ?? "[]"));
    const implemented = ALL_KEYS.filter((k) => !ROADMAP_KEYS.includes(k));
    const missing = implemented.filter((k) => !businessFeatures.has(k));
    assert.deepEqual(missing, [], `Business harus memuat semua entitlement, kurang: ${missing.join(", ")}`);
    for (const k of ROADMAP_KEYS) {
      assert.equal(businessFeatures.has(k), false, `${k} masih roadmap — jangan diberikan sebagai fitur aktif`);
    }

    // ── Registrasi (mimik registerTenant): 10 kursi bawaan + 2 kursi add-on ──
    const addonSeats = 2;
    const tenant = await db.tenant.create({
      data: {
        slug: `biz-${tag}`,
        name: "Business Journey Co",
        plan: "BUSINESS",
        status: "UNPAID",
        max_users: plan.max_users,
        addon_users: addonSeats,
      },
    });
    tenantId = tenant.id;
    const sub = await db.tenantSubscription.create({
      data: { tenant_id: tenant.id, plan_id: plan.id, status: "ACTIVE", term_months: 6, service_keys: [] },
    });

    // ── Entitlement: seluruh fitur terbuka, kapasitas = paket + add-on ──
    const ent = await getTenantEntitlements(tenant.id);
    assert.equal(ent.maxUsers, (plan.max_users ?? 0) + addonSeats);
    assert.equal(ent.maxOrdersPerMonth, null, "Business = order tanpa batas");
    for (const key of implemented) {
      await assert.doesNotReject(requireEntitlement(tenant.id, key), `${key} harus terbuka di Business`);
    }
    for (const key of ROADMAP_KEYS) {
      await assert.rejects(requireEntitlement(tenant.id, key), /belum tersedia/, `${key} belum tersedia (roadmap)`);
    }

    // ── Invoice: harga baris paket x termin + kursi add-on x harga pengaturan ──
    const pricing = await getPricingConfig();
    const res = await createInvoiceForSubscription({
      tenantId: tenant.id,
      subscriptionId: sub.id,
      dueInDays: pricing.paymentDueDays,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    invoiceId = res.invoice.id;

    const invoice = await db.invoice.findUniqueOrThrow({
      where: { id: res.invoice.id },
      include: { lines: { orderBy: { created_at: "asc" } } },
    });
    const expectedSubtotal =
      Number(plan.price_monthly) * 6 + addonSeats * pricing.seatPriceMonthly * 6;
    assert.equal(Number(invoice.subtotal), expectedSubtotal);
    assert.deepEqual(
      invoice.lines.map((l) => l.kind),
      ["PLAN", "ADDON_SEATS"],
      "Business tanpa layanan: hanya baris paket + kursi add-on",
    );
    assert.equal(Number(invoice.amount), expectedSubtotal);
    const dueDays = Math.round((invoice.due_date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    assert.equal(dueDays, pricing.paymentDueDays);

    // ── Order tanpa batas juga untuk jalur kuota ──
    assert.equal(await checkMonthlyOrderQuota(tenant.id), null);

    // ── Bayar → aktivasi + periode 6 bulan ──
    await db.$transaction((tx) => activateTenantForPaidInvoice(tx, tenant.id));
    const active = await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    assert.equal(active.status, "ACTIVE");
    const months = Math.round(
      (active.current_period_end!.getTime() - active.current_period_start!.getTime()) / (30 * 24 * 60 * 60 * 1000),
    );
    assert.equal(months, 6, "periode = termin 6 bulan");

    // ── Entitlement tetap utuh setelah aktif ──
    const after = await getTenantEntitlements(tenant.id);
    assert.equal(after.features.size, implemented.length);
    assert.ok(after.features.has("purchase_orders"), "purchase order tetap terbuka setelah aktif");
  } finally {
    if (invoiceId) await db.invoice.deleteMany({ where: { id: invoiceId } }).catch(() => {});
    if (tenantId) await db.tenantSubscription.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
    if (tenantId) await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    if (createdPlanId) await db.subscriptionPlan.delete({ where: { id: createdPlanId } }).catch(() => {});
    await db.$disconnect();
  }
});
