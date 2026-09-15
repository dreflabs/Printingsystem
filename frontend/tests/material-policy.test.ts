import test from "node:test";
import assert from "node:assert/strict";
import { stockUsage, validateUsageIds } from "../src/lib/production-materials";
import { calculatePrintingUnitPrice, validateMaterialConversionFactor, validateMaterialUnitPair } from "../src/lib/catalog-constants";
import { resolveOutputUnit } from "../src/lib/output-units";
import { movementCostAmount, weightedAverageCost } from "../src/lib/material-costing";

test("printing prices use the selected product unit", () => {
  assert.equal(calculatePrintingUnitPrice("M2", 15000, 200, 300), 90000);
  assert.equal(calculatePrintingUnitPrice("METER", 8000), 8000);
  assert.equal(calculatePrintingUnitPrice("LEMBAR", 2000), 2000);
  assert.equal(calculatePrintingUnitPrice("RIM", 650000), 650000);
  assert.throws(() => calculatePrintingUnitPrice("M2", 15000, 0, 300));
});

test("material unit pairs reject incompatible units and require custom names", () => {
  assert.deepEqual(validateMaterialUnitPair("ROLL", "METER"), { stock: "ROLL", usage: "METER", custom: null });
  assert.deepEqual(validateMaterialUnitPair("RIM", "LEMBAR"), { stock: "RIM", usage: "LEMBAR", custom: null });
  assert.throws(() => validateMaterialUnitPair("ROLL", "GRAM"), /tidak didukung/);
  assert.throws(() => validateMaterialUnitPair("PAKET", "PAKET"), /custom/);
  assert.deepEqual(validateMaterialUnitPair("PAKET", "PAKET", "PAKET"), { stock: "PAKET", usage: "PAKET", custom: "PAKET" });
});

test("same material units require an explicit one-to-one conversion", () => {
  assert.equal(validateMaterialConversionFactor("ROLL", "METER", 50), 50);
  assert.equal(validateMaterialConversionFactor("PCS", "PCS", 1), 1);
  assert.throws(() => validateMaterialConversionFactor("PCS", "PCS", 2), /faktor konversi harus 1/);
  assert.throws(() => validateMaterialConversionFactor("ROLL", "METER", 0), /lebih dari 0/);
});

test("job output unit is derived from its product units", () => {
  assert.equal(resolveOutputUnit(["M2", "M2"]), "M2");
  assert.equal(resolveOutputUnit(["METER", null]), "METER");
  assert.equal(resolveOutputUnit(["PCS", "LEMBAR"]), "MIXED");
  assert.equal(resolveOutputUnit([]), "PCS");
});

test("material HPP uses weighted average and movement cost snapshots", () => {
  assert.equal(weightedAverageCost(100, 10, 50, 16), 12);
  assert.equal(weightedAverageCost(100, 10, 50, null), 10);
  assert.equal(movementCostAmount(-0.125, 20000), 2500);
  assert.equal(movementCostAmount(-1, null), null);
});

test("roll-meter conversion preserves usage and waste with six decimals", () => {
  const q = stockUsage(5, 1, 50);
  assert.equal(q.used.toString(), "0.1");
  assert.equal(q.wasted.toString(), "0.02");
  assert.equal(q.total.toString(), "0.12");
  assert.equal(stockUsage(1, 0, 500).used.toString(), "0.002");
});
test("invalid quantities cannot increase stock or bypass precision", () => {
  for (const [usage, waste, factor] of [[5,-1,50], [Infinity,0,1], [1,0,0], [NaN,0,1], [1,Infinity,1], [0.00000001,0,1]]) assert.throws(() => stockUsage(usage,waste,factor));
});
test("finish requires every primary material, no duplicate or cross-job material", () => {
  assert.doesNotThrow(() => validateUsageIds(["flexi", "paper"], ["ink"], ["flexi", "paper", "ink"]));
  assert.throws(() => validateUsageIds(["flexi", "paper"], ["ink"], ["flexi", "ink"]));
  assert.throws(() => validateUsageIds(["flexi"], [], ["vinyl"]));
  assert.throws(() => validateUsageIds(["flexi"], [], ["flexi", "flexi"]));
  assert.throws(() => validateUsageIds([], [], ["anything"]));
});
