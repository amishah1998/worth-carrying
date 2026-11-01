import test from "node:test";
import assert from "node:assert/strict";
import { queryFromPhoto } from "../src/vision.js";

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".repeat(2);

test("no key means no call and a null result", async () => {
  let called = false;
  const r = await queryFromPhoto({ base64: PIXEL, apiKey: null, fetchImpl: async () => { called = true; } });
  assert.equal(r, null);
  assert.equal(called, false);
});

test("the request carries the image and the JSON reply is parsed", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init: JSON.parse(init.body), headers: init.headers };
    return { content: [{ type: "text", text: 'Here you go:\n{"brand":"Dior","product":"Sauvage","variant":"EDP","size":"100ml","query":"Dior Sauvage EDP 100ml","confidence":0.92}' }] };
  };
  const r = await queryFromPhoto({ base64: PIXEL, mediaType: "image/png", apiKey: "k", model: "claude-opus-5", fetchImpl });
  assert.equal(sent.url, "https://api.anthropic.com/v1/messages");
  assert.equal(sent.headers["x-api-key"], "k");
  assert.equal(sent.init.model, "claude-opus-5");
  const img = sent.init.messages[0].content.find((c) => c.type === "image");
  assert.equal(img.source.media_type, "image/png");
  assert.equal(img.source.data, PIXEL);
  assert.deepEqual(r, { brand: "Dior", product: "Sauvage", variant: "EDP", size: "100ml", query: "Dior Sauvage EDP 100ml", confidence: 0.92 });
});

test("an unreadable reply, an empty photo and a bad type are handled", async () => {
  assert.equal(await queryFromPhoto({ base64: PIXEL, apiKey: "k", fetchImpl: async () => ({ content: [{ type: "text", text: "cannot tell" }] }) }), null);
  await assert.rejects(queryFromPhoto({ base64: "", apiKey: "k", fetchImpl: async () => ({}) }), /empty/);
  await assert.rejects(queryFromPhoto({ base64: PIXEL, mediaType: "image/heic", apiKey: "k", fetchImpl: async () => ({}) }), /unsupported/);
});
