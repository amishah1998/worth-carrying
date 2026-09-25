import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fetchJson, median } from "./util.js";

// Two history sources. Keepa (paid, Amazon.in only) answers on the first lookup.
// The own recorder stores every lookup so non-Amazon lows exist after a sale cycle.

export function openRecorder(file = process.env.RECORDER_DB || "data/observations.sqlite") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS observations (
    ts TEXT NOT NULL, qkey TEXT NOT NULL, title TEXT, seller TEXT, price REAL, mrp REAL, url TEXT, source TEXT
  ); CREATE INDEX IF NOT EXISTS obs_q ON observations(qkey, ts);`);
  return {
    record(qkey, listings) {
      const ins = db.prepare("INSERT INTO observations (ts, qkey, title, seller, price, mrp, url, source) VALUES (?,?,?,?,?,?,?,?)");
      const ts = new Date().toISOString();
      for (const l of listings) ins.run(ts, qkey, l.title, l.seller, l.price, l.mrp ?? null, l.url ?? null, l.source);
    },
    history(qkey) {
      const rows = db.prepare("SELECT ts, price FROM observations WHERE qkey = ? ORDER BY ts").all(qkey);
      if (rows.length < 2) return null;
      const prices = rows.map((r) => r.price);
      // No high from our own record: a few samples cannot say what the ceiling was.
      return { source: "own", low: Math.min(...prices), high: null, typical: median(prices), since: rows[0].ts.slice(0, 10), samples: rows.length, note: `Our own record since ${rows[0].ts.slice(0, 10)}, ${rows.length} prices` };
    },
    close() { db.close(); },
  };
}

export function queryKey(q) {
  return String(q || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Keepa product stats for amazon.in (domain 10). Prices arrive in paise-like integer units.
export async function keepaHistory(asin, { apiKey = process.env.KEEPA_API_KEY, fetchImpl } = {}) {
  if (!apiKey || !asin) return null;
  const u = `https://api.keepa.com/product?key=${apiKey}&domain=10&asin=${asin}&stats=730`;
  const body = await (fetchImpl || fetchJson)(u);
  const p = body?.products?.[0];
  if (!p?.stats) return null;
  const pick = (arr) => { const a = arr?.[0] > 0 ? arr[0] : arr?.[1]; return a > 0 ? a / 100 : null; };
  const low = pick(p.stats.min), high = pick(p.stats.max), typical = pick(p.stats.avg90) ?? pick(p.stats.avg180);
  if (!low) return null;
  return { source: "keepa", asin, low, high, typical, since: null, note: "Amazon.in history from Keepa, last two years" };
}
