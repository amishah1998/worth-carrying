// The big Indian sale windows, shown on the card so a traveller can decide to wait.
// Dates and sources live in docs/rules.md; a sale drops off 30 days after it starts.
export const SALES = [
  { name: "Amazon Great Indian Festival", start: "2026-10-08", earlyAccess: "2026-10-07", source: "https://www.desidime.com/news/amazon-great-indian-festival-2026-agif-sale" },
  { name: "Flipkart Big Billion Days", start: "2026-10-09", earlyAccess: "2026-10-08", source: "https://sundayguardianlive.com/trending/flipkart-big-billion-days-2026-starts-on-october-9-with-exclusive-early-access-on-october-8-for-flipkart-plus-black-eligible-credit-card-members-heres-bank-offers-discounts-deals-290338/" },
];

export function upcomingSales(now = new Date()) {
  const cutoff = now.getTime() - 30 * 86400000;
  return SALES.filter((s) => new Date(s.start).getTime() >= cutoff);
}
