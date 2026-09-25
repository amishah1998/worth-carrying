import { fetchJson, parsePrice } from "../util.js";

// Serper.dev Google Shopping. 2,500 free queries on signup, then about a dollar per 1,000.
// Field names follow Serper's shopping response; anything missing is left null.
export async function searchSerper(query, { apiKey = process.env.SERPER_API_KEY, gl = "in", hl = "en", num = 20 } = {}) {
  if (!apiKey) throw new Error("SERPER_API_KEY is not set");
  const body = await fetchJson("https://google.serper.dev/shopping", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl, hl, num }),
  });
  const rows = body?.shopping || body?.results || [];
  return rows.map((r) => ({
    title: r.title || "",
    price: parsePrice(r.price),
    mrp: parsePrice(r.previousPrice || r.originalPrice) || null,
    seller: r.source || r.seller || "",
    url: r.link || r.productLink || null,
    asin: asinFrom(r.link),
    rating: r.rating ?? null,
    source: "serper",
  })).filter((l) => l.title && l.price);
}

export function asinFrom(url) {
  const m = String(url || "").match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  return m ? m[1] : null;
}
