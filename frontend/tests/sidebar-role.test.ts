import test from "node:test";
import assert from "node:assert/strict";
import { resolveActiveRole } from "../src/lib/nav-config";

/**
 * Regresi: "Mode Aktif" tidak boleh mengikuti URL begitu saja.
 *
 * Owner boleh membuka /admin, /designer, /operator, /finishing (takeover
 * manajemen), tapi kalau akun tidak memegang peran itu sidebar harus tetap
 * memakai peran utama — bukan menyamar sebagai peran tersebut.
 */

test("owner tanpa peran admin yang membuka /admin tetap dianggap owner", () => {
  assert.equal(resolveActiveRole("/admin", ["owner"], "owner"), "owner");
  assert.equal(resolveActiveRole("/admin/orders", ["owner"], "owner"), "owner");
});

test("owner yang memang memegang peran admin tetap melihat mode admin", () => {
  assert.equal(resolveActiveRole("/admin", ["owner", "admin"], "owner"), "admin");
});

test("peran tunggal mengikuti dashboard-nya sendiri", () => {
  assert.equal(resolveActiveRole("/designer", ["designer_sales"], "designer_sales"), "designer_sales");
  assert.equal(resolveActiveRole("/operator/antrean", ["operator"], "operator"), "operator");
  assert.equal(resolveActiveRole("/finishing", ["gudang"], "gudang"), "gudang");
});

test("path di luar dashboard peran memakai peran utama", () => {
  assert.equal(resolveActiveRole("/beranda", ["owner"], "owner"), "owner");
  assert.equal(resolveActiveRole("/pos", ["admin"], "admin"), "admin");
  assert.equal(resolveActiveRole("/scan", ["operator"], "operator"), "operator");
});

test("kecocokan path memakai batas segmen, bukan awalan mentah", () => {
  assert.equal(resolveActiveRole("/administrasi", ["owner"], "owner"), "owner");
  assert.equal(resolveActiveRole("/owner-area", ["owner"], "owner"), "owner");
  assert.equal(resolveActiveRole("/finishing", ["owner"], "owner"), "owner", "owner tanpa peran gudang");
});
