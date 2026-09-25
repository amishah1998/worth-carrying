// Entry file for hosts that start a Node app by file name (Hostinger's web apps, most PaaS).
// The port comes from the host through PORT; keys come from the dashboard's environment variables.
import { createServer } from "./src/server.js";

createServer();
