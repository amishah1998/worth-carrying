export async function fetchJson(url, init = {}, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) {
      const err = new Error(`${init.method || "GET"} ${url.split("?")[0]} returned ${res.status}`);
      err.status = res.status; err.body = body;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// "₹12,999", "₹ 1,00,584", "₹9,321.71", "Rs. 12999" and "12999" all become 12999-ish numbers.
export function parsePrice(text) {
  if (typeof text === "number") return text;
  if (!text) return null;
  const m = String(text).replace(/[₹]|rs\.?|inr/gi, "").match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function inr(n) {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function median(nums) {
  const a = nums.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function normalizeQuery(q) {
  return String(q || "")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s*(ml|cm|mm|gb|tb|inch|in)\b/gi, "$1$2")
    .trim();
}
