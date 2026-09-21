import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  getPaymentSettings,
  savePaymentSettings,
  getActiveBankAccounts,
  DEFAULT_PAYMENT_SETTINGS,
  isGatewayConfigured,
  canEnableGateway,
  GATEWAY_INTEGRATION_PENDING,
} from "../src/lib/payment-settings";

test("pengaturan pembayaran: simpan dan baca ulang, lalu pulihkan", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const before = await db.platformSetting.findUnique({ where: { key: "payment.methods" } });
  try {
    const original = await getPaymentSettings();
    assert.equal(typeof original.manualEnabled, "boolean");

    const saved = await savePaymentSettings({
      gatewayEnabled: true,
      manualEnabled: false,
      gatewayProvider: "midtrans",
      manualInstructions: "Uji instruksi pembayaran.",
    });
    assert.equal(saved.gatewayEnabled, true);
    assert.equal(saved.manualEnabled, false);

    const read = await getPaymentSettings();
    assert.equal(read.gatewayEnabled, true);
    assert.equal(read.manualEnabled, false);
    assert.equal(read.gatewayProvider, "midtrans");
    assert.equal(read.manualInstructions, "Uji instruksi pembayaran.");
  } finally {
    if (before) {
      await db.platformSetting.update({ where: { key: "payment.methods" }, data: { value_json: before.value_json } });
    } else {
      await db.platformSetting.deleteMany({ where: { key: "payment.methods" } });
    }
    await db.$disconnect();
  }
});

test("getActiveBankAccounts hanya mengembalikan rekening aktif dengan field camelCase", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const ids: string[] = [];
  try {
    const active = await db.bankAccount.create({
      data: { bank_name: "BCA Uji", account_number: "1234567890", account_holder: "PT Uji", active: true },
    });
    const inactive = await db.bankAccount.create({
      data: { bank_name: "Mandiri Uji", account_number: "999", account_holder: "PT Uji", active: false },
    });
    ids.push(active.id, inactive.id);

    const rows = await getActiveBankAccounts();
    const mine = rows.find((r) => r.id === active.id);
    assert.ok(mine, "rekening aktif harus muncul");
    assert.equal(mine.bankName, "BCA Uji");
    assert.equal(mine.accountNumber, "1234567890");
    assert.equal(mine.accountHolder, "PT Uji");
    assert.equal(rows.some((r) => r.id === inactive.id), false, "rekening nonaktif tidak boleh muncul");
  } finally {
    if (ids.length) await db.bankAccount.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    await db.$disconnect();
  }
});

test("default settings tetap aman saat belum ada konfigurasi", () => {
  assert.equal(DEFAULT_PAYMENT_SETTINGS.manualEnabled, true);
  assert.equal(DEFAULT_PAYMENT_SETTINGS.gatewayEnabled, false);
  assert.equal(isGatewayConfigured("tidak-ada"), false);
  // Gateway dipending: tidak boleh dinyalakan walau kredensial ada.
  if (GATEWAY_INTEGRATION_PENDING) {
    assert.equal(isGatewayConfigured("midtrans"), false);
    assert.equal(canEnableGateway("midtrans"), false);
  }
});
