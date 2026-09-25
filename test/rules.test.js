import test from "node:test";
import assert from "node:assert/strict";
import { landedCost, warrantyFor, INDIA } from "../src/rules.js";

const rate = 26.048;

test("a perfume at AED 350 in Dubai lands at about 8,833 rupees after the VAT refund, no duty", () => {
  const r = landedCost({ price: 350, currency: "AED", country: "AE", rate });
  assert.equal(Math.round(r.shelfInr), 9117);
  assert.equal(Math.round(r.refundInr), 284);
  assert.equal(Math.round(r.netInr), 8833);
  assert.equal(r.dutyInr, 0);
  assert.equal(Math.round(r.landedInr), 8833);
});

test("no refund under the AED 250 minimum, in a country without a scheme, or when the price is not in the local currency", () => {
  assert.equal(landedCost({ price: 200, currency: "AED", country: "AE", rate }).refundInr, 0);
  assert.equal(landedCost({ price: 350, currency: "AED", country: "", rate }).refundInr, 0);
  const r = landedCost({ price: 900, currency: "USD", country: "ID", rate: 95.7 });
  assert.equal(r.refundInr, 0);
  assert.match(r.refundNote, /IDR/);
});

test("duty is 35 percent on the part of the trip total above 75,000", () => {
  const r = landedCost({ price: 1600, currency: "AED", country: "AE", rate, tripTotalInr: 40000 });
  assert.equal(INDIA.allowanceInr, 75000);
  const excess = r.netInr + 40000 - 75000;
  assert.equal(Math.round(r.dutyInr), Math.round(excess * 0.35));
  assert.ok(r.dutyInr > 0);
});

test("warranty flags follow the brand", () => {
  assert.equal(warrantyFor("JBL Flip 7").status, "lost");
  assert.equal(warrantyFor("Samsung Galaxy S26").status, "lost");
  assert.equal(warrantyFor("Apple Watch Series 11").status, "at_risk");
  assert.equal(warrantyFor("American Tourister Curio 79cm").status, "kept");
  assert.equal(warrantyFor("Dior Sauvage EDP 100ml").status, "na");
});
