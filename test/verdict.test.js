import test from "node:test";
import assert from "node:assert/strict";
import { decide, indiaFigures, genericFigures } from "../src/verdict.js";

test("a generic product is priced per 100 g and scaled to the pack size when one is given", () => {
  const kept = [
    { price: 650, seller: "SnaXup", grams: 500, per100: 130 },
    { price: 221, seller: "JioMart Grocery", grams: 200, per100: 110.5 },
    { price: 351, seller: "Flipkart", grams: null, per100: null },
  ];
  const open = genericFigures(kept, null);
  assert.equal(open.per100.low, 110.5);
  assert.equal(open.per100.lowSeller, "JioMart Grocery");
  assert.equal(open.now, null);
  const d = decide({ india: open, landed: 2611, warranty: { status: "unknown" } });
  assert.equal(d.verdict, "unknown");
  assert.match(d.label, /pack size/);
  const sized = genericFigures(kept, 500);
  assert.equal(sized.now, 552.5);
  assert.equal(decide({ india: sized, landed: 2611, warranty: { status: "unknown" } }).verdict, "not_worth");
});

test("cheaper, marginal, not worth and wait", () => {
  assert.equal(decide({ india: { now: 11500, low: 9000, typical: 11000 }, landed: 8833, warranty: { status: "na" } }).verdict, "cheaper");
  assert.equal(decide({ india: { now: 12999, low: 11999, typical: 12999 }, landed: 11330, warranty: { status: "lost" } }).verdict, "marginal");
  assert.equal(decide({ india: { now: 12999, low: null, typical: null }, landed: 12900, warranty: { status: "na" } }).verdict, "not_worth");
  assert.equal(decide({ india: { now: 14200, low: 9500, typical: 14000 }, landed: 13000, warranty: { status: "na" } }).verdict, "wait");
  assert.equal(decide({ india: { now: null }, landed: 5000, warranty: { status: "na" } }).verdict, "unknown");
});

test("a lost warranty turns a small win into marginal", () => {
  const r = decide({ india: { now: 13000, low: null, typical: null }, landed: 11000, warranty: { status: "lost" } });
  assert.equal(r.verdict, "marginal");
  assert.match(r.reason, /warranty is lost/);
});

test("indiaFigures anchors on a trusted store and shows the unknown cheaper shop separately", () => {
  const kept = [{ price: 12999, seller: "Flipkart" }, { price: 12690, seller: "Bestomart" }, { price: 27267, seller: "amazon.in" }, { price: 8490, seller: "Digital Arcade" }];
  const f = indiaFigures(kept, { source: "keepa", low: 9999, high: 16999, typical: 12500, note: "x" });
  assert.equal(f.now, 12999);
  assert.equal(f.nowSeller, "Flipkart");
  assert.equal(f.nowTrusted, true);
  assert.deepEqual(f.cheapestAny, { price: 8490, seller: "Digital Arcade" });
  assert.equal(f.low, 9999);
  assert.equal(f.historySource, "keepa");
  assert.equal(indiaFigures(kept, null).typical, (12999 + 27267) / 2);
  const g = indiaFigures([{ price: 5000, seller: "Some Shop" }], null);
  assert.equal(g.now, 5000);
  assert.equal(g.nowTrusted, false);
});
