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
  const kg = num(/(\d+(?:\.\d+)?)\s*kgs?\b/);
  const g = num(/(\d{2,4})\s*(?:g|gm|gms|grams?)\b/);
  return {
    ml: num(/(\d{2,4})\s*ml\b/),
    cm: num(/(\d{2,3})\s*cm\b/),
    mm: num(/(\d{2})\s*mm\b/),
    gb: num(/(\d{2,4})\s*(?:gb|tb)\b/),
    grams: kg ? Math.round(kg * 1000) : g,
    conc,
    used: /\b(refurbished|renewed|pre-owned|used|second hand)\b/.test(t),
    set: /\b(set of|combo|pack of|bundle|\d\s*pc|\d\s*piece)\b/.test(t),
    tester: /\b(tester|decant|sample|vial|travel size|miniature|mini|refill)\b/.test(t),
  };
}

// Cheap rules first: a stated size or concentration in the query must match the listing.
// Anything the rules cannot decide goes to Jev when a key exists.
// Cross-border resellers list the world's stock at import prices. Not an Indian price.
const IMPORTERS = /desertcart|ubuy|microless|etoren|joom|aliexpress|ebay|amazon\.com\b|amazon\.ae|noon\.com/i;

// generic: the query names a kind of product (roasted almonds), not a brand and model,
// so the first word is not a brand and pack sizes are compared per 100 g instead of rejected.
export function ruleCheck(query, listing, { generic = false } = {}) {
  const q = parseSpec(query), l = parseSpec(listing.title);
  if (IMPORTERS.test(listing.seller || "") || IMPORTERS.test(listing.url || "")) return { verdict: "reject", reason: "imports on demand, not an Indian store price" };
  if (l.used) return { verdict: "reject", reason: "used or refurbished" };
  if (l.tester && !q.tester) return { verdict: "reject", reason: "tester, decant, sample or mini" };
  if (l.set && !q.set) return { verdict: "reject", reason: "a set or bundle, not the single item" };
  for (const k of ["ml", "cm", "mm", "gb"]) {
    if (q[k] && l[k] && q[k] !== l[k]) return { verdict: "reject", reason: `${l[k]}${k}, you asked for ${q[k]}${k}` };
  }
  if (!generic && q.grams && l.grams && q.grams !== l.grams) return { verdict: "reject", reason: `${l.grams} g, you asked for ${q.grams} g` };
  if (q.conc && l.conc && q.conc !== l.conc) return { verdict: "reject", reason: `${l.conc.toUpperCase()}, you asked for ${q.conc.toUpperCase()}` };
  if (!generic) {
    const qWords = query.toLowerCase().match(/[a-z0-9]+/g) || [];
    const brand = qWords[0];
    if (brand && brand.length > 2 && !listing.title.toLowerCase().includes(brand)) return { verdict: "reject", reason: `does not mention ${brand}` };
  }
  const decided = (q.ml && l.ml) || (q.cm && l.cm) || (q.mm && l.mm) || (q.gb && l.gb) || (!generic && q.grams && l.grams);
  return { verdict: decided && (!q.conc || l.conc) ? "keep" : "unsure", reason: decided ? "size matches" : "size or variant not stated in the title" };
}

// Words that mark a query as a kind of product rather than a model, used only when Jev is absent.
const GENERIC_HINT = /\b(almonds?|cashews?|pistachios?|walnuts?|dates|saffron|chocolates?|coffee|tea|honey|spices?|nuts|raisins?|rice|oil|ghee|butter|cheese|biscuits?|cookies|noodles|snacks?|masala|perfume oil|attar|oud)\b/i;

// A genuine Dior at a fifth of the going rate is a decant or a clone. Judged against the
// candidates still standing, so one outlier cannot move the bar. Runs twice: after the
// rules, and again after Jev has thinned the list, when the median is more honest.
export function priceSanity(rows, floor = 0.4) {
  const cands = rows.filter((r) => r.verdict !== "reject").map((r) => r.price).filter(Number.isFinite).sort((a, b) => a - b);
  if (cands.length < 3) return;
  const med = cands[Math.floor(cands.length / 2)];
  for (const r of rows) if (r.verdict !== "reject" && r.price < med * floor) { r.verdict = "reject"; r.reason = `far below the other listings, likely a decant or a clone`; }
}

