export type Quote = {
  nights: number;
  /** Room rate per night (snapshotted on the booking). */
  pricePerNightNpr: number;
  /** Per-child nightly rate (snapshotted). */
  childPricePerNightNpr: number;
  children: number;
  roomSubtotalNpr: number;
  childSubtotalNpr: number;
  totalPriceNpr: number;
};

/**
 * total = nights × room rate + nights × children × child rate. Whole NPR.
 * Rates must come from the database (or from a booking's own snapshot),
 * never from the browser.
 */
export function computeQuote(input: {
  nights: number;
  pricePerNightNpr: number;
  childPricePerNightNpr: number;
  children: number;
}): Quote {
  const { nights, pricePerNightNpr, childPricePerNightNpr, children } = input;
  const roomSubtotalNpr = nights * pricePerNightNpr;
  const childSubtotalNpr = nights * children * childPricePerNightNpr;
  return {
    ...input,
    roomSubtotalNpr,
    childSubtotalNpr,
    totalPriceNpr: roomSubtotalNpr + childSubtotalNpr,
  };
}

/** Human-readable breakdown lines for /book, admin and emails. */
export function quoteLines(quote: Quote, formatMoney: (npr: number) => string): string[] {
  const nightsLabel = `${quote.nights} night${quote.nights === 1 ? "" : "s"}`;
  const lines = [`${nightsLabel} × ${formatMoney(quote.pricePerNightNpr)} = ${formatMoney(quote.roomSubtotalNpr)}`];
  if (quote.children > 0 && quote.childPricePerNightNpr > 0) {
    lines.push(
      `${nightsLabel} × ${quote.children} child${quote.children === 1 ? "" : "ren"} × ${formatMoney(
        quote.childPricePerNightNpr,
      )} = ${formatMoney(quote.childSubtotalNpr)}`,
    );
  }
  return lines;
}
