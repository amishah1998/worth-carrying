import { fetchJson } from "./util.js";

// Frankfurter v2: no key, no quota, daily central-bank rates, 206 currencies.
// Cached for a day per currency; customs uses its own notified rate, so duty is approximate.
const cache = new Map();

export async function rateToInr(currency, { fetchImpl } = {}) {
  const cur = String(currency || "").toUpperCase();
  if (cur === "INR") return { rate: 1, date: null, source: "none" };
  const hit = cache.get(cur);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.value;
  const body = await (fetchImpl || fetchJson)(`https://api.frankfurter.dev/v2/rate/${cur}/INR`);
  const rate = extractRate(body, cur);
  if (!rate) throw new Error(`no INR rate for ${cur}`);
  const value = { rate, date: body?.date || body?.rates?.[0]?.date || null, source: "frankfurter" };
  cache.set(cur, { at: Date.now(), value });
  return value;
}

export function extractRate(body, cur) {
  if (!body) return null;
  if (typeof body.rate === "number") return body.rate;
  if (typeof body.rates?.INR === "number") return body.rates.INR;
  if (Array.isArray(body.rates)) { const r = body.rates.find((x) => x.quote === "INR" || x.currency === "INR"); if (r && typeof r.rate === "number") return r.rate; }
  if (typeof body.INR === "number") return body.INR;
  if (typeof body === "number") return body;
  return null;
}

export const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SGD", "THB", "IDR", "MYR", "SAR", "QAR", "OMR", "KWD", "BHD", "JPY", "AUD", "CAD", "CHF", "HKD", "VND", "LKR", "NPR", "TRY", "INR"];
