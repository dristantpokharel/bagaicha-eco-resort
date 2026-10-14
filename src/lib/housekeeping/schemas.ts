import { z } from "zod";
import { SUBMISSION_ID_PATTERN } from "@/lib/inventory/submission-id";
import type { InspectionEntry } from "./checklist";

const id = z.string().trim().min(1).max(64);
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");

export const roomIdSchema = z.object({ roomId: id });

const cycle = z.coerce.number().int().min(0).max(1_000_000);

export const prepSchema = z.object({ roomId: id, cycle, acknowledgeShortfall: checkbox });
export const inspectionSchema = z.object({ roomId: id, cycle });

export const skipInspectionSchema = z.object({
  roomId: id,
  cycle,
  reason: z.string().trim().min(3, { error: "Say why (at least a few words)." }).max(300, { error: "At most 300 characters." }),
});

export const setStatusSchema = z.object({
  roomId: id,
  status: z.enum(["DIRTY", "READY", "OUT_OF_ORDER"], { error: "Choose a status." }),
  note: z
    .string()
    .trim()
    .max(300, { error: "At most 300 characters." })
    .optional()
    .transform((value) => value || null),
});

/** Form fields named `${prefix}:${itemId}` → { itemId: value }. */
export function fieldsWithPrefix(formData: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string" && name.startsWith(`${prefix}:`)) out[name.slice(prefix.length + 1)] = value;
  }
  return out;
}

export function inspectionEntries(formData: FormData): Record<string, InspectionEntry> {
  const counted = fieldsWithPrefix(formData, "count");
  const kinds = fieldsWithPrefix(formData, "kind");
  const notes = fieldsWithPrefix(formData, "note");
  return Object.fromEntries(Object.entries(counted).map(([itemId, value]) => [itemId, { counted: value, kind: kinds[itemId], note: notes[itemId] }]));
}

export const saveParSchema = z
  .object({ roomTypeId: id.optional(), roomId: id.optional() })
  .refine((v) => Boolean(v.roomTypeId) !== Boolean(v.roomId), { error: "Choose a room type or a room." });

export const addExtraSchema = z.object({
  bookingId: id,
  /** One per form attempt (see submission-id.ts); a repeat is added once. */
  submissionId: z.string().regex(SUBMISSION_ID_PATTERN, { error: "Reload the page and try again." }),
  itemId: z.string().trim().min(1, { error: "Choose an item." }).max(64),
  quantity: z
    .string()
    .trim()
    .min(1, { error: "Enter how many." })
    .regex(/^\d{1,6}(\.\d{1,2})?$/, { error: "Enter a number, like 1 or 2.5." }),
  note: z
    .string()
    .trim()
    .max(200, { error: "At most 200 characters." })
    .optional()
    .transform((value) => value || null),
});

export const removeExtraSchema = z.object({ extraId: id });
export const applyExtraSchema = z.object({ extraId: id });
