import test from "node:test";
import assert from "node:assert/strict";
import { parseShoppingText } from "../src/providers/chrome.js";
import { asinFrom } from "../src/providers/serper.js";
import { extractRate } from "../src/fx.js";
import { parsePrice } from "../src/util.js";

// Shaped like the visible text of a Google Shopping India page, one listing per run of lines.
const PAGE = `Price
Under ₹20,000
₹20,000 - ₹40,000
Also nearby
JBL Flip 7 35W Portable Bluetooth Speaker
₹12,999
JBL India
& more
JBL Flip 7
₹12,999
24% off₹16,999
Flipkart
4.7(7.1K)
JBL Flip 7 Wireless Portable Bluetooth Speaker,Bold Pro Sound with AI Sound Boost
₹12,999
Amazon.in
& more
LOW PRICE
American Tourister Curio Spinner 67 cm Turquoise Check-in Suitcase 4 Wheels
₹3,999
Usually ₹4,239
Amazon.in`;

test("parseShoppingText turns the page text into listings with seller and struck price", () => {
  const rows = parseShoppingText(PAGE, [{ t: "American Tourister Curio Spinner 67 cm Turquoise Check-in Suitcase 4 Wheels", h: "https://www.amazon.in/dp/B0CXYZ12345" }]);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { title: "JBL Flip 7 35W Portable Bluetooth Speaker", price: 12999, mrp: null, seller: "JBL India", url: null, asin: null, rating: null, source: "chrome" });
  assert.equal(rows[1].seller, "Flipkart");
  assert.equal(rows[1].mrp, 16999);
  assert.equal(rows[2].seller, "Amazon.in");
  assert.equal(rows[3].mrp, 4239);
  assert.equal(rows[3].asin, "B0CXYZ1234");
  assert.equal(rows[3].url, "https://www.amazon.in/dp/B0CXYZ12345");
});

test("price parsing handles Indian grouping and decimals", () => {
  assert.equal(parsePrice("₹1,00,584"), 100584);
  assert.equal(parsePrice("₹9,321.71"), 9321.71);
  assert.equal(parsePrice("Rs. 12999"), 12999);
  assert.equal(parsePrice(""), null);
});

test("asin and fx rate extraction", () => {
  assert.equal(asinFrom("https://www.amazon.in/JBL-Flip-7/dp/B0DXX1YY2Z/ref=sr_1"), "B0DXX1YY2Z");
  assert.equal(asinFrom("https://www.flipkart.com/jbl-flip-7/p/itm123"), null);
  assert.equal(extractRate({ date: "2026-09-25", base: "AED", quote: "INR", rate: 26.104 }, "AED"), 26.104);
  assert.equal(extractRate({ rates: { INR: 26.05 } }, "AED"), 26.05);
});
