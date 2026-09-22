import test from "node:test";
import assert from "node:assert/strict";
import { alertSyncPlan, stockAlertLevel, visibleAlertTypesForRoles } from "../src/lib/operational-alerts";
import { anyRoleCan, roleCan } from "../src/lib/permissions";

/**
 * Regresi: alert CRITICAL permanen dari material ber-`min_stock = 0` adalah
 * sumbatan noise yang membuat badge lonceng selalu merah. Material tanpa
 * minimum bukan alert.
 */

test("stok habis tetap alert walau minimum belum diatur", () => {
  assert.equal(stockAlertLevel(0, 0), "DEPLETED", "habis adalah fakta operasional, bukan tugas data");
  assert.equal(stockAlertLevel(-2, 0), "DEPLETED");
});

test("stok masih ada tanpa minimum bukan alert", () => {
  assert.equal(stockAlertLevel(12, 0), null);
  assert.equal(stockAlertLevel(1, 0), null);
});

test("stok menipis hanya saat minimum diatur dan stok menyentuh batas", () => {
  assert.equal(stockAlertLevel(5, 5), "LOW", "menyentuh batas tetap alert");
  assert.equal(stockAlertLevel(4, 5), "LOW");
  assert.equal(stockAlertLevel(6, 5), null);
});

test("habis lebih mendesak dari menipis saat keduanya berlaku", () => {
  assert.equal(stockAlertLevel(0, 5), "DEPLETED");
  assert.equal(stockAlertLevel(-1, 5), "DEPLETED");
});

test("gudang hanya melihat alert yang bisa ditindaklanjuti di halamannya", () => {
  const types = visibleAlertTypesForRoles(["gudang"]);
  assert.equal(types.has("LOW_STOCK"), true);
  assert.equal(types.has("STORAGE_INCIDENT"), true);
  assert.equal(types.has("DEADLINE_24H"), false, "tautan /admin/production bukan milik gudang");
  assert.equal(types.has("STALE_JOB"), false);
});

test("owner dan admin melihat semua jenis alert", () => {
  for (const role of ["owner", "admin"]) {
    const types = visibleAlertTypesForRoles([role]);
    assert.deepEqual([...types].sort(), ["DEADLINE_24H", "LOW_STOCK", "STALE_JOB", "STORAGE_INCIDENT"], role);
  }
});

test("peran tanpa akses alert tidak melihat jenis apa pun", () => {
  assert.equal(visibleAlertTypesForRoles(["designer_sales"]).size, 0);
  assert.equal(visibleAlertTypesForRoles(["operator"]).size, 0);
  assert.equal(visibleAlertTypesForRoles(["role_tidak_dikenal"]).size, 0);
});

test("gabungan peran menyatukan jenis alert", () => {
  const types = visibleAlertTypesForRoles(["gudang", "admin"]);
  assert.equal(types.size, 4);
});

test("alert yang selesai dibuka ulang saat kondisinya muncul lagi", () => {
  const plan = alertSyncPlan({ status: "RESOLVED", severity: "WARNING" }, "WARNING");
  assert.equal(plan.reopen, true);
  assert.equal(plan.resetFirstSeen, true, "waktu pertama terlihat dihitung ulang");
});

test("alert yang diakui dibuka ulang saat tingkat keparahan naik", () => {
  const plan = alertSyncPlan({ status: "ACKNOWLEDGED", severity: "WARNING" }, "CRITICAL");
  assert.equal(plan.reopen, true, "menipis → habis harus terdengar lagi");
  assert.equal(plan.escalated, true);
  assert.equal(plan.resetFirstSeen, false);
});

test("ack tetap berlaku bila keparahan sama atau turun", () => {
  assert.equal(alertSyncPlan({ status: "ACKNOWLEDGED", severity: "CRITICAL" }, "CRITICAL").reopen, false);
  assert.equal(alertSyncPlan({ status: "ACKNOWLEDGED", severity: "CRITICAL" }, "WARNING").reopen, false);
  assert.equal(alertSyncPlan({ status: "OPEN", severity: "WARNING" }, "CRITICAL").reopen, false);
  assert.equal(alertSyncPlan(undefined, "CRITICAL").reopen, false, "alert baru tidak perlu dibuka ulang");
});

test("hak lonceng mengikuti ROLE_PERMISSIONS", () => {
  assert.equal(anyRoleCan(["owner"], "operations.alerts.view"), true);
  assert.equal(anyRoleCan(["owner"], "operations.alerts.acknowledge"), true);
  assert.equal(anyRoleCan(["gudang"], "operations.alerts.view"), true);
  assert.equal(anyRoleCan(["gudang"], "operations.alerts.acknowledge"), false, "gudang hanya melihat");
  assert.equal(anyRoleCan(["designer_sales"], "operations.alerts.view"), false);
  assert.equal(anyRoleCan(["operator"], "operations.alerts.view"), false);
  assert.equal(roleCan("gudang", "operations.alerts.view"), true);
  assert.equal(roleCan("gudang", "operations.alerts.acknowledge"), false);
});
