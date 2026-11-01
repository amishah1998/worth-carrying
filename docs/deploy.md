# Running it as a website and a phone app

The web page is already a phone app. Open the site on a phone, choose "Add to Home Screen", and it installs with an icon, opens full screen, and keeps its shell cached for weak roaming data. Lookups always go to the network.

A hosted copy needs a price key (a search key, not a model key: SerpApi's free plan gives 250 searches a month, Serper gives 2,500 once) and, for price history, a place that survives restarts: a folder on disk for the Node server, or Cloudflare D1 for the Worker. No model key is needed; Jev, Keepa and the photo reader are optional extras.

## GitHub Pages interface and a separate backend

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) serves static files. It cannot run this app's Node server, SQLite recorder or price-search requests. Host the backend on a Node or Docker host and the interface on Pages. API keys stay in the backend's environment.

1. Deploy the backend with a price-search key: the free [Cloudflare Worker](#cloudflare-worker-backend-the-free-route), or a Node server from the options further down.
2. Set the backend's `WEB_ORIGINS` to the exact HTTPS origin of the interface, such as `https://worth-carry.aidojo.si`. Separate multiple origins with commas. Add the account's Pages origin if you also use the default Pages address.
3. In the interface repository, set the Actions variable `API_BASE_URL` to the backend's HTTPS origin. It must have no path or credentials. This variable is public and must never contain an API key.
4. Set the Actions variable `PAGES_DOMAIN` to the custom hostname, or leave it unset for a default Pages address.
5. In Settings → Pages, select GitHub Actions as the publishing source and add the custom domain.
6. Run the **Publish mobile web app** workflow manually from the default branch. It runs tests, builds the interface and publishes the `dist` artifact.
7. Configure DNS after adding the domain in Pages settings. For a subdomain, create a CNAME to the account's `<username>.github.io` hostname, without a repository path.
8. Enable **Enforce HTTPS** after the domain check and certificate finish.

For an interface hosted under `amishah1998` with the hostname `worth-carry.aidojo.si`:

| Configuration | Value |
|---|---|
| DNS record type | CNAME |
| DNS name | `worth-carry` |
| DNS target | `amishah1998.github.io` |
| Pages custom domain | `worth-carry.aidojo.si` |
| Actions `PAGES_DOMAIN` | `worth-carry.aidojo.si` |
| Backend `WEB_ORIGINS` | `https://worth-carry.aidojo.si` |

[GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) describe the DNS order and HTTPS setup. A private Pages source needs a supported paid GitHub plan. Do not make a private repository public just to enable Pages.

To build the static files locally:

```sh
API_BASE_URL=https://backend.example.com PAGES_DOMAIN=worth-carry.aidojo.si npm run build:pages
```

Replace the example backend with the deployed server's address. Without a running backend, the interface shows a reconnect message instead of a working comparison. Offline caching retains the interface, never live prices. The Pages workflow runs only when manually started.

## Cloudflare Worker backend, the free route

The API also runs as a [Cloudflare Worker](https://developers.cloudflare.com/workers/) on the free plan, with the interface on GitHub Pages. With SerpApi's free plan as the price search, it costs nothing to run. `wrangler.toml` holds the settings, and the npm scripts pin the Wrangler version.

1. Create a free Cloudflare account, then sign in from this folder: `npm run worker -- login`.
2. For price history on your own account, run `npm run worker -- d1 create worth-carrying` and replace the `database_id` in the `[[d1_databases]]` block in `wrangler.toml` with the printed one. The table is created on first use. To run without history, delete the block; lookups still work and the card shows no history of its own.
3. Add the price key as a secret, never in `wrangler.toml`: `npm run worker -- secret put SERPAPI_API_KEY`.
4. Set `WEB_ORIGINS` in `wrangler.toml` to the interface's HTTPS origin.
5. Deploy with `npm run worker:deploy`. Wrangler prints the Worker's address, `https://worth-carrying.<your-subdomain>.workers.dev`; use it as `API_BASE_URL` for the Pages build above.

To try it locally first, put the key in `.dev.vars` (`SERPAPI_API_KEY=...`, ignored by git) and run `npm run worker:dev`.

How it differs from the Node server:

- The daily re-check and the weekly sale-date search do not run, because they need timers. History grows from lookups only, and the card uses the hand-checked sale dates in `src/sales.js`.
- `DAILY_CAP` and `IP_HOURLY_CAP` count per Worker instance, not across all of them. On SerpApi's free plan, running out means failed lookups until the month resets, not a bill.
- The free plan allows 100,000 requests a day and 10 ms of CPU per request ([limits](https://developers.cloudflare.com/workers/platform/limits/)). A lookup spends most of its time waiting on the price search, and waiting is not CPU time.

## Hostinger web apps (Business or Cloud plan)

Hostinger runs Node.js server apps on its Business web hosting and Cloud plans, deployed from a GitHub repository with a rebuild on every push, with the entry file set to `index.js` and Node 22 or 24. Add `SERPER_API_KEY` under the app's environment variables in hPanel, and attach the subdomain there; at your DNS provider, point that subdomain at the target hPanel shows. Two cautions: Hostinger keeps only the last two deployed versions of the app folder, so the SQLite recorder inside it does not survive a redeploy, and the Single plan has no Node.js at all. For a durable price history on Hostinger, point `DATABASE_URL` at the plan's MySQL database (adapter in progress) or keep the recorder on a host with a volume.

## Fly.io, the path this repo is set up for

```
fly launch --copy-config --no-deploy
fly volumes create data --size 1 --region bom
fly secrets set SERPER_API_KEY=...
fly deploy
```

`fly.toml` already mounts the volume at `/data`, keeps one small machine in Mumbai, suspends it when idle and wakes it on the first request. A custom domain is `fly certs add worth-carrying.example.com` plus a CNAME at your DNS provider.

## Any Docker host (Railway, Render, a VPS)

```
docker build -t worth-carrying .
docker run -p 8080:8080 -v wc-data:/data -e SERPER_API_KEY=... worth-carrying
```

Mount something persistent at `/data`, or set `RECORDER_DB` to a path that is. On Render and Railway that is a "persistent disk" or "volume" in the service settings.

## Plain Node on a server you already have

```
npm install --omit=dev
SERPER_API_KEY=... PORT=8080 node bin/worth-carrying.js
```

Put nginx or Caddy in front for HTTPS. The camera only works over HTTPS.

## Knobs

| Variable | Default | What it does |
|---|---|---|
| `PORT` | 8787 | Listening port |
| `WEB_ORIGINS` | none | Comma-separated HTTPS origins allowed to call the backend from a separate interface |
| `DAILY_CAP` | 300 | Lookups per day across all users, so a shared key cannot run away |
| `IP_HOURLY_CAP` | 30 | Lookups per hour per IP |
| `PRICE_PROVIDER` | auto | `serper`, `serpapi` or `chrome` |
| `RECORDER_DB` | data/observations.sqlite | Where lookups are recorded for history |
| `VISION_MODEL` | claude-opus-5 | Model used to read a photo |
| `CHROME_DEBUG_URL` | localhost 9222, then 9223 | Where the development Chrome listens |
| `SALES_REFRESH_DAYS` | 7 | Weekly web search for this year's sale dates; 0 turns it off |
| `SALES_STATE` | data/sales.json | Where confirmed sale dates are kept |

On the Worker, set these under `[vars]` in `wrangler.toml` and keys with `npm run worker -- secret put <NAME>`. `PORT`, `RECORDER_DB`, `CHROME_DEBUG_URL` and the sales settings do not apply there.

## What it costs to run

SerpApi: 250 searches a month free. Serper: free for the first 2,500 lookups, then about a dollar per 1,000. Cloudflare Workers and D1: free plan. Jev: cents per hundred lookups. Fly.io: a shared machine that suspends when idle runs a few dollars a month at most. Keepa, if you add it: from EUR 49 a month.
