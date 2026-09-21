import test from "node:test";
import assert from "node:assert/strict";
import { computeOrderEstimate, DEFAULT_PRICING_CONFIG } from "../src/lib/saas-catalog";
import { normalizePricingConfig, pricingConfigWarnings } from "../src/lib/pricing-config";

test("normalizePricingConfig mengembalikan default saat input kosong", () => {
  const cfg = normalizePricingConfig(null);
  assert.equal(cfg.seatPriceMonthly, DEFAULT_PRICING_CONFIG.seatPriceMonthly);
  assert.equal(cfg.maxSeats, DEFAULT_PRICING_CONFIG.maxSeats);
  assert.equal(cfg.paymentDueDays, DEFAULT_PRICING_CONFIG.paymentDueDays);
  assert.deepEqual(cfg.terms, DEFAULT_PRICING_CONFIG.terms);
  assert.equal(cfg.servicePromoActive, true);
});

test("normalizePricingConfig membatasi nilai tidak masuk akal", () => {
  const cfg = normalizePricingConfig({
    seatPriceMonthly: -500,
    maxSeats: 0,
    paymentDueDays: 999,
    terms: [{ months: 12, paidMonths: 99 }],
    services: [{ key: "training_online", listPrice: -1, promoFree: false }],
  });
  assert.equal(cfg.seatPriceMonthly, 0);
  assert.equal(cfg.maxSeats, 1);
  assert.equal(cfg.paymentDueDays, 90);
  assert.equal(cfg.terms.find((t) => t.months === 12)?.paidMonths, 12, "tidak boleh melebihi durasi");
  assert.equal(cfg.services.find((s) => s.key === "training_online")?.listPrice, 0);
  assert.equal(cfg.services.find((s) => s.key === "training_online")?.promoFree, false);
});

test("computeOrderEstimate memakai harga dari pengaturan, bukan konstanta", () => {
  const pricing = normalizePricingConfig({
    seatPriceMonthly: 100000,
    maxSeats: 3,
    paymentDueDays: 5,
    terms: [{ months: 12, paidMonths: 10 }],
    services: [{ key: "training_online", listPrice: 2000000, promoFree: true }],
    servicePromoActive: false,
  });

  // 12 bulan: paket 199.000 x 10 = 1.990.000; 2 kursi x 100.000 x 10 = 2.000.000.
  const est = computeOrderEstimate({
    plan: "starter",
    months: 12,
    addonSeats: 2,
    services: ["training_online"],
    pricing,
  });
  assert.equal(est.paidMonths, 10);
  assert.equal(est.addonSeats, 2);
  assert.equal(est.planSubtotal, 1_990_000);
  assert.equal(est.addonSubtotal, 2_000_000);
  // Promo dimatikan → layanan ditagih sesuai harga list dari pengaturan.
  assert.equal(est.serviceSubtotal, 2_000_000);
  assert.equal(est.total, 5_990_000);

  // Batas kursi dari pengaturan (3) berlaku.
  assert.equal(computeOrderEstimate({ plan: "starter", addonSeats: 99, pricing }).addonSeats, 3);
});

test("computeOrderEstimate memakai harga paket dari DB bila diberikan", () => {
  const est = computeOrderEstimate({ plan: "pro", months: 1, planPriceMonthly: 450000 });
  assert.equal(est.planSubtotal, 450000, "harga baris SubscriptionPlan menang atas katalog");
});

test("pricingConfigWarnings menandai harga kursi yang mengkanibalisasi upgrade", () => {
  const cheap = normalizePricingConfig({ seatPriceMonthly: 50000 });
  assert.ok(pricingConfigWarnings(cheap).length > 0);

  const safe = normalizePricingConfig({ seatPriceMonthly: 80000 });
  assert.equal(pricingConfigWarnings(safe).length, 0);
});
