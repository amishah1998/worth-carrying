import { fetchJson } from "./util.js";

const PROMPT = 'Identify the product in this photo for a price search in India. Reply with JSON only: {"brand":"","product":"","variant":"","size":"","query":"","confidence":0.0}. variant is the concentration (EDP, EDT, Parfum) or the model tier; size is ml, cm, mm or GB with the unit; query is the shortest search string a shop would understand, for example "Dior Sauvage EDP 100ml". confidence is 0 to 1. If the label is unreadable, set confidence under 0.4.';

// A shelf photo becomes a search query. Claude reads the label, which is where the
// concentration and the size are printed. Returns null when no key is configured.
export async function queryFromPhoto({ base64, mediaType = "image/jpeg", apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.VISION_MODEL || "claude-opus-5" }) {
  if (!apiKey) return null;
  const payload = {
    model,
    max_tokens: 300,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: PROMPT },
      ],
    }],
  };
  const body = await fetchJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  }, { timeoutMs: 40000 });
  const text = body?.content?.find((c) => c.type === "text")?.text || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
