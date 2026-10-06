import { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";
import { isWholeUnit, QUANTITY_DECIMALS } from "@/config/inventory";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export type Quantity = Decimal | string | number;

export function toDecimal(value: Quantity): Decimal {
  return new Decimal(value);
}

/** "12", "8.5", "1,250.25": no trailing zeros, thousands separators. */
export function formatQuantity(value: Quantity): string {
  const fixed = toDecimal(value).toFixed(QUANTITY_DECIMALS).replace(/\.?0+$/, "");
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatQuantityWithUnit(value: Quantity, unit: string): string {
  return `${formatQuantity(value)} ${unit}`;
}

/** Throws a field-level ActionError when a fractional amount is used with a whole-number unit. */
export function assertAmountFitsUnit(value: Quantity, unit: string, field: string) {
  if (isWholeUnit(unit) && !toDecimal(value).isInteger()) {
    throw new ActionError("Please fix the highlighted fields.", {
      [field]: `${unit} can't be split. Use a whole number.`,
    });
  }
}

export type MovementResult = {
  /** Signed change to store on the movement row. */
  delta: Decimal;
  balanceAfter: Decimal;
};

/**
 * The rules for one movement, applied to the quantity read under the row lock.
 * `amount` is what staff entered: units received, units used, or (for ADJUSTED)
 * the counted quantity on the shelf.
 */
export function applyMovement(params: {
  type: StockMovementType;
  current: Quantity;
  amount: Quantity;
  unit: string;
}): MovementResult {
  const current = toDecimal(params.current);
  const amount = toDecimal(params.amount);
  const { type, unit } = params;
  const fail = (message: string): never => {
    throw new ActionError(message, { quantity: message });
  };

  if (amount.isNegative()) fail("Amount can't be negative.");
  assertAmountFitsUnit(amount, unit, "quantity");

  switch (type) {
    case "RECEIVED": {
      if (amount.isZero()) fail("Enter an amount above zero.");
      return { delta: amount, balanceAfter: current.plus(amount) };
    }
    case "USED": {
      if (amount.isZero()) fail("Enter an amount above zero.");
      if (amount.greaterThan(current)) {
        fail(`Only ${formatQuantityWithUnit(current, unit)} in stock. You can't use ${formatQuantityWithUnit(amount, unit)}.`);
      }
      return { delta: amount.negated(), balanceAfter: current.minus(amount) };
    }
    case "ADJUSTED": {
      const delta = amount.minus(current);
      if (delta.isZero()) fail(`The count matches the current stock (${formatQuantityWithUnit(current, unit)}). Nothing to adjust.`);
      return { delta, balanceAfter: amount };
    }
  }
}

/**
 * Low stock: active, has a threshold, and quantity is at or below it.
 * A threshold of 0 means "never alert".
 */
export function isLowStock(item: { isActive: boolean; quantity: Quantity; lowStockThreshold: Quantity }): boolean {
  if (!item.isActive) return false;
  const threshold = toDecimal(item.lowStockThreshold);
  return threshold.greaterThan(0) && toDecimal(item.quantity).lessThanOrEqualTo(threshold);
}

export function isOutOfStock(item: { isActive: boolean; quantity: Quantity; lowStockThreshold: Quantity }): boolean {
  return isLowStock(item) && toDecimal(item.quantity).isZero();
}

/** Reuse an existing category's spelling when the new one matches it ignoring case. */
export function canonicalCategory(input: string, existing: readonly string[]): string {
  const key = input.toLowerCase();
  return existing.find((category) => category.toLowerCase() === key) ?? input;
}
