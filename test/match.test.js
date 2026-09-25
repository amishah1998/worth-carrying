import test from "node:test";
import assert from "node:assert/strict";
import { parseSpec, ruleCheck, matchListings } from "../src/match.js";

test("parseSpec reads size and concentration from titles", () => {
  assert.deepEqual(parseSpec("Dior Sauvage Eau de Parfum 100ml").conc, "edp");
  assert.equal(parseSpec("Dior Sauvage Eau de Parfum 100ml").ml, 100);
  assert.equal(parseSpec("Dior Sauvage Eau De Toilette 100ml").conc, "edt");
  assert.equal(parseSpec("Dior Sauvage Parfum 100ml").conc, "parfum");
  assert.equal(parseSpec("DIOR Sauvage Elixir Spray (100ml)").conc, "parfum");
  assert.equal(parseSpec("American Tourister Curio Spinner 67 cm").cm, 67);
  assert.equal(parseSpec("Apple Watch Series 11 GPS 46mm Aluminium").mm, 46);
  assert.equal(parseSpec("Refurbished Apple Watch Series 11 (46mm)").used, true);
});

test("ruleCheck rejects the wrong variant and the wrong size", () => {
  const q = "Dior Sauvage EDP 100ml";
  assert.equal(ruleCheck(q, { title: "Dior Sauvage Eau De Toilette 100ml" }).verdict, "reject");
  assert.equal(ruleCheck(q, { title: "Dior Sauvage Eau de Parfum|60ml" }).verdict, "reject");
  assert.equal(ruleCheck(q, { title: "DIOR Sauvage Elixir Spray (100ml)" }).verdict, "reject");
  assert.equal(ruleCheck(q, { title: "Giorgio Armani Acqua di Gio Profondo Eau de Parfum 100ml" }).verdict, "reject");
  assert.equal(ruleCheck(q, { title: "Dior Sauvage Eau de Parfum|100ml (Original)" }).verdict, "keep");
  assert.equal(ruleCheck("American Tourister Curio 79cm", { title: "American Tourister Curio Spinner 67 cm Turquoise" }).verdict, "reject");
  assert.equal(ruleCheck("JBL Flip 7", { title: "JBL Flip 7 Portable Waterproof Bluetooth Speaker" }).verdict, "unsure");
  assert.equal(ruleCheck("JBL Flip 7", { title: "Refurbished JBL Flip 7" }).verdict, "reject");
});

test("elixir stays distinct from eau de parfum even when the box says both", () => {
  assert.equal(parseSpec("Dior Sauvage Elixir 100ml Eau de Parfum").conc, "parfum");
  assert.equal(parseSpec("Dior Sauvage Eau de Parfum For Men 100ml").conc, "edp");
});

test("pack weights are read, and a generic query compares per 100 g instead of rejecting other packs", async () => {
  assert.equal(parseSpec("Roasted Californian Almonds 500 g").grams, 500);
  assert.equal(parseSpec("Happilo Almonds 1kg").grams, 1000);
  assert.equal(ruleCheck("Happilo almonds 200g", { title: "Happilo Almonds 500 g" }).verdict, "reject");
  assert.equal(ruleCheck("almonds roasted", { title: "Roasted Californian Almonds 500 g" }, { generic: true }).verdict, "unsure");
  assert.equal(ruleCheck("almonds roasted", { title: "Indian Kitchen Roasted Salted Almond 250g" }, { generic: true }).verdict, "unsure");
  const r = await matchListings("almonds roasted", [
    { title: "Roasted Californian Almonds 500 g", price: 650, seller: "SnaXup" },
    { title: "Wonderland Roasted & Salted Almonds 200g", price: 221, seller: "JioMart Grocery" },
    { title: "Happilo Premium Californian Almonds Roasted And Salted", price: 351, seller: "Flipkart" },
  ], { apiKey: null });
  assert.equal(r.generic, true);
  assert.equal(r.kept.length, 3);
  assert.equal(r.kept[0].per100, 130);
  assert.equal(r.kept[1].per100, 110.5);
  assert.equal(r.kept[2].per100, null);
});

