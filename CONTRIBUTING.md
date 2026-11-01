# Contributing

Two kinds of change are welcome without discussion: a country guide, and a matching fix backed by a real listing.

## Adding or fixing a country guide

Guides live in `src/guides.json`, one entry per country, four lists each: `knownFor`, `usuallyBuy`, `funFacts`, `watchOuts`. Every item carries a `source`, the public page that supports it. Each item follows these rules.

- A claim without a page that backs it does not go in. Fewer true items beat more plausible ones.
- No prices in the guide; the app fetches live prices. "Cheaper than India" only when the source says so.
- `kind` is one of `local`, `cheaper`, `quality`, `famous`.
- Short strings, no em or en dashes, no colons except in URLs.
- `search` is the shortest product name a shop would understand, because tapping the item fills the search box.

## Fixing a match

If the app kept a wrong listing or dropped the right one, open a pull request with the query, the listing title and seller, and what should have happened. Matching rules are in `src/match.js`; add a case to `test/match.test.js` first, then make it pass.

## Rules with numbers

Customs, warranty and sale dates live in `src/rules.js` and `src/sales.js`. Change the number in `docs/rules.md` first, with its source, then in the code.

## Running

```
npm test
node bin/worth-carrying.js --help
```

The development price provider reads Google Shopping through a Chrome you already run with `--remote-debugging-port=9222`, so no key is needed to work on the code.
