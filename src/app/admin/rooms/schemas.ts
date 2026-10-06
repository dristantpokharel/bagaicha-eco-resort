import { z } from "zod";

const id = z.string().trim().min(1).max(64);

/** "Deluxe Garden Room" → "deluxe-garden-room" */
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Whole NPR; accepts "1,500" or "1500". */
const wholeNpr = z.preprocess(
  (value) => (typeof value === "string" ? value.replace(/[,\s]/g, "") : value),
  z.coerce
    .number({ error: "Enter a price in NPR." })
    .int({ error: "Use whole rupees, no paisa." })
    .min(1, { error: "Price must be at least NPR 1." })
    .max(10_000_000, { error: "That price looks too high." }),
);

export const roomTypeSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Enter a name." }).max(80),
    slug: z.string().trim().toLowerCase().max(80).optional().default(""),
    description: z.string().trim().min(10, { error: "Write a short description (at least 10 characters)." }).max(2000),
    basePriceNpr: wholeNpr,
    maxGuests: z.coerce
      .number({ error: "Enter the maximum number of guests." })
      .int({ error: "Use a whole number." })
      .min(1, { error: "At least 1 guest." })
      .max(20, { error: "At most 20 guests." }),
    /** One per line in the form. */
    amenities: z
      .string()
      .max(3000)
      .optional()
      .default("")
      .transform((text) => [
        ...new Set(
          text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        ),
      ])
      .pipe(
        z
          .array(z.string().max(80, { error: "Each amenity must be under 80 characters." }))
          .max(30, { error: "List at most 30 amenities." }),
      ),
    sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
  })
  .transform((input) => ({ ...input, slug: input.slug || slugify(input.name) }))
  .refine((input) => SLUG_PATTERN.test(input.slug), {
    error: "Use lowercase letters, numbers and single hyphens only.",
    path: ["slug"],
  });

export const updateRoomTypeSchema = z.intersection(z.object({ roomTypeId: id }), roomTypeSchema);

export const setActiveSchema = z.object({
  id,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

const roomName = z.string().trim().min(1, { error: "Enter a room name or number." }).max(40);

export const createRoomSchema = z.object({ roomTypeId: id, name: roomName });
export const renameRoomSchema = z.object({ roomId: id, name: roomName });