test("decants, samples and minis are rejected even when the title also carries the full size", () => {
  const q = "Dior Sauvage EDP 100ml";
  assert.equal(ruleCheck(q, { title: "Dior Sauvage Eau De Parfum For Men 100ml 10ml Decant" }).verdict, "reject");
  assert.equal(ruleCheck(q, { title: "Dior Sauvage EDP 2ml Sample Vial" }).verdict, "reject");
  assert.equal(ruleCheck(q, { title: "Dior Sauvage Eau de Parfum 100ml Travel Size Mini" }).verdict, "reject");
  assert.equal(ruleCheck("Dior Sauvage EDP 10ml decant", { title: "Dior Sauvage EDP 10ml Decant" }).verdict, "keep");
});

test("import resellers and suspiciously cheap listings are rejected by rule", async () => {
  const r = await matchListings("Dior Sauvage EDP 100ml", [
    { title: "Dior Sauvage Eau de Parfum 100ml", price: 15600, seller: "Nykaa" },
    { title: "Dior Sauvage Eau de Parfum 100ml", price: 16999, seller: "GottaGo.in" },
    { title: "Dior Sauvage Eau de Parfum 100ml", price: 14200, seller: "Sephora India" },
    { title: "Dior Sauvage Eau de Parfum 100ml", price: 22000, seller: "desertcart.in" },
    { title: "CHRISTIAN DIOR - Sauvage Eau de Parfum Spray 100ml", price: 1999, seller: "Amazon.in" },
  ], { apiKey: null });
  assert.deepEqual(r.kept.map((k) => k.seller), ["Nykaa", "GottaGo.in", "Sephora India"]);
  assert.match(r.rejected.find((x) => x.seller === "desertcart.in").reason, /imports/);
  assert.match(r.rejected.find((x) => x.price === 1999).reason, /clone/);
});

test("without a model key, every word of the query must appear in the title", async () => {
  const r = await matchListings("JBL Flip 7", [
    { title: "JBL Flip 7 Portable Bluetooth Speaker", price: 12999, seller: "Amazon.in" },
    { title: "JBL Flip 6 Portable Bluetooth Speaker", price: 8999, seller: "Amazon.in" },
    { title: "Refurbished JBL Flip 7", price: 7999, seller: "Cashify" },
    { title: "JBL फ्लिप 7 पोर्टेबल स्पीकर", price: 12999, seller: "amazon.in" },
  ], { apiKey: null });
  assert.equal(r.jevUsed, false);
  assert.deepEqual(r.kept.map((k) => k.price), [12999]);
  assert.equal(r.rejected.find((x) => x.price === 8999).reason, "does not mention 7");
  assert.equal(r.rejected.find((x) => x.price === 7999).reason, "used or refurbished");
});

test("without a model key, brand queries reject other lines and clones by word coverage", async () => {
  const q = "Dior Sauvage EDP 100ml";
  const r = await matchListings(q, [
    { title: "Dior Sauvage Eau de Parfum For Men 100ml", price: 16999, seller: "GottaGo.in" },
    { title: "Dior Sauvage Eau de Parfum", price: 15600, seller: "nykaa.com" },
    { title: "Dior Homme Intense Eau de Parfum 100ml", price: 14170, seller: "GottaGo.in" },
    { title: "Mens Diorr Sauvaage Eau De Parfum 100ml", price: 2184, seller: "amazon.in" },
    { title: "Apple Watch Series 11 GPS 46mm Jet Black", price: 46490, seller: "Vijay Sales" },
  ], { apiKey: null });
  assert.deepEqual(r.kept.map((k) => k.price), [16999, 15600]);
  assert.match(r.rejected.find((x) => x.price === 14170).reason, /sauvage/);
  const w = await matchListings("Apple Watch Series 11 46mm", [
    { title: "Apple Watch Series 11 GPS 46mm Jet Black Aluminium", price: 46490, seller: "Vijay Sales" },
    { title: "Apple Watch Series 11 GPS 42mm Silver", price: 43490, seller: "Vijay Sales" },
    { title: "Apple watches", price: 16000, seller: "TechStorm Gadgets" },
  ], { apiKey: null });
  assert.deepEqual(w.kept.map((k) => k.price), [46490]);
});
