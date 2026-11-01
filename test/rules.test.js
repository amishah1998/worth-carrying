import test from "node:test";
import assert from "node:assert/strict";
import { landedCost, warrantyFor, INDIA } from "../src/rules.js";

const rate = 26.048;

test("a perfume at AED 350 in Dubai lands at the converted price, no duty", () => {
  const r = landedCost({ price: 350, rate });
  assert.equal(Math.round(r.shelfInr), 9117);
  assert.equal(r.dutyInr, 0);
  assert.equal(Math.round(r.landedInr), 9117);
  assert.match(r.dutyNote, /no duty/);
});

test("duty is 35 percent on the part of the trip total above 75,000", () => {
  const r = landedCost({ price: 1600, rate, tripTotalInr: 40000 });
  assert.equal(INDIA.allowanceInr, 75000);
  const excess = r.shelfInr + 40000 - 75000;
  assert.equal(Math.round(r.dutyInr), Math.round(excess * 0.35));
  assert.ok(r.dutyInr > 0);
  assert.match(r.dutyNote, /above the 75,000/);
});

test("warranty flags follow the brand", () => {
  assert.equal(warrantyFor("JBL Flip 7").status, "lost");
  assert.equal(warrantyFor("Samsung Galaxy S26").status, "lost");
  assert.equal(warrantyFor("Apple Watch Series 11").status, "at_risk");
  assert.equal(warrantyFor("American Tourister Curio 79cm").status, "kept");
  assert.equal(warrantyFor("Dior Sauvage EDP 100ml").status, "na");
});
