# The rules the verdict uses, with sources

Every number in `src/rules.js` and `src/sales.js` comes from a page listed here. Change it here first, then in the code. Checked 2026-09-25.

## Indian customs, arriving by air

| Rule | Number | Source |
|---|---|---|
| Duty-free allowance per passenger, not pooled, infants get none | INR 75,000 | [Baggage Rules 2026, Notification 14/2026-Customs (N.T.), Rule 5](https://www.indiabudget.gov.in/doc/cen/cus1426.pdf) |
| One new laptop free for a passenger aged 18 or above | 1 | Same, Rule 5 third proviso |
| Basic customs duty on the value above the allowance, heading 9803 | 35 percent | [CBIC, customs clearance of passengers at a glance](https://www.cbic.gov.in/resources/htdocs-cbec/customs_clearance_of_passengers_at_a_glance.pdf) |
| Social Welfare Surcharge on baggage | 0 since 2 Feb 2025 | [Budget 2025 memorandum, section VI item 25](https://www.indiabudget.gov.in/budget2025-26/doc/memo.pdf) |
| Arrival by land | No general allowance | Baggage Rules 2026, Rule 5 |

Customs converts at its own notified rate, revised about twice a month, so the duty line is approximate. The 38.5 percent quoted on many sites is the pre-2025 figure. The "10 percent" in some 2026 news is the rate for personal imports by post or courier (heading 9804), not baggage.

Tourist VAT refunds (UAE 5 percent through Planet, Thailand 7 percent, Indonesia 11 percent) are not applied in the verdict. They are small, come with fees and minimums, and most travellers never reach the kiosk. The shelf price is taken as paid.

## Warranty in India for goods bought abroad

| Brand | Status | Source |
|---|---|---|
| Samsung | Lost, repair at cost | [Samsung India warranty](https://www.samsung.com/in/support/warranty/) |
| JBL (Harman) | Lost, no international warranty | JBL India warranty policy, archived copy of 2026-05-07 |
| Sony | Lost unless the shop issues a Tourist Limited Warranty | Sony TLW country list |
| Apple | At risk, Apple may restrict service to the country of sale | [Apple one-year limited warranty](https://www.apple.com/legal/warranty/products/ios-warranty-emea-english.html) |
| Bose | Unclear | Bose India warranty PDF |
| American Tourister, Samsonite | Kept, global warranty | Brand warranty pages |

## Indian sale seasons shown on the card

| Sale | 2026 dates | Source |
|---|---|---|
| Amazon Great Indian Festival | From 8 October, Prime early access 7 October | [DesiDime, sale updates page](https://www.desidime.com/news/amazon-great-indian-festival-2026-agif-sale) |
| Flipkart Big Billion Days | From 9 October, Plus and VIP early access 8 October | [The Sunday Guardian, September 2026](https://sundayguardianlive.com/trending/flipkart-big-billion-days-2026-starts-on-october-9-with-exclusive-early-access-on-october-8-for-flipkart-plus-black-eligible-credit-card-members-heres-bank-offers-discounts-deals-290338/) |

These are the hand-read seeds for 2026, each backed by two pages. A hosted copy with a Serper key also searches the web every week for the current year's announcement and replaces the seed only when two different sites name the same start date, keeping both links. When no date is confirmed, the card says "usually late September to October", which is what the last four years show: 23 September 2022, 8 October 2023, 27 September 2024, 23 September 2025 for the Amazon sale ([DesiDime sale history table](https://www.desidime.com/news/amazon-great-indian-festival-2026-agif-sale)). A date drops off the card a month after it passes.

## Currency and countries

Rates come from [Frankfurter](https://frankfurter.dev/) v2, which needs no key and allows commercial use. Cached for a day. The country list with each country's currency comes from the [mledoze/countries](https://github.com/mledoze/countries) dataset, fetched 2026-09-25 into `src/countries.json`.
