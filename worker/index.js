import countriesFile from "../src/countries.json" with { type: "json" };
import guides from "../src/guides.json" with { type: "json" };
import { createApi } from "../src/api.js";
import { useGuides } from "../src/guides.js";
import { openD1Recorder } from "../src/recorder-d1.js";

useGuides(guides);
let api = null;

// Files in public/ are served as static assets before this runs, so only /api/ and unknown paths reach it.
// Daily re-check and the weekly sale-date search need timers and do not run here.
export default {
  async fetch(request, env) {
    if (!api) {
      // Bindings arrive with the first request. The shared modules read keys from process.env,
      // as they do under Node, so string bindings (vars and secrets) are copied there once.
      for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
      api = createApi({ countries: countriesFile.countries, recorder: env.DB ? openD1Recorder(env.DB) : null, env: process.env });
    }
    if (!new URL(request.url).pathname.startsWith("/api/")) return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    return api(request, { ip: request.headers.get("cf-connecting-ip") || "?" });
  },
};
