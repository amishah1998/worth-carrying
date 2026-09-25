import { median } from "./util.js";

export const VERDICTS = {
  cheaper: "Cheaper abroad",
  marginal: "Marginal",
  not_worth: "Not worth carrying",
  wait: "Wait for the India sale",
  unknown: "No India price found",
};

// india: { now, low, typical } in INR. landed: number in INR. warranty: { status }.
export function decide({ india, landed, warranty }) {
  if (india?.per100 && !india.queryGrams && landed) {
    const p = india.per100;
    return { verdict: "unknown", label: "Add the pack size for a verdict", saving: null, savingPct: null, reason: `India sells it at ${Math.round(p.low).toLocaleString("en-IN")} to ${Math.round(p.high).toLocaleString("en-IN")} rupees per 100 g. Add the weight, like "500g", and the card compares your pack.` };
  }
  if (!india?.now || !landed) return { verdict: "unknown", label: VERDICTS.unknown, saving: null, savingPct: null, reason: "No matching Indian listing" };
  const saving = india.now - landed;
  const savingPct = saving / india.now;
  const vsLow = india.low ? landed - india.low : null;
  let verdict, reason;
  if (savingPct <= 0.03) { verdict = "not_worth"; reason = saving <= 0 ? "India is cheaper today" : "Saving under 3 percent"; }
  else if (india.low && landed >= india.low * 1.1 && savingPct < 0.15) { verdict = "wait"; reason = `India has sold it for ${Math.round(india.low).toLocaleString("en-IN")} before, below what you would pay here`; }
  else if (savingPct < 0.12) { verdict = "marginal"; reason = "Saving under 12 percent"; }
  else { verdict = "cheaper"; reason = `${Math.round(savingPct * 100)} percent below India today`; }
  if (warranty?.status === "lost" && verdict === "cheaper" && savingPct < 0.2) { verdict = "marginal"; reason += ", and the India warranty is lost"; }
  return { verdict, label: VERDICTS[verdict], saving, savingPct, vsLow, reason };
}

// Stores a traveller would actually order from. "India today" is the cheapest of these;
// an unknown shop at half the price is shown separately, never used as the anchor.
export const TRUSTED = /amazon\.in|\bamazon\b|flipkart|myntra|nykaa|croma|reliance digital|tata cliq|tatacliq|jiomart|ajio|sephora|tira|vijay sales|shoppers stop|apple\b|samsung\b|jbl india|sony centre|boat|american tourister|samsonite|imagine|unicorn|aptronix|ishopping|maple|bigbasket|blinkit|zepto|instamart|dmart|nature'?s basket|spencer'?s|reliance smart|star bazaar/i;

export function isTrusted(l) {
  return TRUSTED.test(l.seller || "") || TRUSTED.test(l.url || "");
}

// A generic product is compared per 100 g across pack sizes. With a pack size in the query
// the figures are scaled to that size; without one only the per-100 g range is known.
export function genericFigures(kept, queryGrams) {
  const priced = kept.filter((k) => k.per100);
  if (!priced.length) return { now: null, nowSeller: null, low: null, high: null, typical: null, per100: null, unit: "100 g", queryGrams, historySource: null };
  const trusted = priced.filter(isTrusted);
  const pool = trusted.length ? trusted : priced;
  const cheapest = pool.reduce((a, b) => (a.per100 <= b.per100 ? a : b));
  const per100 = { low: cheapest.per100, lowSeller: cheapest.seller, lowGrams: cheapest.grams, typical: median(pool.map((k) => k.per100)), high: Math.max(...pool.map((k) => k.per100)) };
  const scale = queryGrams ? queryGrams / 100 : null;
  return {
    now: scale ? per100.low * scale : null, nowSeller: cheapest.seller, nowTrusted: trusted.length > 0,
    low: null, high: null, typical: scale ? per100.typical * scale : null,
    per100, unit: "100 g", queryGrams, historySource: null,
  };
}

// Today's India figures from the kept listings plus whatever history source answered.
export function indiaFigures(kept, history) {
  const prices = kept.map((k) => k.price).filter(Number.isFinite);
  if (!prices.length) return { now: null, nowSeller: null, low: history?.low ?? null, high: history?.high ?? null, typical: history?.typical ?? null, historySource: history?.source ?? null };
  const trusted = kept.filter(isTrusted);
  const pool = trusted.length ? trusted : kept;
  const cheapest = pool.reduce((a, b) => (a.price <= b.price ? a : b));
  const cheapestAny = kept.reduce((a, b) => (a.price <= b.price ? a : b));
  return {
    now: cheapest.price,
    nowSeller: cheapest.seller,
    nowTrusted: trusted.length > 0,
    cheapestAny: cheapestAny.price < cheapest.price ? { price: cheapestAny.price, seller: cheapestAny.seller } : null,
    spreadHigh: Math.max(...pool.map((k) => k.price)),
    low: history?.low ?? null,
    lowDate: history?.lowDate ?? null,
    high: history?.high ?? null,
    highDate: history?.highDate ?? null,
    typical: history?.typical ?? median(pool.map((k) => k.price)),
    historySource: history?.source ?? null,
    historySince: history?.since ?? null,
    historySamples: history?.samples ?? null,
    historyNote: history?.note ?? null,
  };
}