// Two narrow questions per listing beat one wide one: Jev answers "same model?" and
// "does the size or concentration contradict?" separately, so a colour or a GPS tier
// in the title does not drag the match score down.
// One request to Jev carries three judgments: is the query itself generic, and per listing,
// same model (for a brand query) or same kind of product (for a generic one), plus whether
// the listing's size or variant contradicts the query. Which set counts is decided after.
export async function matchListings(query, listings, { apiKey = process.env.TYPESAFE_API_KEY, same = 0.5, sameKind = 0.6, contradict = 0.5, max = 20 } = {}) {
  const loose = listings.slice(0, max).map((l) => ({ ...l, ...ruleCheck(query, l, { generic: true }) }));
  const strict = listings.slice(0, max).map((l) => ({ ...l, ...ruleCheck(query, l, { generic: false }) }));
  let generic = !apiKey && GENERIC_HINT.test(query) && !/\d/.test(query.split(/\s+/)[0]);
  let rows = generic ? loose : strict;
  let genericP = null;
  const unsure = loose.filter((r) => r.verdict !== "reject");
  if (apiKey && unsure.length) {
    const state = { query, listings: unsure.map((r, i) => ({ i, title: r.title, seller: r.seller })) };
    const questions = {
      generic: { type: "noul", instructions: "Does `query` name a kind of product rather than a specific brand and model? Examples of a kind: roasted almonds, saffron, dates, olive oil, sheet masks. Examples of a brand and model: Dior Sauvage EDP, JBL Flip 7, iPhone 17 Pro, American Tourister Curio." },
    };
    unsure.forEach((_, i) => {
      questions[`s${i}`] = { type: "noul", instructions: `Is \`listings[${i}].title\` the same brand and model as \`query\`? Colour, seller, packaging and a GPS or cellular tier do not matter. A clone, an "inspired by" scent, a misspelt brand, a bundle with extras, a different model number or a different product line is not the same.` };
      questions[`k${i}`] = { type: "noul", instructions: `Is \`listings[${i}].title\` the same kind of product as \`query\`, with the same preparation when \`query\` states one (roasted, salted, honey coated, plain)? Brand, pack size and seller do not matter. A different food or item, a gift hamper, a mix with other things, or a flavoured variant the query did not ask for is not the same kind.` };
      questions[`c${i}`] = { type: "noul", instructions: `Does \`listings[${i}].title\` state a size, capacity or concentration (EDP, EDT, Parfum, Elixir, ml, cm, mm, GB) that contradicts what \`query\` states? Pack weight in grams does not count. Answer no when \`query\` states none, or when the listing states none.` };
    });
    try {
      const res = await askJev({ state, questions, apiKey });
      genericP = res?.answers?.generic?.noul ?? null;
      generic = typeof genericP === "number" ? genericP >= 0.5 : generic;
      rows = generic ? loose : strict;
      const byTitle = new Map(unsure.map((r, i) => [r.title + "|" + r.seller + "|" + r.price, i]));
      for (const r of rows) {
        if (r.verdict === "reject") continue;
        const i = byTitle.get(r.title + "|" + r.seller + "|" + r.price);
        if (i == null) continue;
        const ps = res?.answers?.[generic ? `k${i}` : `s${i}`]?.noul, pc = res?.answers?.[`c${i}`]?.noul;
        if (typeof ps !== "number") continue;
        r.p = ps; r.pc = pc ?? null;
        const bar = generic ? sameKind : same;
        const ok = ps >= bar && (pc == null || pc <= contradict);
        r.verdict = ok ? "keep" : "reject";
        const what = generic ? "same kind" : "same model";
        r.reason = ok ? `Jev ${Math.round(ps * 100)}% ${what}` : ps < bar ? `Jev ${Math.round(ps * 100)}% ${what}` : `Jev ${Math.round(pc * 100)}% a different size or variant`;
        const q = parseSpec(query), l = parseSpec(r.title);
        if (ok && !generic && ((q.ml && !l.ml) || (q.cm && !l.cm) || (q.mm && !l.mm) || (q.gb && !l.gb))) r.reason += ", size not in the title";
      }
    } catch (err) {
      rows.forEach((r) => { if (r.verdict !== "reject") r.reason += `; Jev unavailable (${err.message})`; });
    }
    priceSanity(rows);
  } else {
    priceSanity(rows);
  }
  for (const r of rows) {
    const grams = parseSpec(r.title).grams;
    r.grams = grams || null;
    r.per100 = grams ? r.price / grams * 100 : null;
  }
  const kept = rows.filter((r) => r.verdict === "keep" || (r.verdict === "unsure" && !apiKey));
  const rejected = rows.filter((r) => !kept.includes(r));
  return { kept, rejected, jevUsed: Boolean(apiKey && unsure.length), generic, genericP, queryGrams: parseSpec(query).grams || null };
}
