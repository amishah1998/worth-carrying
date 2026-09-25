import { askJev } from "./jev.js";

// What a listing title says about the variant: size, capacity, concentration, condition.
export function parseSpec(text) {
  const t = String(text || "").toLowerCase();
  const num = (re) => { const m = t.match(re); return m ? Number(m[1]) : null; };
  // Elixir and Extrait are their own products even when the box also says "eau de parfum".
  const conc = /\bextrait\b|\belixir\b/.test(t) ? "parfum"
    : /\beau de parfum\b|\bedp\b/.test(t) ? "edp"
    : /\beau de toilette\b|\bedt\b/.test(t) ? "edt"
    : /\beau de cologne\b|\bedc\b/.test(t) ? "edc"
    : /\bparfum\b/.test(t) ? "parfum" : null;
  return {
    ml: num(/(\d{2,4})\s*ml\b/),
    cm: num(/(\d{2,3})\s*cm\b/),
    mm: num(/(\d{2})\s*mm\b/),
    gb: num(/(\d{2,4})\s*(?:gb|tb)\b/),
    conc,
    used: /\b(refurbished|renewed|pre-owned|used|second hand)\b/.test(t),
    set: /\b(set of|combo|pack of|bundle|\d\s*pc|\d\s*piece)\b/.test(t),
    tester: /\btester\b/.test(t),
  };
}

// Cheap rules first: a stated size or concentration in the query must match the listing.
// Anything the rules cannot decide goes to Jev when a key exists.
// Cross-border resellers list the world's stock at import prices. Not an Indian price.
const IMPORTERS = /desertcart|ubuy|microless|etoren|joom|aliexpress|ebay|amazon\.com\b|amazon\.ae|noon\.com/i;

export function ruleCheck(query, listing) {
  const q = parseSpec(query), l = parseSpec(listing.title);
  if (IMPORTERS.test(listing.seller || "") || IMPORTERS.test(listing.url || "")) return { verdict: "reject", reason: "imports on demand, not an Indian store price" };
  if (l.used) return { verdict: "reject", reason: "used or refurbished" };
  if (l.tester) return { verdict: "reject", reason: "tester" };
  if (l.set && !q.set) return { verdict: "reject", reason: "a set or bundle, not the single item" };
  for (const k of ["ml", "cm", "mm", "gb"]) {
    if (q[k] && l[k] && q[k] !== l[k]) return { verdict: "reject", reason: `${l[k]}${k}, you asked for ${q[k]}${k}` };
  }
  if (q.conc && l.conc && q.conc !== l.conc) return { verdict: "reject", reason: `${l.conc.toUpperCase()}, you asked for ${q.conc.toUpperCase()}` };
  const qWords = query.toLowerCase().match(/[a-z0-9]+/g) || [];
  const brand = qWords[0];
  if (brand && brand.length > 2 && !listing.title.toLowerCase().includes(brand)) return { verdict: "reject", reason: `does not mention ${brand}` };
  const decided = (q.ml && l.ml) || (q.cm && l.cm) || (q.mm && l.mm) || (q.gb && l.gb);
  return { verdict: decided && (!q.conc || l.conc) ? "keep" : "unsure", reason: decided ? "size matches" : "size or variant not stated in the title" };
}

// A genuine Dior at a fifth of the going rate is a decant or a clone. Judged against the
// candidates that survived the rules, so one outlier cannot move the bar.
export function priceSanity(rows, floor = 0.3) {
  const cands = rows.filter((r) => r.verdict !== "reject").map((r) => r.price).filter(Number.isFinite).sort((a, b) => a - b);
  if (cands.length < 3) return;
  const med = cands[Math.floor(cands.length / 2)];
  for (const r of rows) if (r.verdict !== "reject" && r.price < med * floor) { r.verdict = "reject"; r.reason = `far below the other listings, likely a decant or a clone`; }
}

// Two narrow questions per listing beat one wide one: Jev answers "same model?" and
// "does the size or concentration contradict?" separately, so a colour or a GPS tier
// in the title does not drag the match score down.
export async function matchListings(query, listings, { apiKey = process.env.TYPESAFE_API_KEY, same = 0.5, contradict = 0.5, max = 20 } = {}) {
  const rows = listings.slice(0, max).map((l) => ({ ...l, ...ruleCheck(query, l) }));
  priceSanity(rows);
  const unsure = rows.filter((r) => r.verdict !== "reject");
  if (apiKey && unsure.length) {
    const state = { query, listings: unsure.map((r, i) => ({ i, title: r.title, seller: r.seller })) };
    const questions = {};
    unsure.forEach((_, i) => {
      questions[`s${i}`] = { type: "noul", instructions: `Is \`listings[${i}].title\` the same brand and model as \`query\`? Colour, seller, packaging and a GPS or cellular tier do not matter. A clone, an "inspired by" scent, a misspelt brand, a bundle with extras, a different model number or a different product line is not the same.` };
      questions[`c${i}`] = { type: "noul", instructions: `Does \`listings[${i}].title\` state a size, capacity or concentration (EDP, EDT, Parfum, Elixir, ml, cm, mm, GB) that contradicts what \`query\` states? Answer no when \`query\` states none, or when the listing states none.` };
    });
    try {
      const res = await askJev({ state, questions, apiKey });
      unsure.forEach((r, i) => {
        const ps = res?.answers?.[`s${i}`]?.noul, pc = res?.answers?.[`c${i}`]?.noul;
        if (typeof ps !== "number") return;
        r.p = ps; r.pc = pc ?? null;
        const ok = ps >= same && (pc == null || pc <= contradict);
        r.verdict = ok ? "keep" : "reject";
        r.reason = ok ? `Jev ${Math.round(ps * 100)}% same model` : ps < same ? `Jev ${Math.round(ps * 100)}% same model` : `Jev ${Math.round(pc * 100)}% a different size or variant`;
        const q = parseSpec(query), l = parseSpec(r.title);
        if (ok && ((q.ml && !l.ml) || (q.cm && !l.cm) || (q.mm && !l.mm) || (q.gb && !l.gb))) r.reason += ", size not in the title";
      });
    } catch (err) {
      unsure.forEach((r) => { r.reason += `; Jev unavailable (${err.message})`; });
    }
  }
  const kept = rows.filter((r) => r.verdict === "keep" || (r.verdict === "unsure" && !apiKey));
  const rejected = rows.filter((r) => !kept.includes(r));
  return { kept, rejected, jevUsed: Boolean(apiKey && unsure.length) };
}
