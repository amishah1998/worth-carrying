import { check } from "./check.js";
import { queryFromPhoto } from "./vision.js";
import { pickProvider } from "./providers/index.js";
import { CURRENCIES, rateToInr } from "./fx.js";
import { getGuide, listCountries } from "./guides.js";
import { upcomingSales } from "./sales.js";

export const API_BODY_LIMIT = 8 * 1024 * 1024;

// The /api/ routes as a fetch handler (Request in, Response out), so the Node server and the
// Cloudflare Worker run the same code. Caps live in memory: on Workers they count per instance.
export function createApi({ countries, recorder = null, env = process.env, dailyCap = Number(env.DAILY_CAP) || 300, ipHourlyCap = Number(env.IP_HOURLY_CAP) || 30, webOrigins = env.WEB_ORIGINS || "" }) {
  const allowedOrigins = new Set(webOrigins.split(",").map((origin) => origin.trim()).filter(Boolean));
  // Common currencies first, then every other currency a listed country uses, so the pick always lands.
  const allCurrencies = [...new Set([...CURRENCIES, ...countries.map((c) => c.currency).filter(Boolean).sort()])];
  let day = today(), used = 0;
  const perIp = new Map();

  return async function handle(request, { ip = "?" } = {}) {
    const url = new URL(request.url);
    const headers = { Vary: "Origin" };
    const origin = request.headers.get("origin");
    let sameHost = false;
    try { sameHost = new URL(origin).host === url.host; } catch {}
    if (origin && !sameHost && !allowedOrigins.has(origin)) return json(403, { error: "Origin not allowed" }, headers);
    if (origin && allowedOrigins.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    // The converter: today's rate for one currency, cached a day, so the page can show rupees as you type.
    if (request.method === "GET" && url.pathname === "/api/fx") {
      const from = String(url.searchParams.get("from") || "").toUpperCase();
      if (!/^[A-Z]{3}$/.test(from)) return json(400, { error: "from must be a 3-letter currency code" }, headers);
      try { return json(200, { from, ...(await rateToInr(from)) }, headers); } catch (err) { return json(502, { error: err.message }, headers); }
    }
    if (request.method === "GET" && url.pathname === "/api/guide") {
      const g = getGuide(url.searchParams.get("country"));
      return g ? json(200, g, headers) : json(404, { error: "no guide for that country yet" }, headers);
    }
    if (request.method === "GET" && url.pathname === "/api/config") {
      const withGuide = new Set(listCountries().map((c) => c.code));
      const list = countries.map((c) => ({ ...c, guide: withGuide.has(c.code) }));
      return json(200, { provider: pickProvider(env), currencies: allCurrencies, countries: list, sales: upcomingSales(), photo: Boolean(env.ANTHROPIC_API_KEY), history: env.KEEPA_API_KEY ? "keepa" : "own", jev: Boolean(env.TYPESAFE_API_KEY), dailyCap, usedToday: used }, headers);
    }
    if (request.method === "POST" && url.pathname === "/api/check") {
      if (today() !== day) { day = today(); used = 0; }
      if (used >= dailyCap) return json(429, { error: `Daily cap of ${dailyCap} lookups reached; try tomorrow` }, headers);
      const hour = Math.floor(Date.now() / 3600000);
      const slot = perIp.get(ip);
      if (slot && slot.hour === hour && slot.n >= ipHourlyCap) return json(429, { error: `Slow down: ${ipHourlyCap} lookups an hour per device` }, headers);
      perIp.set(ip, slot && slot.hour === hour ? { hour, n: slot.n + 1 } : { hour, n: 1 });
      if (perIp.size > 5000) for (const [k, v] of perIp) if (v.hour !== hour) perIp.delete(k);
      let body;
      try {
        const text = await request.text();
        if (text.length > API_BODY_LIMIT) throw new Error("too large");
        body = JSON.parse(text);
      } catch { return json(400, { error: "bad JSON" }, headers); }
      try {
        let query = body.query, photo = null;
        if (!query && body.image) {
          photo = await queryFromPhoto({ base64: body.image, mediaType: body.mediaType || "image/jpeg" });
          if (!photo?.query) return json(422, { error: env.ANTHROPIC_API_KEY ? "Could not read the product from the photo; type its name" : "Photo lookup needs ANTHROPIC_API_KEY on the server" }, headers);
          query = photo.query;
        }
        used++;
        const out = await check({ query, price: Number(body.price) || null, currency: body.currency || "AED", country: body.country || "AE", tripTotalInr: Number(body.tripTotalInr) || 0, recorder, env });
        return json(200, { ...out, photo }, headers);
      } catch (err) {
        return json(502, { error: err.message }, headers);
      }
    }
    return new Response("not found", { status: 404, headers: { ...headers, "content-type": "text/plain", "cache-control": "no-store" } });
  };
}

function today() { return new Date().toISOString().slice(0, 10); }
function json(status, obj, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
