// Client-safe: no Prisma or server imports, so forms can use it.

/** Anything printable as a plain decimal: a string, number or Prisma Decimal. */
export type QuantityLike = string | number | { toString(): string };

/** "12", "8.5", "1,250.25": at most 2 decimals, no trailing zeros, thousands separators. */
export function formatQuantity(value: QuantityLike): string {
  const [whole = "0", fraction = ""] = String(value).replace(/^-/, "").split(".");
  const trimmed = fraction.slice(0, 2).replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

export function formatQuantityWithUnit(value: QuantityLike, unit: string): string {
  return `${formatQuantity(value)} ${unit}`;
}
