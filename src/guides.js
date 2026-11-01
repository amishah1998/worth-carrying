import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Country guides: what a place is known for, what Indian travellers usually bring back,
// fun facts and watch-outs. Every entry in the file carries the URL it came from.
let cache = null;

// The Worker has no file system for guides.json, so it imports the file and hands it over here.
export function useGuides(parsed) {
  cache = { generated: parsed?.generated || null, countries: Array.isArray(parsed?.countries) ? parsed.countries : [] };
  return cache;
}

export function loadGuides(file) {
  if (cache) return cache;
  try {
    file ??= process.env.GUIDES_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), "guides.json");
    return useGuides(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return useGuides(null);
  }
}

export function listCountries() {
  return loadGuides().countries.map((c) => ({ code: c.code, name: c.name, currency: c.currency || null }));
}

export function getGuide(code) {
  const c = loadGuides().countries.find((x) => x.code === String(code || "").toUpperCase());
  if (!c) return null;
  const trim = (arr, keys) => (Array.isArray(arr) ? arr : []).map((e) => Object.fromEntries(keys.map((k) => [k, e[k] ?? null])));
  return {
    code: c.code, name: c.name, currency: c.currency || null, generated: loadGuides().generated,
    knownFor: trim(c.knownFor, ["item", "search", "kind", "why", "source"]),
    usuallyBuy: trim(c.usuallyBuy, ["item", "search", "why", "source"]),
    funFacts: trim(c.funFacts, ["text", "source"]),
    watchOuts: trim(c.watchOuts, ["text", "source"]),
  };
}
