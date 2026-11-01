import { parsePrice } from "../util.js";

// Development-only provider: drives a Chrome that is already running with
// --remote-debugging-port=9222 and reads the Google Shopping page as a person would.
// It needs no API key, which makes local testing free, but it is not for hosting:
// Google blocks headless and server traffic, and this reads a page, not an API.
const CANDIDATES = [process.env.CHROME_DEBUG_URL, "http://localhost:9222", "http://localhost:9223"].filter(Boolean);

async function debugBase() {
  for (const base of CANDIDATES) {
    try { const r = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(1500) }); if (r.ok) return base; } catch {}
  }
  throw new Error("no debug Chrome on " + CANDIDATES.join(" or ") + "; start one with --remote-debugging-port, or set SERPAPI_API_KEY or SERPER_API_KEY");
}

const NOISE = /^(sponsored|sale|low price|also nearby|nearby|free delivery|special offer|refurbished|pre-owned|price|under|over|was|usually|\d+% off|& more|free by|\(?[$€£])/i;
const BARE_NUMBER = /^[\d,]+(?:\.\d+)?$/;

function rpc(ws) {
  let id = 0;
  return (method, params = {}) => new Promise((res) => {
    const i = ++id;
    ws.addEventListener("message", function h(e) {
      const d = JSON.parse(e.data);
      if (d.id === i) { ws.removeEventListener("message", h); res(d.result); }
    });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  return ws;
}

export async function searchChrome(query, { gl = "in", hl = "en" } = {}) {
  const BASE = await debugBase();
  // A background target never takes focus from whatever the person is reading.
  // /json/new would, so the tab is created through the browser-level connection instead.
  const version = await (await fetch(`${BASE}/json/version`)).json();
  const bws = await connect(version.webSocketDebuggerUrl);
  const bcall = rpc(bws);
  const { targetId } = await bcall("Target.createTarget", { url: "about:blank", background: true });
  const wsUrl = version.webSocketDebuggerUrl.replace(/\/devtools\/browser\/.*$/, `/devtools/page/${targetId}`);
  const ws = await connect(wsUrl);
  const call = rpc(ws);
  try {
    const url = `https://www.google.com/search?udm=28&hl=${hl}&gl=${gl}&q=${encodeURIComponent(query)}`;
    await call("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 4500));
    const r = await call("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const text = document.body.innerText;
        const links = [...document.querySelectorAll('a[href]')].map(a => ({ t: (a.innerText || '').trim().slice(0, 160), h: a.href })).filter(a => a.t && /amazon\\.in|flipkart|myntra|nykaa|croma|reliancedigital|tatacliq|ajio|sephora|tira/i.test(a.h));
        return JSON.stringify({ text, links: links.slice(0, 200), blocked: /unusual traffic|not a robot/i.test(text) });
      })()`,
    });
    const page = JSON.parse(r?.result?.value || "{}");
    if (page.blocked) throw new Error("Google served its unusual-traffic page");
    return parseShoppingText(page.text || "", page.links || []);
  } finally {
    await bcall("Target.closeTarget", { targetId }).catch(() => {});
    ws.close();
    bws.close();
  }
}

// Google Shopping renders one listing as a run of lines: title, price, optional badge, seller.
// This walks the visible text around every rupee line. Good enough for development.
export function parseShoppingText(text, links = []) {
  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^₹\s?[\d,]+/.test(lines[i])) continue;
    const price = parsePrice(lines[i]);
    if (!price || price < 50) continue;
    let title = null;
    for (let k = i - 1; k >= Math.max(0, i - 3); k--) {
      const c = lines[k];
      if (/^₹/.test(c) || NOISE.test(c) || /^\d+(\.\d+)?\(\d/.test(c) || c.length < 6) continue;
      title = c; break;
    }
    let seller = null, mrp = null;
    for (let k = i + 1; k <= Math.min(lines.length - 1, i + 3); k++) {
      const c = lines[k];
      const m = c.match(/(?:usually|was|off)\s*₹\s?([\d,]+)/i);
      if (m) { mrp = parsePrice(m[1]); continue; }
      if (BARE_NUMBER.test(c)) { mrp = mrp ?? parsePrice(c); continue; }
      if (/^₹/.test(c) || /^\d+(\.\d+)?\(\d/.test(c) || /^\(?\$/.test(c) || NOISE.test(c)) continue;
      seller = c.replace(/\s*&\s*more$/i, "").trim(); break;
    }
    if (!title || !seller) continue;
    const link = links.find((l) => l.t && title.toLowerCase().startsWith(l.t.toLowerCase().slice(0, 40)));
    const asin = (link?.h || "").match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)?.[1] || null;
    out.push({ title, price, mrp, seller, url: link?.h || null, asin, rating: null, source: "chrome" });
  }
  const seen = new Set();
  return out.filter((l) => { const k = l.title + "|" + l.seller + "|" + l.price; if (seen.has(k)) return false; seen.add(k); return true; });
}
