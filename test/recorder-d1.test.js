import test from "node:test";
import assert from "node:assert/strict";
import { openD1Recorder } from "../src/recorder-d1.js";
import { queryKey, recheck } from "../src/history.js";
import { fakeD1 } from "./d1.js";

function backdate(d1, qkey, daysAgo, price) {
  const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
  d1.raw.prepare("INSERT INTO observations (ts, qkey, title, seller, price, mrp, url, source) VALUES (?,?,?,?,?,?,?,?)").run(ts, qkey, "JBL Flip 7", "Amazon.in", price, null, null, "t");
}

test("the D1 recorder creates its table on first use and gives the same history as the SQLite one", async () => {
  const d1 = fakeD1();
  const rec = openD1Recorder(d1);
  const q = queryKey("JBL Flip 7");
  assert.equal(await rec.history(q), null);
  await rec.record(q, [{ title: "JBL Flip 7", seller: "Flipkart", price: 12999, source: "t" }]);
  assert.equal(await rec.history(q), null, "one day is not a history");
  backdate(d1, q, 3, 11999);
  backdate(d1, q, 7, 13999);
  const h = await rec.history(q);
  assert.equal(h.low, 11999);
  assert.equal(h.high, null);
  assert.equal(h.samples, 3);
  const series = await rec.series(q);
  assert.deepEqual(series.map((d) => d.price), [13999, 11999, 12999]);
  await rec.record(q, []);
  assert.equal((await rec.series(q)).length, 3, "an empty batch writes nothing");
});

test("recheck works against the async D1 recorder", async () => {
  const rec = openD1Recorder(fakeD1());
  const q = queryKey("JBL Flip 7");
  await rec.record(q, [{ title: "JBL Flip 7", seller: "Flipkart", price: 12999, source: "t" }]);
  const r = await recheck(rec, {
    search: async () => ({ listings: [{ title: "JBL Flip 7", seller: "Amazon.in", price: 11999 }] }),
    match: async (key, listings) => ({ kept: listings }),
    isTrusted: () => true,
  });
  assert.deepEqual(r, { items: 1, done: 1 });
  assert.equal((await rec.series(q))[0].price, 11999);
});
