/** Whole NPR for display, e.g. 4500 → "NPR 4,500". */
export function formatNpr(amount: number) {
  return `NPR ${new Intl.NumberFormat("en-IN").format(amount)}`;
}
