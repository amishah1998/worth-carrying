# Running it as a website and a phone app

The web page is already a phone app. Open the site on a phone, choose "Add to Home Screen", and it installs with an icon, opens full screen, and keeps its shell cached for weak roaming data. Lookups always go to the network.

A hosted copy needs two things: a price key (Serper, 2,500 free queries; a search key, not a model key) and a folder that survives restarts for the recorder database. No model key is needed; Jev, Keepa and the photo reader are optional extras.

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
| `DAILY_CAP` | 300 | Lookups per day across all users, so a shared key cannot run away |
| `IP_HOURLY_CAP` | 30 | Lookups per hour per IP |
| `PRICE_PROVIDER` | auto | `serper`, `serpapi` or `chrome` |
| `RECORDER_DB` | data/observations.sqlite | Where lookups are recorded for history |
| `VISION_MODEL` | claude-opus-5 | Model used to read a photo |
| `CHROME_DEBUG_URL` | localhost 9222, then 9223 | Where the development Chrome listens |
| `SALES_REFRESH_DAYS` | 7 | Weekly web search for this year's sale dates; 0 turns it off |
| `SALES_STATE` | data/sales.json | Where confirmed sale dates are kept |

## What it costs to run

Serper: free for the first 2,500 lookups, then about a dollar per 1,000. Jev: cents per hundred lookups. Fly.io: a shared machine that suspends when idle runs a few dollars a month at most. Keepa, if you add it: from EUR 49 a month.
