import { searchIndia } from "./providers/index.js";
import { matchListings } from "./match.js";
import { rateToInr } from "./fx.js";
import { landedCost, warrantyFor, notesFor } from "./rules.js";
import { decide, indiaFigures, genericFigures, isTrusted } from "./verdict.js";
import { keepaHistory, queryKey } from "./history.js";
import { normalizeQuery } from "./util.js";

// The whole pipeline for one lookup. recorder is optional (tests run without it).
export async function check({ query, price, currency = "AED", country = "AE", tripTotalInr = 0, recorder = null, provider, env = process.env }) {
  const q = normalizeQuery(query);
  if (!q) throw new Error("query is empty");
  const started = Date.now();
  const [{ provider: used, listings }, fx] = await Promise.all([
    searchIndia(q, { provider }),
    price ? rateToInr(currency) : Promise.resolve(null),
  ]);
  const { kept, rejected, jevUsed, generic, queryGrams } = await matchListings(q, listings, { apiKey: env.TYPESAFE_API_KEY });
  const qkey = queryKey(q);
  // Only stores a traveller would order from feed the history, so an odd seller never sets the low.
  const trusted = kept.filter(isTrusted);
  // History is a bonus: a store that fails (D1 over the network) must not fail the lookup.
  if (recorder && trusted.length) await quiet(() => recorder.record(qkey, trusted));
  const asin = kept.find((k) => k.asin)?.asin || null;
  let history = null;
  try { history = await keepaHistory(asin, { apiKey: env.KEEPA_API_KEY }); } catch { history = null; }
  if (!history && recorder) history = await quiet(() => recorder.history(qkey), null);
  const india = generic ? genericFigures(kept, queryGrams) : indiaFigures(kept, history);
  const abroad = price && fx ? landedCost({ price, rate: fx.rate, tripTotalInr }) : null;
  const warranty = warrantyFor(q + " " + (kept[0]?.title || ""));
  const verdict = abroad ? decide({ india, landed: abroad.landedInr, warranty }) : { verdict: "unknown", label: "India price only", reason: "No shelf price given", saving: null, savingPct: null };
  return {
    query: q, provider: used, jevUsed, generic: Boolean(generic), country: country || null,
    india, abroad, fx, warranty, notes: notesFor(q), verdict,
    series: recorder ? await quiet(() => recorder.series(qkey), []) : [],
    listings: { kept: kept.map(strip), rejected: rejected.map(strip) },
    meta: { ms: Date.now() - started, listingsSeen: listings.length, historySource: india.historySource },
  };
}

async function quiet(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

function strip(l) {
  return { title: l.title, price: l.price, mrp: l.mrp ?? null, seller: l.seller, url: l.url ?? null, asin: l.asin ?? null, p: l.p ?? null, reason: l.reason ?? null, grams: l.grams ?? null, per100: l.per100 ?? null };
}
