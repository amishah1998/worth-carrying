import fs from "node:fs";
import path from "node:path";
import { fetchJson } from "./util.js";

// The big Indian sale windows, shown on the card so a traveller can decide to wait.
// Seed dates were read by hand with their sources (docs/rules.md). When a price key exists,
// refreshSales searches the web weekly and replaces a seed only when two different sites
// agree on the same start date; otherwise the card shows the usual window from past years.
export const SALES = [
  {
    key: "gif", name: "Amazon Great Indian Festival",
    query: "Amazon Great Indian Festival {year} sale start date",
    usual: "late September to October",
    past: [{ year: 2022, start: "2022-09-23" }, { year: 2023, start: "2023-10-08" }, { year: 2024, start: "2024-09-27" }, { year: 2025, start: "2025-09-23" }],
    pastSource: "https://www.desidime.com/news/amazon-great-indian-festival-2026-agif-sale",
    seed: { year: 2026, start: "2026-10-08", sources: ["https://www.desidime.com/news/amazon-great-indian-festival-2026-agif-sale", "https://sundayguardianlive.com/trending/amazon-great-indian-festival-2026-when-does-the-sale-start-check-sale-date-offers-smartphone-electronics-fashion-discounts-prime-member-benefits-extra-deals-more-291714/"] },
  },
  {
    key: "bbd", name: "Flipkart Big Billion Days",
    query: "Flipkart Big Billion Days {year} sale start date",
    usual: "late September to October",
    past: [],
    pastSource: null,
    seed: { year: 2026, start: "2026-10-09", end: "2026-10-18", sources: ["https://sundayguardianlive.com/trending/flipkart-big-billion-days-2026-starts-on-october-9-with-exclusive-early-access-on-october-8-for-flipkart-plus-black-eligible-credit-card-members-heres-bank-offers-discounts-deals-290338/", "https://www.desidime.com/news/flipkart-big-billion-days-2026-bbd-sale"] },
  },
];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
const DATE_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\b|\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi");

function monthIndex(word) {
  const w = word.toLowerCase().slice(0, 3);
  return MONTHS.findIndex((m) => m.startsWith(w));
}

// Every day-month mention in a snippet, as YYYY-MM-DD for the given year, with its offset.
export function datesIn(text, year) {
  const out = [];
  for (const m of String(text || "").matchAll(DATE_RE)) {
    const day = Number(m[1] || m[4]), mon = monthIndex(m[2] || m[3]);
    if (!day || day > 31 || mon < 0) continue;
    out.push({ date: `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, at: m.index });
  }
  return out;
}

// The start date a snippet claims: the first date after a start word, else the first date.
export function startDateIn(text, year) {
  const t = String(text || "");
  const found = datesIn(t, year);
  if (!found.length) return null;
  const cue = /\b(start|starts|starting|begin|begins|kick|kicks|from|live on|goes live)\b/gi;
  for (const c of t.matchAll(cue)) {
    const next = found.find((d) => d.at > c.index && d.at - c.index < 60);
    if (next) return next.date;
  }
  return found[0].date;
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

// Confirmed only when two different sites name the same start date.
export function agreeOnStart(results, year, { minSites = 2 } = {}) {
  const votes = new Map();
  for (const r of results) {
    const d = startDateIn(`${r.title || ""}. ${r.snippet || ""}`, year);
    const site = domainOf(r.link);
    if (!d || !site) continue;
    if (!votes.has(d)) votes.set(d, new Map());
    if (!votes.get(d).has(site)) votes.get(d).set(site, r.link);
  }
  let best = null;
  for (const [date, sites] of votes) if (!best || sites.size > best.sites.size) best = { date, sites };
  if (!best || best.sites.size < minSites) return null;
  return { start: best.date, sources: [...best.sites.values()].slice(0, 3), agreeing: best.sites.size };
}

export async function searchSerperWeb(q, { apiKey = process.env.SERPER_API_KEY, fetchImpl = fetchJson } = {}) {
  if (!apiKey) throw new Error("SERPER_API_KEY is not set");
  const body = await fetchImpl("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "in", hl: "en", num: 10, tbs: "qdr:m" }),
  });
  return (body?.organic || []).map((r) => ({ title: r.title, snippet: r.snippet, link: r.link }));
}

const STATE_FILE = () => process.env.SALES_STATE || path.join(path.dirname(process.env.RECORDER_DB || "data/observations.sqlite"), "sales.json");

export function loadSalesState(file = STATE_FILE()) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return { checkedAt: null, sales: {} }; }
}

export async function refreshSales({ year = new Date().getFullYear(), search = searchSerperWeb, file = STATE_FILE(), log = () => {} } = {}) {
  const state = loadSalesState(file);
  for (const s of SALES) {
    try {
      const results = await search(s.query.replace("{year}", String(year)));
      const found = agreeOnStart(results, year);
      if (found) state.sales[s.key] = { year, ...found, checkedAt: new Date().toISOString() };
      else log(`sales: no two sites agree yet on ${s.name} ${year}`);
    } catch (err) {
      log(`sales: ${s.name}: ${err.message}`);
    }
  }
  state.checkedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return state;
}

// What the card shows: a confirmed date for this year when one exists (from the weekly
// search, else the hand-read seed), otherwise the usual window. A date drops off a
// month after it passes.
export function upcomingSales(now = new Date(), state = loadSalesState()) {
  const year = now.getFullYear();
  const cutoff = now.getTime() - 30 * 86400000;
  return SALES.map((s) => {
    const live = state?.sales?.[s.key];
    const pick = live && live.year === year ? { start: live.start, sources: live.sources, confirmedBy: "search" }
      : s.seed && s.seed.year === year ? { start: s.seed.start, end: s.seed.end || null, sources: s.seed.sources, confirmedBy: "manual" } : null;
    if (pick && new Date(pick.start).getTime() >= cutoff) return { key: s.key, name: s.name, ...pick, usual: s.usual };
    return { key: s.key, name: s.name, start: null, sources: s.pastSource ? [s.pastSource] : [], confirmedBy: null, usual: s.usual };
  });
}
