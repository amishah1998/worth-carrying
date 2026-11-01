import { DatabaseSync } from "node:sqlite";

// A stand-in for a Cloudflare D1 binding (prepare, bind, run, all, batch) over in-memory SQLite,
// so the D1 recorder's SQL runs against a real database in tests.
export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  const statement = (sql, args = []) => ({
    bind: (...next) => statement(sql, next),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    all: async () => ({ results: db.prepare(sql).all(...args), success: true }),
  });
  return {
    raw: db,
    prepare: (sql) => statement(sql),
    batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; },
  };
}
