import { fetchJson } from "./util.js";

export const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One request, many yes/no answers. Jev returns probabilities, never text.
export async function askJev({ state, questions, apiKey = process.env.TYPESAFE_API_KEY, model = "jev-latest", retries = 2 }) {
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set");
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchJson(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, state, questions }),
      });
    } catch (err) {
      const retryable = err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!retryable || attempt >= retries) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}
