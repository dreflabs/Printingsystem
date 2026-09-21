import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createInvoiceForSubscription, activateTenantForPaidInvoice, resolvePeriod } from "../src/lib/billing";

// Alur tanpa free trial: registrasi → invoice pertama (jatuh tempo 3 hari) →
// bayar → tenant UNPAID diaktifkan.
test("invoice pertama memuat baris paket + layanan, memakai voucher sekali, lalu aktivasi", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  const ids: { plan?: string; tenant?: string; sub?: string; voucher?: string; invoice?: string } = {};
  try {
    // Pakai slug katalog "starter" supaya jalur computeOrderEstimate (baris
    // paket + kursi add-on + layanan) benar-benar teruji. Baris paket mungkin
    // sudah ada dari seed — jangan dihapus kalau bukan milik test ini.
    let plan = await db.subscriptionPlan.findUnique({ where: { slug: "starter" } });
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Starter",
          slug: "starter",
          price_monthly: 199000,
          max_users: 3,
          features_json: JSON.stringify(["dashboard"]),
        },
      });
      ids.plan = plan.id;
    }

    const tenant = await db.tenant.create({
      data: { slug: `inv-${tag}`, name: "Invoice Co", plan: "STARTER", status: "UNPAID", max_users: 3, addon_users: 2 },
    });
    ids.tenant = tenant.id;

    const voucher = await db.voucher.create({
      data: { code: `INV-${tag.slice(0, 8).toUpperCase()}`, discount_type: "PERCENT", discount_value: 10, max_uses: 5 },
    });
    ids.voucher = voucher.id;

    const sub = await db.tenantSubscription.create({
      data: {
        tenant_id: tenant.id,
        plan_id: plan.id,
        status: "ACTIVE",
        term_months: 3,
        service_keys: ["training_online"],
        voucher_code: voucher.code,
      },
    });
    ids.sub = sub.id;

    const res = await createInvoiceForSubscription({ tenantId: tenant.id, subscriptionId: sub.id, dueInDays: 3 });
    assert.equal(res.ok, true);
    if (!res.ok) return;

    const { yyyymm } = resolvePeriod();
    assert.equal(res.invoice.number.startsWith(`INV-${yyyymm}-`), true);

    // Paket 3 bulan = 597.000; kursi add-on 2 × 80.000 × 3 = 480.000;
    // layanan training online gratis (promo). Subtotal 1.077.000, diskon 10%.
    const invoice = await db.invoice.findUniqueOrThrow({
      where: { id: res.invoice.id },
      include: { lines: { orderBy: { created_at: "asc" } } },
    });
    ids.invoice = invoice.id;
    assert.equal(Number(invoice.subtotal), 1_077_000);
    assert.equal(Number(invoice.discount), 107_700);
    assert.equal(Number(invoice.amount), 969_300);
    assert.equal(invoice.status, "PENDING");
    assert.equal(invoice.voucher_code, voucher.code);

    const kinds = invoice.lines.map((l) => l.kind);
    assert.deepEqual(kinds, ["PLAN", "ADDON_SEATS", "SERVICE", "DISCOUNT"]);
    const serviceLine = invoice.lines.find((l) => l.kind === "SERVICE");
    assert.equal(Number(serviceLine?.amount), 0, "layanan promo gratis");

    // Jatuh tempo ≈ 3 hari dari sekarang.
    const days = Math.round((invoice.due_date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    assert.equal(days, 3);

    // Voucher sekali pakai: terpakai + dikosongkan dari langganan.
    const afterVoucher = await db.voucher.findUniqueOrThrow({ where: { id: voucher.id } });
    assert.equal(afterVoucher.used_count, 1);
    const afterSub = await db.tenantSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    assert.equal(afterSub.voucher_code, null);

    // Invoice kedua tidak boleh dobel untuk periode yang sama.
    const second = await createInvoiceForSubscription({ tenantId: tenant.id, subscriptionId: sub.id });
    assert.equal(second.ok, false);

    // Bayar → tenant UNPAID diaktifkan, periode diisi sesuai termin (3 bulan).
    await db.$transaction((tx) => activateTenantForPaidInvoice(tx, tenant.id));
    const afterTenant = await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    assert.equal(afterTenant.status, "ACTIVE");
    assert.ok(afterTenant.current_period_end, "current_period_end terisi");
    assert.equal(afterTenant.trial_ends_at, null);
  } finally {
    if (ids.invoice) await db.invoice.deleteMany({ where: { id: ids.invoice } }).catch(() => {});
    if (ids.sub) await db.tenantSubscription.deleteMany({ where: { tenant_id: ids.tenant } }).catch(() => {});
    if (ids.tenant) await db.tenant.delete({ where: { id: ids.tenant } }).catch(() => {});
    if (ids.voucher) await db.voucher.delete({ where: { id: ids.voucher } }).catch(() => {});
    if (ids.plan) await db.subscriptionPlan.delete({ where: { id: ids.plan } }).catch(() => {});
    await db.$disconnect();
  }
});
