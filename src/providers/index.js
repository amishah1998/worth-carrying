import { searchSerper } from "./serper.js";
import { searchSerpApi } from "./serpapi.js";
import { searchChrome } from "./chrome.js";

export const PROVIDERS = { serper: searchSerper, serpapi: searchSerpApi, chrome: searchChrome };

// Order of preference: an explicit PRICE_PROVIDER, else whichever key exists, else the dev Chrome.
export function pickProvider(env = process.env) {
  if (env.PRICE_PROVIDER && PROVIDERS[env.PRICE_PROVIDER]) return env.PRICE_PROVIDER;
  if (env.SERPER_API_KEY) return "serper";
  if (env.SERPAPI_API_KEY) return "serpapi";
  return "chrome";
}

export async function searchIndia(query, opts = {}) {
  const name = opts.provider || pickProvider();
  const fn = PROVIDERS[name];
  if (!fn) throw new Error(`unknown price provider ${name}`);
  const listings = await fn(query, opts);
  return { provider: name, listings };
}
