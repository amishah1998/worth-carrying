import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { OBS_SQL, obsRow, historyFromSeries } from "./history.js";

// The own recorder stores every lookup so non-Amazon lows exist after a sale cycle.
// SQLite on disk for the Node server; recorder-d1.js is the same store on Cloudflare.
export function openRecorder(file = process.env.RECORDER_DB || "data/observations.sqlite") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(OBS_SQL.schema.join("; "));
  return {
    record(qkey, listings) {
      const ins = db.prepare(OBS_SQL.insert);
      const ts = new Date().toISOString();
      for (const l of listings) ins.run(...obsRow(ts, qkey, l));
    },
    series(qkey) { return db.prepare(OBS_SQL.series).all(qkey); },
    history(qkey) { return historyFromSeries(this.series(qkey)); },
    // Every product anyone looked up in the last 90 days, for the daily re-check.
    recentQueries(days = 90) { return db.prepare(OBS_SQL.recent).all(new Date(Date.now() - days * 86400000).toISOString()); },
    close() { db.close(); },
  };
}
