import { z } from "zod";
import { INVENTORY_UNITS, isWholeUnit, QUANTITY_DECIMALS } from "@/config/inventory";

const id = z.string().trim().min(1).max(64);

/** "1,250.5" → "1250.5"; blank stays blank. */
function cleanNumber(value: unknown) {
  return typeof value === "string" ? value.replace(/[,\s]/g, "") : value;
}

const QUANTITY_PATTERN = new RegExp(`^\\d+(\\.\\d{1,${QUANTITY_DECIMALS}})?$`);

/** A non-negative amount with at most 2 decimals, kept as a string (never a float). */
export const quantityField = z.preprocess(
  cleanNumber,
  z
    .string({ error: "Enter an amount." })
    .regex(QUANTITY_PATTERN, { error: `Enter a number with at most ${QUANTITY_DECIMALS} decimals.` })
    .refine((value) => Number(value) <= 99_999_999.99, { error: "That amount looks too high." }),
);

/** Blank form field → "0". */
const quantityOrZero = z.preprocess(
  (value) => (cleanNumber(value) === "" ? undefined : value),
  quantityField.optional().default("0"),
);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `At most ${max} characters.` })
    .optional()
    .transform((value) => value || null);

const optionalCost = z.preprocess(
  (value) => (typeof value === "string" ? cleanNumber(value) || undefined : value),
  z.coerce
    .number({ error: "Enter a cost in NPR." })
    .int({ error: "Use whole rupees, no paisa." })
    .min(0, { error: "Can't be negative." })
    .max(10_000_000, { error: "That cost looks too high." })
    .optional()
    .transform((value) => value ?? null),
);

const itemFields = z.object({
  name: z.string().trim().min(2, { error: "Enter a name." }).max(80, { error: "At most 80 characters." }),
  category: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(z.string().min(1, { error: "Enter a category." }).max(40, { error: "At most 40 characters." })),
  unit: z.enum(INVENTORY_UNITS, { error: "Choose a unit." }),
  lowStockThreshold: quantityOrZero,
  unitCostNpr: optionalCost,
  supplier: optionalText(80),
});

/** Whole-number units can't have fractional thresholds or opening stock. */
function wholeNumberCheck<T extends { unit: string }>(fields: (keyof T & string)[]) {
  return (input: T, ctx: z.RefinementCtx) => {
    if (!isWholeUnit(input.unit)) return;
    for (const field of fields) {
      const value = String(input[field] ?? "0");
      if (!Number.isInteger(Number(value))) {
        ctx.addIssue({ code: "custom", path: [field], message: `${input.unit} can't be split. Use a whole number.` });
      }
    }
  };
}

export const createItemSchema = itemFields
  .extend({ openingQuantity: quantityOrZero })
  .superRefine(wholeNumberCheck(["lowStockThreshold", "openingQuantity"]));

export const updateItemSchema = itemFields
  .extend({ itemId: id })
  .superRefine(wholeNumberCheck(["lowStockThreshold"]));

export const setItemActiveSchema = z.object({
  itemId: id,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const MOVEMENT_TYPES = ["RECEIVED", "USED", "ADJUSTED"] as const;

export const recordMovementSchema = z
  .object({
    itemId: id,
    type: z.enum(MOVEMENT_TYPES, { error: "Choose what happened." }),
    /** RECEIVED / USED: the amount. ADJUSTED: the counted quantity. */
    quantity: quantityField,
    note: optionalText(500),
  })
  .superRefine((input, ctx) => {
    if (input.type === "ADJUSTED" && !input.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Say why the count changed (for example: damaged, miscounted)." });
    }
  });

export const NOTE_MAX_LENGTH = 500;
