import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getTenantEntitlements, requireEntitlement, type EntitlementKey } from "../src/lib/entitlements";
import { createInvoiceForSubscription, activateTenantForPaidInvoice } from "../src/lib/billing";
import { getPricingConfig } from "../src/lib/pricing-config";
import { checkMonthlyOrderQuota } from "../src/lib/order-quota";
import { SAAS_PLANS } from "../src/lib/saas-catalog";

/**
 * Perjalanan paket Pro end-to-end (setara registrasi → invoice → bayar → aktif),
 * memakai baris `SubscriptionPlan` asli seperti di produksi:
 *   1. tenant dibuat dengan kuota dari baris paket (UNPAID)
 *   2. entitlement Pro terbuka, fitur Business tetap terkunci
 *   3. invoice pertama memakai harga baris paket
 *   4. pembayaran mengaktifkan tenant + mengisi periode sesuai termin
 *   5. kuota order tanpa batas
 */
test("paket Pro: registrasi → invoice → aktivasi → fitur → kuota", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  let tenantId: string | undefined;
  let subscriptionId: string | undefined;
  let invoiceId: string | undefined;
  let createdPlanId: string | undefined;

  try {
    // ── 0. Baris paket Pro (dibuat hanya bila belum ada; jangan dihapus kalau asli) ──
    let plan = await db.subscriptionPlan.findUnique({ where: { slug: "pro" } });
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Pro",
          slug: "pro",
          price_monthly: SAAS_PLANS.pro.price_monthly,
          max_users: SAAS_PLANS.pro.max_users,
          max_orders_per_month: SAAS_PLANS.pro.max_orders_per_month,
          features_json: JSON.stringify(SAAS_PLANS.pro.features),
        },
      });
      createdPlanId = plan.id;
    }

    // ── 1. Registrasi (mimik registerTenant untuk paket Pro) ──
    const tenant = await db.tenant.create({
      data: {
        slug: `pro-${tag}`,
        name: "Pro Journey Co",
        plan: "PRO",
        status: "UNPAID",
        max_users: plan.max_users,
        addon_users: 0,
      },
    });
    tenantId = tenant.id;
    const sub = await db.tenantSubscription.create({
      data: { tenant_id: tenant.id, plan_id: plan.id, status: "ACTIVE", term_months: 3, service_keys: [] },
    });
    subscriptionId = sub.id;

    // ── 2. Entitlement: fitur Pro terbuka, fitur Business terkunci ──
    const ent = await getTenantEntitlements(tenant.id);
    assert.equal(ent.maxUsers, plan.max_users, "kuota user mengikuti baris paket");
    assert.equal(ent.maxOrdersPerMonth, null, "Pro = order tanpa batas");

    const proKeys: EntitlementKey[] = [
      "dashboard", "kanban", "pos", "reports", "qc", "storage", "audit_trail",
      "hrm", "inventory", "layout", "reports_finance", "whatsapp_unlimited",
    ];
    for (const key of proKeys) {
      await assert.doesNotReject(requireEntitlement(tenant.id, key), `${key} harus terbuka di Pro`);
    }
    for (const key of ["purchase_orders", "api"] as EntitlementKey[]) {
      await assert.rejects(requireEntitlement(tenant.id, key), /belum tersedia/, `${key} hanya untuk Business`);
    }

    // ── 3. Invoice pertama: harga dari baris paket, termin 3 bulan ──
    const pricing = await getPricingConfig();
    const invoice = await createInvoiceForSubscription({
      tenantId: tenant.id,
      subscriptionId: sub.id,
      dueInDays: pricing.paymentDueDays,
    });
    assert.equal(invoice.ok, true);
    if (!invoice.ok) return;
    invoiceId = invoice.invoice.id;

    const stored = await db.invoice.findUniqueOrThrow({
      where: { id: invoice.invoice.id },
      include: { lines: true },
    });
    const expectedSubtotal = Number(plan.price_monthly) * 3;
    assert.equal(Number(stored.subtotal), expectedSubtotal, "3 bulan x harga baris paket");
    assert.equal(stored.lines.filter((l) => l.kind === "PLAN").length, 1);
    const dueDays = Math.round((stored.due_date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    assert.equal(dueDays, pricing.paymentDueDays);

    // ── 4. Kuota order: Pro tanpa batas ──
    assert.equal(await checkMonthlyOrderQuota(tenant.id), null);

    // ── 5. Pembayaran → aktivasi + periode sesuai termin ──
    await db.$transaction((tx) => activateTenantForPaidInvoice(tx, tenant.id));
    const active = await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    assert.equal(active.status, "ACTIVE");
    assert.ok(active.current_period_start && active.current_period_end, "periode langganan terisi");
    const months = Math.round(
      (active.current_period_end!.getTime() - active.current_period_start!.getTime()) / (30 * 24 * 60 * 60 * 1000),
    );
    assert.equal(months, 3, "periode = termin langganan");

    // ── 6. Entitlement tetap Pro setelah aktif ──
    const after = await getTenantEntitlements(tenant.id);
    assert.equal(after.maxUsers, plan.max_users);
    assert.ok(after.features.has("qc") && after.features.has("reports_finance"));
  } finally {
    if (invoiceId) await db.invoice.deleteMany({ where: { id: invoiceId } }).catch(() => {});
    if (tenantId) await db.tenantSubscription.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
    if (tenantId) await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    if (createdPlanId) await db.subscriptionPlan.delete({ where: { id: createdPlanId } }).catch(() => {});
    await db.$disconnect();
  }
});
