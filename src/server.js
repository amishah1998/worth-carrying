import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi, API_BODY_LIMIT } from "./api.js";
import { openRecorder } from "./recorder.js";
import { recheck } from "./history.js";
import { pickProvider, searchIndia } from "./providers/index.js";
import { matchListings } from "./match.js";
import { isTrusted } from "./verdict.js";
import { refreshSales } from "./sales.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "..", "public");
const COUNTRIES = JSON.parse(fs.readFileSync(path.join(here, "countries.json"), "utf8")).countries;

const STATIC = { "/manifest.json": "application/manifest+json", "/sw.js": "application/javascript", "/app.js": "application/javascript", "/config.js": "application/javascript", "/app.css": "text/css", "/icon.svg": "image/svg+xml", "/icon-192.png": "image/png", "/icon-512.png": "image/png" };

export function createServer({ port = Number(process.env.PORT) || 8787, dailyCap = Number(process.env.DAILY_CAP) || 300, ipHourlyCap = Number(process.env.IP_HOURLY_CAP) || 30, recorder = openRecorder(), webOrigins = process.env.WEB_ORIGINS || "" } = {}) {
  const api = createApi({ countries: COUNTRIES, recorder, dailyCap, ipHourlyCap, webOrigins });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/")) return writeResponse(res, await api(await toRequest(req), { ip: clientIp(req) }));
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return send(res, 200, fs.readFileSync(path.join(PUBLIC, "index.html")), "text/html; charset=utf-8");
    if (req.method === "GET" && STATIC[url.pathname]) {
      const file = path.join(PUBLIC, url.pathname);
      if (!fs.existsSync(file)) return send(res, 404, "not found", "text/plain");
      return send(res, 200, fs.readFileSync(file), STATIC[url.pathname]);
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

async function toRequest(req) {
  let base = "http://localhost";
  try { base = new URL("http://" + req.headers.host).origin; } catch {}
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  // An oversized body becomes an empty one, which the API answers as bad JSON.
  const body = req.method === "POST" ? await readBody(req, API_BODY_LIMIT).catch(() => "") : undefined;
  const { pathname, search } = new URL(req.url, "http://x");
  return new Request(new URL(pathname + search, base), { method: req.method, headers, body });
}

async function writeResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function clientIp(req) {
  return (req.headers["fly-client-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString().split(",")[0].trim();
}
function send(res, code, body, type) { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); }
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
