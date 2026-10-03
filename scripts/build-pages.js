import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const value = process.env.API_BASE_URL;
if (!value) throw new Error("Set API_BASE_URL to the HTTPS URL of the Node backend.");
const api = new URL(value);
if (api.protocol !== "https:" || api.username || api.password || api.search || api.hash || api.pathname !== "/") {
  throw new Error("API_BASE_URL must be an HTTPS origin, without credentials, a path, or query parameters.");
}
const domain = process.env.PAGES_DOMAIN || "";
if (domain && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
  throw new Error("PAGES_DOMAIN must be a hostname.");
}
const destination = path.join(root, "dist");
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(path.join(root, "public"), destination, { recursive: true });
fs.writeFileSync(path.join(destination, "config.js"), "window.WORTH_CARRYING = " + JSON.stringify({ apiBase: api.origin }) + ";\n");
fs.writeFileSync(path.join(destination, ".nojekyll"), "");
if (domain) fs.writeFileSync(path.join(destination, "CNAME"), domain + "\n");
console.log("Static site built in dist. The backend URL is public; API keys stay on the server.");
