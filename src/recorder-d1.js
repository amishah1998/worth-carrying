import { OBS_SQL, obsRow, historyFromSeries } from "./history.js";

// recorder.js on Cloudflare D1 for the Worker. Same table and answers; every call is async.
export function openD1Recorder(db) {
  let ready = null;
  const init = () => (ready ??= db.batch(OBS_SQL.schema.map((sql) => db.prepare(sql))).catch((err) => { ready = null; throw err; }));
  const rec = {
    async record(qkey, listings) {
      if (!listings.length) return;
      await init();
      const ins = db.prepare(OBS_SQL.insert);
      const ts = new Date().toISOString();
      await db.batch(listings.map((l) => ins.bind(...obsRow(ts, qkey, l))));
    },
    async series(qkey) {
      await init();
      return (await db.prepare(OBS_SQL.series).bind(qkey).all()).results;
    },
    async history(qkey) { return historyFromSeries(await rec.series(qkey)); },
    async recentQueries(days = 90) {
      await init();
      return (await db.prepare(OBS_SQL.recent).bind(new Date(Date.now() - days * 86400000).toISOString()).all()).results;
    },
  };
  return rec;
}
