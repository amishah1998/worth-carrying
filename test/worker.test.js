import test from "node:test";
import assert from "node:assert/strict";
import { fakeD1 } from "./d1.js";

for (const k of ["SERPER_API_KEY", "SERPAPI_API_KEY", "TYPESAFE_API_KEY", "ANTHROPIC_API_KEY", "KEEPA_API_KEY", "PRICE_PROVIDER"]) delete process.env[k];
const { default: worker } = await import("../worker/index.js");

const SITE = "https://carry.example.com";
const BASE = "https://worth-carrying.example.workers.dev";
const db = fakeD1();
const env = { PRICE_PROVIDER: "serpapi", SERPAPI_API_KEY: "test-key", WEB_ORIGINS: SITE, DAILY_CAP: "25", DB: db };

const SHOPPING = { shopping_results: [
  { title: "JBL Flip 7 Portable Bluetooth Speaker, Black", extracted_price: 12999, source: "Amazon.in", product_link: "https://www.amazon.in/dp/B0EXAMPLE1" },
  { title: "JBL Flip 7 Wireless Speaker with IP68", extracted_price: 13499, source: "Flipkart", product_link: "https://www.flipkart.com/jbl-flip-7" },
  { title: "JBL Flip 7 Bluetooth Speaker Blue", extracted_price: 13999, source: "Croma", product_link: "https://www.croma.com/jbl-flip-7" },
] };

const realFetch = globalThis.fetch;
const calls = [];
test.before(() => {
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url || input);
    calls.push(url);
    if (url.startsWith("https://serpapi.com/")) return Response.json(SHOPPING);
    if (url.startsWith("https://api.frankfurter.dev/")) return Response.json({ date: "2026-11-01", base: "AED", quote: "INR", rate: 24 });
    return realFetch(input, init);
  };
});
test.after(() => { globalThis.fetch = realFetch; });

const call = (path, init = {}) => worker.fetch(new Request(BASE + path, init), env);

test("the Worker answers config, guides and preflight for the allowed site and refuses others", async () => {
  const pre = await call("/api/check", { method: "OPTIONS", headers: { Origin: SITE, "Access-Control-Request-Method": "POST" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), SITE);
  const config = await call("/api/config", { headers: { Origin: SITE } });
  assert.equal(config.status, 200);
  const body = await config.json();
  assert.equal(body.provider, "serpapi");
  assert.equal(body.dailyCap, 25);
  assert.ok(body.countries.find((c) => c.code === "AE")?.guide, "guides come from the bundled file");
  assert.equal((await call("/api/guide?country=ae")).status, 200);
  assert.equal((await call("/api/config", { headers: { Origin: "https://other.example.com" } })).status, 403);
  assert.equal((await call("/")).status, 404, "the page is served by Pages, not the Worker");
});

test("a lookup through the Worker uses SerpApi, prices the landed cost and records history in D1", async () => {
  const res = await call("/api/check", { method: "POST", headers: { Origin: SITE, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" }, body: JSON.stringify({ query: "JBL Flip 7", price: 450, currency: "AED", country: "AE" }) });
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(res.headers.get("access-control-allow-origin"), SITE);
  const out = await res.json();
  assert.equal(out.provider, "serpapi");
  assert.equal(out.listings.kept.length, 3);
  assert.equal(out.abroad.landedInr > 0, true);
  assert.ok(calls.some((u) => u.includes("engine=google_shopping") && u.includes("gl=in")));
  const rows = db.raw.prepare("SELECT COUNT(*) AS n FROM observations").get();
  assert.equal(rows.n, 3, "trusted listings were written to D1");
  assert.equal((await call("/api/check", { method: "POST", headers: { Origin: SITE }, body: "{not json" })).status, 400);
});
