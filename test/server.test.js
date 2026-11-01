import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "../src/server.js";

test("the API allows only configured web origins and supports Pages preflight", async (t) => {
  const oldRecheck = process.env.RECHECK_HOURS;
  const oldSales = process.env.SALES_REFRESH_DAYS;
  process.env.RECHECK_HOURS = "0";
  process.env.SALES_REFRESH_DAYS = "0";
  const server = createServer({ port: 0, recorder: {}, webOrigins: "https://shop.example.com" });
  if (oldRecheck === undefined) delete process.env.RECHECK_HOURS; else process.env.RECHECK_HOURS = oldRecheck;
  if (oldSales === undefined) delete process.env.SALES_REFRESH_DAYS; else process.env.SALES_REFRESH_DAYS = oldSales;
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const base = "http://localhost:" + server.address().port;
  const preflight = await fetch(base + "/api/check", { method: "OPTIONS", headers: { Origin: "https://shop.example.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://shop.example.com");
  assert.equal(preflight.headers.get("access-control-allow-headers"), "Content-Type");
  const external = await fetch(base + "/api/config", { headers: { Origin: "https://shop.example.com" } });
  assert.equal(external.status, 200);
  assert.equal(external.headers.get("vary"), "Origin");
  assert.ok(Array.isArray((await external.json()).countries));
  for (const origin of ["https://other.example.com", "https://shop.example.com.attacker.test", "null"]) {
    const denied = await fetch(base + "/api/config", { headers: { Origin: origin } });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
  }
  const local = await fetch(base + "/api/config", { headers: { Origin: base } });
  assert.equal(local.status, 200);
  assert.equal(local.headers.get("access-control-allow-origin"), null);
  for (const asset of ["/app.js", "/app.css", "/config.js"]) {
    assert.equal((await fetch(base + asset)).status, 200);
  }
});
