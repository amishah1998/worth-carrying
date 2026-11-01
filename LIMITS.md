# Limits

What this tool does not do yet, stated plainly so nobody has to find out the hard way.

- **Matching reads words, not meaning.** Without an optional model key, a listing is kept only when every word you typed appears in its title. A Hindi title with an incomplete Latin part is dropped, not judged. A misspelt clone is caught by its price, not by understanding. Rejected listings are always shown with the reason so you can see what was dropped.
- **History starts empty.** The lowest and typical prices with dates come from the app's own record, which begins the day it is first run. It grows through the daily re-check on the Node server, and only from lookups on the Cloudflare Worker. Until then the card shows today's typical price. With a Keepa key, Amazon history exists from the first lookup.
- **Google decides the stores.** Prices come from Google Shopping India. On the test queries it returned Amazon.in, Flipkart, Myntra, Nykaa, Sephora India, Tira, JBL India, JioMart, bigbasket and more, but not every store on every query. "India today" anchors on a major store; a cheaper unknown shop is shown separately, never used as the anchor.
- **A few foreign shops slip in, and links go through Google.** With SerpApi, Google Shopping India also lists some overseas sellers that ship to India, and they can pass the word match. They never set "India today". Each listing's link opens Google's product page rather than the store's own page.
- **Duty is approximate.** The allowance and the rate come from the Baggage Rules 2026 and the Budget 2025 memo, but customs uses its own exchange rate and its own valuation, and the trip total is whatever you enter.
- **Generic items need a pack size for a verdict.** "almonds roasted" gives India's price per 100 g; "almonds roasted 500g" gives a verdict for that pack.
- **Sale dates are read from the web.** A date is shown only when two different sites agree, and two sites repeating the same rumour would pass. The links are on the card.
- **Photo reading is unmeasured.** The upload, request and parsing are tested against a stand-in endpoint. Accuracy on real shelf photos has not been measured, and the feature is off unless the operator adds a key.
- **The guide is only as good as its sources.** 60 countries, every item with the page that supports it. Some items rest on Wikipedia or shop blogs, and "what travellers from India bring back" is thin outside the Gulf and Southeast Asia.
