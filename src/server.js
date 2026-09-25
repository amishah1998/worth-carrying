import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./check.js";
import { openRecorder } from "./history.js";
import { queryFromPhoto } from "./vision.js";
import { pickProvider } from "./providers/index.js";
import { CURRENCIES, rateToInr } from "./fx.js";
import { getGuide, listCountries } from "./guides.js";
import { recheck } from "./history.js";
import { searchIndia } from "./providers/index.js";
import { matchListings } from "./match.js";
import { isTrusted } from "./verdict.js";
import { upcomingSales, refreshSales } from "./sales.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "..", "public");
const COUNTRIES = JSON.parse(fs.readFileSync(path.join(here, "countries.json"), "utf8")).countries;

const STATIC = { "/manifest.json": "application/manifest+json", "/sw.js": "application/javascript", "/icon.svg": "image/svg+xml", "/icon-192.png": "image/png", "/icon-512.png": "image/png" };

export function createServer({ port = Number(process.env.PORT) || 8787, dailyCap = Number(process.env.DAILY_CAP) || 300, ipHourlyCap = Number(process.env.IP_HOURLY_CAP) || 30, recorder = openRecorder() } = {}) {
  let day = today(), used = 0;
  const perIp = new Map();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return send(res, 200, fs.readFileSync(path.join(PUBLIC, "index.html")), "text/html; charset=utf-8");
    if (req.method === "GET" && STATIC[url.pathname]) {
      const file = path.join(PUBLIC, url.pathname);
      if (!fs.existsSync(file)) return send(res, 404, "not found", "text/plain");
      return send(res, 200, fs.readFileSync(file), STATIC[url.pathname]);
    }
    // The converter: today's rate for one currency, cached a day, so the page can show rupees as you type.
    if (req.method === "GET" && url.pathname === "/api/fx") {
      const from = String(url.searchParams.get("from") || "").toUpperCase();
      if (!/^[A-Z]{3}$/.test(from)) return json(res, 400, { error: "from must be a 3-letter currency code" });
      try { return json(res, 200, { from, ...(await rateToInr(from)) }); } catch (err) { return json(res, 502, { error: err.message }); }
    }
    if (req.method === "GET" && url.pathname === "/api/guide") {
      const g = getGuide(url.searchParams.get("country"));
      return g ? json(res, 200, g) : json(res, 404, { error: "no guide for that country yet" });
    }
    if (req.method === "GET" && url.pathname === "/api/config") {
      const withGuide = new Set(listCountries().map((c) => c.code));
      const countries = COUNTRIES.map((c) => ({ ...c, guide: withGuide.has(c.code) }));
      return json(res, 200, { provider: pickProvider(), currencies: CURRENCIES, countries, sales: upcomingSales(), photo: Boolean(process.env.ANTHROPIC_API_KEY), history: process.env.KEEPA_API_KEY ? "keepa" : "own", jev: Boolean(process.env.TYPESAFE_API_KEY), dailyCap, usedToday: used });
    }
    if (req.method === "POST" && url.pathname === "/api/check") {
      if (today() !== day) { day = today(); used = 0; }
      if (used >= dailyCap) return json(res, 429, { error: `Daily cap of ${dailyCap} lookups reached; try tomorrow` });
      const ip = (req.headers["fly-client-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString().split(",")[0].trim();
      const hour = Math.floor(Date.now() / 3600000);
      const slot = perIp.get(ip);
      if (slot && slot.hour === hour && slot.n >= ipHourlyCap) return json(res, 429, { error: `Slow down: ${ipHourlyCap} lookups an hour per device` });
      perIp.set(ip, slot && slot.hour === hour ? { hour, n: slot.n + 1 } : { hour, n: 1 });
      if (perIp.size > 5000) for (const [k, v] of perIp) if (v.hour !== hour) perIp.delete(k);
      let body;
      try { body = JSON.parse(await readBody(req, 8 * 1024 * 1024)); } catch { return json(res, 400, { error: "bad JSON" }); }
      try {
        let query = body.query, photo = null;
        if (!query && body.image) {
          photo = await queryFromPhoto({ base64: body.image, mediaType: body.mediaType || "image/jpeg" });
          if (!photo?.query) return json(res, 422, { error: process.env.ANTHROPIC_API_KEY ? "Could not read the product from the photo; type its name" : "Photo lookup needs ANTHROPIC_API_KEY on the server" });
          query = photo.query;
        }
        used++;
        const out = await check({ query, price: Number(body.price) || null, currency: body.currency || "AED", country: body.country || "AE", tripTotalInr: Number(body.tripTotalInr) || 0, recorder });
        return json(res, 200, { ...out, photo });
      } catch (err) {
        return json(res, 502, { error: err.message });
      }
    }
    send(res, 404, "not found", "text/plain");
  });
  server.listen(port, () => console.log(`worth-carrying on http://localhost:${port}  provider=${pickProvider()}  history=${process.env.KEEPA_API_KEY ? "keepa+own" : "own"}  photo=${process.env.ANTHROPIC_API_KEY ? "on" : "off"}`));
  // Daily re-pricing of everything looked up, so the own history fills in for every store.
  // Not with the development Chrome, which would open a tab per product on the person's screen.
  const hours = Number(process.env.RECHECK_HOURS ?? 24);
  if (hours > 0 && pickProvider() !== "chrome") {
    const run = async () => {
      const r = await recheck(recorder, { search: (q) => searchIndia(q), match: (q, l) => matchListings(q, l, { apiKey: process.env.TYPESAFE_API_KEY }), isTrusted, log: console.error });
      console.log(`recheck: ${r.done} of ${r.items} products re-priced`);
    };
    setTimeout(run, 60 * 1000).unref();
    setInterval(run, hours * 3600 * 1000).unref();
  }
  // Weekly: look for this year's sale dates on the web; a date is taken only when two sites agree.
  if (process.env.SERPER_API_KEY && Number(process.env.SALES_REFRESH_DAYS ?? 7) > 0) {
    const days = Number(process.env.SALES_REFRESH_DAYS ?? 7);
    const run = () => refreshSales({ log: console.error }).then((s) => console.log(`sales: ${Object.keys(s.sales).length} confirmed`)).catch((e) => console.error(`sales: ${e.message}`));
    setTimeout(run, 2 * 60 * 1000).unref();
    setInterval(run, days * 86400 * 1000).unref();
  }
  return server;
}

function today() { return new Date().toISOString().slice(0, 10); }
function send(res, code, body, type) { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); }
function json(res, code, obj) { send(res, code, JSON.stringify(obj), "application/json; charset=utf-8"); }
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
