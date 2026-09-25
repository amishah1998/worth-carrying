# worth-carrying

Standing in a shop abroad, wondering if that perfume, bag, watch or speaker is really cheaper than in India? Pick the country, type the product and the shelf price, or photograph the box. You get India's price today across stores, India's lowest and typical price with dates, the landed cost after Indian customs duty, the warranty catch, the next big Indian sale, and a verdict. Under the form, a panel says what that country is known for and what travellers from India usually bring back.

```
worth-carrying check "Dior Sauvage EDP 100ml" --price 350 --currency AED --country AE
```

Or run the web app on your laptop and open it on your phone:

```
npx worth-carrying
```

## Why

Shelf prices abroad get compared against India's printed MRP, and the MRP is a fiction. On Amazon.in the median MRP sits 103 percent above the typical selling price. So the honest comparison is against what India actually sells it for, today and at its lowest, plus what customs charges above the allowance, and minus the warranty you may lose.

## What it does

1. Turns your text or photo into a search. A photo goes to Claude, which reads the label, because that is where "EDP" and "100ml" are printed.
2. Asks Google Shopping India for listings. Every Indian store Google lists, in rupees, in one call.
3. Rejects wrong variants. Every word you typed must appear in the title, sizes and concentrations must agree, and decants, bundles, imports and suspiciously cheap listings are dropped, each with the reason shown. A generic query like "almonds roasted" is matched on the kind of product and compared per 100 g. With a Jev key, a yes/no question per listing adds fuzzier judgment on top.
4. Finds the history. Keepa for Amazon.in when a key is present. Otherwise the app records every lookup from major stores and re-prices every product it has seen once a day, so lows and highs with dates build for Flipkart, Nykaa, Myntra and the rest over time. The card shows a sparkline once there are a few days, names the next big Indian sale, and links to a year of Amazon and Flipkart history on pricehistory.app.
5. Lands the shelf price. Frankfurter converts it on the day's rate as you type, and duty at 35 percent goes on for anything above the 75,000 rupee per-person allowance. Tourist VAT refunds are not applied; see docs/rules.md.
6. Decides. Cheaper abroad, marginal, not worth carrying, or wait for the India sale, with the reason and the warranty flag.

## As an app on your phone

Host it once (see [docs/deploy.md](docs/deploy.md), Fly.io is set up in the repo), open the address on your phone, and choose "Add to Home Screen". It installs with an icon, opens full screen, and keeps its shell cached for weak roaming data. The camera button opens the phone camera directly.

## Keys

No model key is needed. Matching runs on rules and word coverage: every word of what you typed must appear in the listing, sizes and concentrations must agree, and decants, bundles, imports and suspiciously cheap listings are dropped. The two model-backed extras, Jev for fuzzier matching and the photo reader, are off unless the person running the server adds a key, and the page hides the camera button when the photo reader is off.

Put keys in a `.env` file in the folder you run from, or export them.

| Key | What it unlocks | Free? |
|---|---|---|
| `SERPER_API_KEY` | Google Shopping India through [Serper](https://serper.dev/) | 2,500 queries on signup, then about a dollar per 1,000 |
| `SERPAPI_API_KEY` | The same through [SerpApi](https://serpapi.com/), used if Serper's key is absent | 250 a month |
| neither | A Chrome you already run with `--remote-debugging-port=9222` reads the Google Shopping page. Development only | Free |
| `TYPESAFE_API_KEY` | Optional. Jev judges "same product" on titles the word rules cannot read, such as Hindi listings | Pay per use, cents per hundred lookups |
| `KEEPA_API_KEY` | Optional. Amazon.in price history on the first lookup | From EUR 49 a month |
| `ANTHROPIC_API_KEY` | Optional. Photo input; the camera button appears only when set. The upload, the request and the reply parsing are tested against a stand-in endpoint; accuracy on real shelf photos is not yet measured | Pay per use, about a cent per photo |

`PORT` (default 8787), `DAILY_CAP` (default 300 lookups a day, for a hosted copy), `PRICE_PROVIDER` (`serper`, `serpapi`, `chrome`), `RECORDER_DB` (default `data/observations.sqlite`), `RECHECK_HOURS` (default 24, the daily re-pricing of everything looked up; 0 turns it off; never runs on the Chrome provider), `SALES_REFRESH_DAYS` (default 7, the weekly web search for this year's Amazon and Flipkart sale dates, needs the Serper key; a date is shown only when two different sites agree, with both links).

## What leaves your machine

The product name you type goes to the price search. With the optional keys set, a photo goes to Anthropic and listing titles go to Jev. Nothing else leaves. The recorder database stays on the machine that runs the app.

## The rules, and where they come from

Every number has a source in [docs/rules.md](docs/rules.md). The short version: 75,000 rupees duty-free per person and not pooled, 35 percent on the excess, Samsung and JBL lose their India warranty when bought abroad, Apple may refuse cross-border service, luggage brands keep a global warranty.

## Limits

- History is Amazon.in only until the recorder has seen a sale cycle for a product, and only with a Keepa key. The card says which source it used.
- Google decides which stores appear. On the test queries it returned Amazon.in, Flipkart, Myntra, Nykaa, Sephora India, Tira, JBL India and others. Croma and Reliance Digital did not show for every query.
- Matching is the way to lose trust. Rejected listings are always shown with the reason, so you can see when it dropped the right one.
- Duty is approximate. Customs uses its own exchange rate and its own valuation.
- Phones are handled, but Smartprix already does phones well. This is built for the categories nobody covers.

## Tests

```
npm test
```

## Prior art

Smartprix, MySmartPrice and 91mobiles compare Indian prices for gadgets. pricehistoryapp.com and BuyHatke show Indian price history one pasted link at a time. Keepa tracks Amazon. MobilePriceCheck compares phone prices Dubai versus India from estimates. None of them takes a name or a photo from a shop abroad and answers with the landed comparison.

MIT licence.
