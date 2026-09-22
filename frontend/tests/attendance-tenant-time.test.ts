import test from "node:test";
import assert from "node:assert/strict";
import { tenantDateTime, tenantDayDate } from "../src/lib/attendance";

/**
 * Regresi bug `tenantDateTime`: komponen tanggal dulu diambil dari waktu SERVER
 * (getFullYear/getMonth/getDate), bukan zona waktu tenant. Akibatnya jam
 * check-out sintetis (job autoclose) bisa meleset satu hari, dan hasilnya
 * berbeda antara server dev (WIB) dan server produksi (UTC).
 *
 * Nilai harapan di bawah deterministik untuk implementasi yang benar, terlepas
 * dari zona waktu mesin yang menjalankan test.
 */

test("hari kanonik (attendance_day) menghasilkan jam pada hari tenant itu", () => {
  // attendance_day selalu tengah malam UTC dari tanggal tenant.
  const out = tenantDateTime(new Date("2026-09-14T00:00:00.000Z"), "17:00", "Asia/Jakarta");
  assert.equal(out?.toISOString(), "2026-09-14T10:00:00.000Z", "17:00 WIB = 10:00 UTC di tanggal yang sama");
});

test("timestamp yang jatuh di hari tenant berikutnya memakai hari tenant itu", () => {
  // 14 Sep 17:00Z = 15 Sep 00:00 WIB → hari tenant-nya 15 Sep.
  const out = tenantDateTime(new Date("2026-09-14T17:00:00.000Z"), "17:00", "Asia/Jakarta");
  assert.equal(out?.toISOString(), "2026-09-15T10:00:00.000Z", "bukan 14 Sep (bug lama di server UTC)");
});

test("zona waktu dengan offset negatif juga benar", () => {
  // 15 Sep 02:00Z = 14 Sep 22:00 di New York → hari tenant-nya 14 Sep.
  const out = tenantDateTime(new Date("2026-09-15T02:00:00.000Z"), "17:00", "America/New_York");
  assert.equal(out?.toISOString(), "2026-09-14T21:00:00.000Z", "17:00 EDT = 21:00 UTC");
});

test("hasil konsisten dengan hari tenant dari instant yang sama", () => {
  const stamp = new Date("2026-09-18T04:32:00.000Z");
  const day = tenantDayDate(stamp, "Asia/Jakarta");
  const fromDay = tenantDateTime(day, "17:00", "Asia/Jakarta");
  const fromStamp = tenantDateTime(stamp, "17:00", "Asia/Jakarta");
  assert.equal(fromDay?.toISOString(), fromStamp?.toISOString(), "kedua bentuk input memberi hari tenant yang sama");
});
