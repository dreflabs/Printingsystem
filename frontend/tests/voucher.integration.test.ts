import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { computeVoucherDiscount, normalizeVoucherCode, validateVoucher } from "../src/lib/voucher";

test("computeVoucherDiscount: persen, nominal, dan batas subtotal", () => {
  assert.equal(computeVoucherDiscount({ discount_type: "PERCENT", discount_value: 10 }, 1000000), 100000);
  assert.equal(computeVoucherDiscount({ discount_type: "FIXED", discount_value: 150000 }, 1000000), 150000);
  // Diskon tidak boleh melebihi subtotal.
  assert.equal(computeVoucherDiscount({ discount_type: "FIXED", discount_value: 2000000 }, 1000000), 1000000);
  // Nilai tidak valid → 0, bukan NaN.
  assert.equal(computeVoucherDiscount({ discount_type: "PERCENT", discount_value: 0 }, 1000000), 0);
  assert.equal(computeVoucherDiscount({ discount_type: "FIXED", discount_value: -5 }, 1000000), 0);
  assert.equal(computeVoucherDiscount({ discount_type: "PERCENT", discount_value: 10 }, 0), 0);
});

test("normalizeVoucherCode: trim dan uppercase", () => {
  assert.equal(normalizeVoucherCode("  promo2026 "), "PROMO2026");
});

test("validateVoucher menolak voucher nonaktif, kedaluwarsa, dan kuota habis", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const ids: string[] = [];
  try {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const inactive = await db.voucher.create({
      data: { code: `OFF-${tag}`, discount_type: "PERCENT", discount_value: 10, active: false },
    });
    const expired = await db.voucher.create({
      data: { code: `EXP-${tag}`, discount_type: "FIXED", discount_value: 50000, valid_until: past },
    });
    const maxed = await db.voucher.create({
      data: { code: `MAX-${tag}`, discount_type: "FIXED", discount_value: 50000, max_uses: 1, used_count: 1 },
    });
    const valid = await db.voucher.create({
      data: { code: `OK-${tag}`, discount_type: "PERCENT", discount_value: 25, valid_from: past, valid_until: future },
    });
    ids.push(inactive.id, expired.id, maxed.id, valid.id);

    assert.equal((await validateVoucher(`OFF-${tag}`, 1000000)).ok, false);
    assert.equal((await validateVoucher(`EXP-${tag}`, 1000000)).ok, false);
    assert.equal((await validateVoucher(`MAX-${tag}`, 1000000)).ok, false);

    const good = await validateVoucher(`ok-${tag.toLowerCase()}`, 1000000);
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.equal(good.discountAmount, 250000);
      assert.equal(good.voucher.code, `OK-${tag}`);
    }
  } finally {
    if (ids.length) await db.voucher.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    await db.$disconnect();
  }
});
