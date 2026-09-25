import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { datesIn, startDateIn, agreeOnStart, refreshSales, upcomingSales } from "../src/sales.js";

test("dates are read in both orders, with or without ordinals", () => {
  assert.deepEqual(datesIn("kicks off on October 9, 2026 with early access on 8th October", 2026).map((d) => d.date), ["2026-10-09", "2026-10-08"]);
  assert.deepEqual(datesIn("Sale from 23 Sept to 20 Oct", 2025).map((d) => d.date), ["2025-09-23", "2025-10-20"]);
  assert.deepEqual(datesIn("no dates here", 2026), []);
});

test("the start date is the one after a start word, not the first date mentioned", () => {
  assert.equal(startDateIn("Early access on 8th October; the main sale starts on October 9, 2026", 2026), "2026-10-09");
  assert.equal(startDateIn("Big Billion Days 2026 dates: October 9 to October 18", 2026), "2026-10-09");
});

test("a date is confirmed only when two different sites agree", () => {
  const results = [
    { title: "BBD 2026 starts October 9", snippet: "", link: "https://www.siteone.com/a" },
    { title: "BBD 2026 starts October 9", snippet: "", link: "https://www.siteone.com/b" },
    { title: "Flipkart sale from 9 October", snippet: "early access 8 October", link: "https://sitetwo.in/x" },
    { title: "Sale rumoured for October 2", snippet: "", link: "https://sitethree.in/y" },
  ];
  assert.deepEqual(agreeOnStart(results, 2026), { start: "2026-10-09", sources: ["https://www.siteone.com/a", "https://sitetwo.in/x"], agreeing: 2 });
  assert.equal(agreeOnStart(results.slice(0, 2), 2026), null, "one site twice is not two sites");
});

test("refreshSales writes a state file and upcomingSales prefers a live date over the seed", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wc-")), "sales.json");
  const search = async (q) => /Flipkart/.test(q)
    ? [{ title: "Big Billion Days 2026 starts October 10", link: "https://a.in/1" }, { title: "BBD begins 10 October", link: "https://b.in/2" }]
    : [];
  const state = await refreshSales({ year: 2026, search, file });
  assert.equal(state.sales.bbd.start, "2026-10-10");
  assert.equal(state.sales.gif, undefined, "no agreement means no entry");
  const up = upcomingSales(new Date("2026-09-25"), state);
  const bbd = up.find((s) => s.key === "bbd"), gif = up.find((s) => s.key === "gif");
  assert.equal(bbd.start, "2026-10-10");
  assert.equal(bbd.confirmedBy, "search");
  assert.equal(gif.start, "2026-10-08");
  assert.equal(gif.confirmedBy, "manual");
});

test("a sale drops to its usual window a month after it starts or in a year with no date", () => {
  const later = upcomingSales(new Date("2026-11-15"), { sales: {} });
  assert.ok(later.every((s) => s.start === null && s.usual));
  const next = upcomingSales(new Date("2027-06-01"), { sales: {} });
  assert.ok(next.every((s) => s.start === null));
});
