import test from "node:test";
import assert from "node:assert/strict";
import { stockUsage, validateUsageIds } from "../src/lib/production-materials";

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
