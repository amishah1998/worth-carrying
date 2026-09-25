// Every number here has a source in docs/rules.md. Change the number there first.

// Baggage Rules 2026 (Notification 14/2026-Customs (N.T.), in force 2 Feb 2026): INR 75,000 per
// passenger arriving by air or sea, no pooling, infants get none. Duty on the excess is 35 percent
// basic customs duty; the surcharge on baggage was withdrawn on 2 Feb 2025.
export const INDIA = { allowanceInr: 75000, dutyRate: 0.35, laptopsFree: 1 };

// Which brands keep, lose or risk their India warranty when bought abroad.
export const WARRANTY = [
  { match: /\bsamsung\b/i, status: "lost", text: "Samsung India repairs products bought abroad at cost" },
  { match: /\bjbl\b|\bharman\b/i, status: "lost", text: "Harman gives no international warranty on JBL" },
  { match: /\bsony\b/i, status: "lost", text: "Sony India honours only a Tourist Limited Warranty issued by the shop" },
  { match: /\bapple\b|\biphone\b|\bipad\b|\bmacbook\b|\bairpods\b/i, status: "at_risk", text: "Apple may restrict warranty service to the country of sale" },
  { match: /\bbose\b/i, status: "unclear", text: "Bose India covers products bought from Bose or an authorised reseller; cross-border service not stated" },
  { match: /\bamerican tourister\b|\bsamsonite\b|\bkamiliant\b/i, status: "kept", text: "Global warranty, repair at any service centre" },
  { match: /\b(edp|edt|parfum|perfume|eau de|cologne|fragrance)\b/i, status: "na", text: "No warranty question; check it is the same product, not a clone or grey stock" },
];

export function warrantyFor(text) {
  for (const w of WARRANTY) if (w.match.test(text)) return { status: w.status, text: w.text };
  return { status: "unknown", text: "Warranty terms for this brand not checked" };
}

export const NOTES = [
  { match: /\biphone\b/i, text: "UAE, US and Japan iPhones from the 17 onward are eSIM only; Airtel, Jio and Vi support eSIM" },
  { match: /\b(edp|edt|parfum|perfume|eau de|cologne)\b/i, text: "Bottles over 100 ml go in checked baggage unless bought in duty-free" },
];

export function notesFor(text) {
  return NOTES.filter((n) => n.match.test(text)).map((n) => n.text);
}

// Landed cost of one item. tripTotalInr is everything else new the same person carries.
// Tourist VAT refunds are deliberately not applied: small, uncertain, and most people skip the kiosk.
export function landedCost({ price, rate, tripTotalInr = 0 }) {
  const shelfInr = price * rate;
  const excess = Math.max(0, shelfInr + tripTotalInr - INDIA.allowanceInr);
  const dutyInr = excess * INDIA.dutyRate;
  return {
    shelfInr, dutyInr, landedInr: shelfInr + dutyInr,
    allowanceInr: INDIA.allowanceInr, dutyRate: INDIA.dutyRate,
    dutyNote: dutyInr > 0
      ? `Trip total ${Math.round(shelfInr + tripTotalInr).toLocaleString("en-IN")} is above the ${INDIA.allowanceInr.toLocaleString("en-IN")} allowance; 35 percent on the excess, approximate`
      : `Within the ${INDIA.allowanceInr.toLocaleString("en-IN")} per-person allowance, no duty`,
  };
}
