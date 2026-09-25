#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createServer } from "../src/server.js";
import { check } from "../src/check.js";
import { openRecorder } from "../src/history.js";
import { inr } from "../src/util.js";

// .env in the working directory, so keys never sit in shell history.
const envFile = path.resolve(".env");
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const args = process.argv.slice(2);
if (args[0] === "check") {
  const opt = { price: null, currency: "AED", country: "AE", trip: 0 };
  const words = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--price") opt.price = Number(args[++i]);
    else if (args[i] === "--currency") opt.currency = args[++i];
    else if (args[i] === "--country") opt.country = args[++i];
    else if (args[i] === "--trip") opt.trip = Number(args[++i]);
    else if (args[i] === "--json") opt.json = true;
    else words.push(args[i]);
  }
  const recorder = openRecorder();
  const out = await check({ query: words.join(" "), price: opt.price, currency: opt.currency, country: opt.country, tripTotalInr: opt.trip, recorder });
  recorder.close();
  if (opt.json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  console.log(`\n${out.query}   via ${out.provider}${out.jevUsed ? " + Jev" : ""}${out.generic ? "   (generic, compared per 100 g)" : ""}`);
  if (out.india.per100) console.log(`India per 100 g   cheapest ${inr(out.india.per100.low)} at ${out.india.per100.lowSeller}   typical ${inr(out.india.per100.typical)}   high ${inr(out.india.per100.high)}${out.india.queryGrams ? `   scaled to ${out.india.queryGrams} g: ${inr(out.india.now)}` : ""}`);
  else console.log(`India today  ${inr(out.india.now)} at ${out.india.nowSeller || "n/a"}${out.india.nowTrusted === false ? " (not a major store)" : ""}   typical ${inr(out.india.typical)}   low ${inr(out.india.low)}   high ${inr(out.india.high)}   ${out.india.historyNote || "no history yet"}`);
  if (out.india.cheapestAny) console.log(`Cheapest seen ${inr(out.india.cheapestAny.price)} at ${out.india.cheapestAny.seller}, unverified shop`);
  if (out.abroad) console.log(`Abroad       ${opt.price} ${opt.currency} = ${inr(out.abroad.shelfInr)}   duty ${inr(out.abroad.dutyInr)}   landed ${inr(out.abroad.landedInr)}`);
  console.log(`Verdict      ${out.verdict.label}. ${out.verdict.reason}   warranty: ${out.warranty.status}`);
  for (const k of out.listings.kept) console.log(`  keep   ${inr(k.price).padStart(11)}  ${k.seller.padEnd(22)} ${k.title.slice(0, 70)}${k.p != null ? `  (${Math.round(k.p * 100)}%)` : ""}${k.per100 ? `  ${k.grams} g, ${inr(k.per100)}/100 g` : ""}`);
  for (const r of out.listings.rejected) console.log(`  drop   ${inr(r.price).padStart(11)}  ${r.seller.padEnd(22)} ${r.title.slice(0, 50)}  ${r.reason}`);
  console.log(`${out.meta.ms} ms, ${out.meta.listingsSeen} listings seen\n`);
} else if (args[0] === "--help" || args[0] === "-h") {
  console.log(`worth-carrying: is it cheaper than India?

  worth-carrying                       start the web app on http://localhost:8787
  worth-carrying check "Dior Sauvage EDP 100ml" --price 350 --currency AED --country AE [--trip 40000] [--json]

Keys, read from .env in the current folder or the environment:
  SERPER_API_KEY      Google Shopping India (2,500 free queries); or SERPAPI_API_KEY; or neither to use a local Chrome on port 9222 for development
  TYPESAFE_API_KEY    Jev, rejects wrong variants and clones (optional but recommended)
  KEEPA_API_KEY       Amazon.in price history (optional, paid); without it history builds from your own lookups
  ANTHROPIC_API_KEY   photo input (optional)
  PORT, DAILY_CAP, PRICE_PROVIDER, RECORDER_DB`);
} else {
  createServer();
}
