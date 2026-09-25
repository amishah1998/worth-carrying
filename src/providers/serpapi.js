import { fetchJson, parsePrice } from "../util.js";
import { asinFrom } from "./serper.js";

// SerpApi google_shopping. 250 free searches a month. Same shape out as the other providers.
export async function searchSerpApi(query, { apiKey = process.env.SERPAPI_API_KEY, gl = "in", hl = "en" } = {}) {
  if (!apiKey) throw new Error("SERPAPI_API_KEY is not set");
  const u = new URL("https://serpapi.com/search.json");
  u.search = new URLSearchParams({ engine: "google_shopping", q: query, gl, hl, api_key: apiKey }).toString();
  const body = await fetchJson(u.toString());
  const rows = body?.shopping_results || [];
  return rows.map((r) => ({
    title: r.title || "",
    price: r.extracted_price ?? parsePrice(r.price),
    mrp: r.extracted_old_price ?? parsePrice(r.old_price) ?? null,
    seller: r.source || "",
    url: r.link || r.product_link || null,
    asin: asinFrom(r.link),
    rating: r.rating ?? null,
    source: "serpapi",
  })).filter((l) => l.title && l.price);
}
