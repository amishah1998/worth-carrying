import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openRecorder, queryKey, recheck } from "../src/history.js";

function tempDb() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wc-")), "obs.sqlite");
}

function backdate(file, qkey, daysAgo, price) {
  const db = new DatabaseSync(file);
  const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
  db.prepare("INSERT INTO observations (ts, qkey, title, seller, price, mrp, url, source) VALUES (?,?,?,?,?,?,?,?)").run(ts, qkey, "JBL Flip 7", "Amazon.in", price, null, null, "t");
  db.close();
}

test("the recorder builds a daily series with a dated low and typical, and withholds the high until a month exists", () => {
  const file = tempDb();
  const rec = openRecorder(file);
  const q = queryKey("JBL Flip 7");
  assert.equal(rec.history(q), null);
  rec.record(q, [{ title: "JBL Flip 7", seller: "Flipkart", price: 12999, source: "t" }]);
  assert.equal(rec.history(q), null, "one day is not a history");
  backdate(file, q, 3, 11999);
  backdate(file, q, 3, 12499);
  backdate(file, q, 7, 13999);
  const h = rec.history(q);
  assert.equal(h.source, "own");
  assert.equal(h.low, 11999);
  assert.equal(h.lowDate, new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));
  assert.equal(h.high, null, "three days cannot say what the ceiling was");
  assert.equal(h.samples, 3);
  assert.equal(rec.series(q).length, 3);
  assert.equal(rec.series(q)[0].price, 13999, "oldest day first, cheapest price of that day");
  rec.close();
});

test("queryKey normalises text into a stable key", () => {
  assert.equal(queryKey("  Dior  Sauvage, EDP 100ml! "), "dior sauvage edp 100ml");
});

test("recheck re-prices every recent query and records only trusted stores", async () => {
  const rec = openRecorder(tempDb());
  const q = queryKey("JBL Flip 7");
  rec.record(q, [{ title: "JBL Flip 7", seller: "Flipkart", price: 12999, source: "t" }]);
  const seen = [];
  const r = await recheck(rec, {
    search: async (key) => { seen.push(key); return { listings: [{ title: "JBL Flip 7", seller: "Amazon.in", price: 11999 }, { title: "JBL Flip 7", seller: "Some Shop", price: 8000 }] }; },
    match: async (key, listings) => ({ kept: listings }),
    isTrusted: (l) => /amazon|flipkart/i.test(l.seller),
  });
  assert.deepEqual(seen, [q]);
  assert.deepEqual(r, { items: 1, done: 1 });
  const rows = rec.series(q);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, 11999, "the untrusted 8,000 was not recorded");
  rec.close();
});
