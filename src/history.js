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
      for (const l of listings) ins.run(ts, qkey, l.title ?? null, l.seller ?? null, l.price, l.mrp ?? null, l.url ?? null, l.source ?? null);
    },
    // One point per day: the cheapest trusted price seen that day.
    series(qkey) {
      return db.prepare("SELECT substr(ts,1,10) AS day, MIN(price) AS price FROM observations WHERE qkey = ? GROUP BY day ORDER BY day").all(qkey);
    },
    history(qkey) {
      const days = this.series(qkey);
      if (days.length < 2) return null;
      const prices = days.map((d) => d.price);
      const lowDay = days.reduce((a, b) => (b.price < a.price ? b : a));
      const highDay = days.reduce((a, b) => (b.price > a.price ? b : a));
      // The high is reported only once a month of days exists; a few samples cannot say what the ceiling was.
      return { source: "own", low: lowDay.price, lowDate: lowDay.day, high: days.length >= 30 ? highDay.price : null, highDate: days.length >= 30 ? highDay.day : null, typical: median(prices), since: days[0].day, samples: days.length, note: `Our own record since ${days[0].day}, ${days.length} days` };
    },
    // Every product anyone looked up in the last 90 days, for the daily re-check.
    recentQueries(days = 90) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      return db.prepare("SELECT qkey, MAX(title) AS title FROM observations WHERE ts >= ? GROUP BY qkey").all(since);
    },
    close() { db.close(); },
  };
}

// Re-price everything people looked up, so lows and highs exist for every store over time.
// Runs on a hosted copy with a real price key; the development Chrome provider is skipped.
export async function recheck(recorder, { search, match, isTrusted, limit = 200, log = () => {} }) {
  const items = recorder.recentQueries().slice(0, limit);
  let done = 0;
  for (const it of items) {
    try {
      const { listings } = await search(it.qkey);
      const { kept } = await match(it.qkey, listings);
      const trusted = kept.filter(isTrusted);
      if (trusted.length) recorder.record(it.qkey, trusted);
      done++;
    } catch (err) {
      log(`recheck ${it.qkey}: ${err.message}`);
    }
  }
  return { items: items.length, done };
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
