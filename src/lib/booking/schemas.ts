import { z } from "zod";
import { emailSchema } from "@/lib/auth/schemas";
import { BOOKING } from "@/config/booking";
import { normalizePhone } from "./phone";

const PHONE_ERROR = "Enter a valid phone number, for example +977 98XXXXXXXX.";

/** Required phone; stored normalized (+977…). */
export const requiredPhone = z
  .string()
  .trim()
  .min(1, { error: "Enter a phone number." })
  .refine((v) => normalizePhone(v) !== null, { error: PHONE_ERROR })
  .transform((v) => normalizePhone(v)!);

/** The field is prefilled with the country code, so a bare code means "left empty". */
const isBareCountryCode = (v: string) => v.replace(/\D/g, "") === BOOKING.defaultCountryCode.replace(/\D/g, "");

/** Optional phone: blank (or just the prefilled +977) → undefined, otherwise validated and normalized. */
export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && !isBareCountryCode(v) ? v : undefined))
  .refine((v) => v === undefined || normalizePhone(v) !== null, { error: PHONE_ERROR })
  .transform((v) => (v ? normalizePhone(v)! : undefined));

/** Optional email: blank → undefined. */
export const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(emailSchema.optional());

export const guestName = z.string().trim().min(2, { error: "Enter the guest's name." }).max(100);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Please keep this under ${max} characters.` })
    .optional()
    .transform((v) => v || undefined);

export const country = optionalText(60);
export const longText = (max: number) => optionalText(max);

const count = (min: number, max: number) =>
  z.coerce
    .number({ error: "Enter a number." })
    .int({ error: "Use a whole number." })
    .min(min, { error: `At least ${min}.` })
    .max(max, { error: `At most ${max}.` });

export const adultsField = count(1, 20);
export const childrenField = count(0, 20);

const id = z.string().trim().min(1).max(64);
const dateString = z.string().trim().max(10);

/** The dates and the whole party. The rooms (and who sleeps where) are separate: see roomLinesField. */
export const stayFields = {
  checkIn: dateString,
  checkOut: dateString,
  adults: adultsField,
  children: childrenField,
};

const roomLine = z.object({
  roomTypeId: id,
  adults: z.number().int().min(0).max(20),
  children: z.number().int().min(0).max(20),
});

/**
 * The selected rooms, sent as a JSON array of { roomTypeId, adults, children } in one form field.
 * Only ids and guest counts are accepted; prices always come from the database. The room-count limit and
 * the per-room capacity are checked by validateSplit, so people get specific messages.
 */
export const roomLinesField = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Your room selection wasn't understood. Please choose your rooms again." });
      return z.NEVER;
    }
  })
  .pipe(z.array(roomLine).min(1, { error: "Choose at least one room." }).max(20, { error: "Choose at least one room." }));

/** Public booking request. Prices are never accepted from the browser. */
export const publicBookingSchema = z.object({
  ...stayFields,
  rooms: roomLinesField,
  name: guestName,
  email: emailSchema,
  phone: requiredPhone,
  country,
  specialRequests: longText(1000),
  turnstileToken: z.string().max(2048).optional(),
  /** Honeypot: real users never see or fill this. */
  website: z.string().max(200).optional(),
});

export const enquirySchema = z
  .object({
    name: guestName,
    email: optionalEmail,
    phone: optionalPhone,
    type: z.enum(["STAY", "EVENT", "CONFERENCE", "OTHER"], { error: "Choose what your enquiry is about." }),
    message: z.string().trim().min(10, { error: "Please write a few words about your plans." }).max(3000),
    turnstileToken: z.string().max(2048).optional(),
    website: z.string().max(200).optional(),
  })
  .refine((v) => v.email || v.phone, {
    error: "Give us an email or a phone number so we can reply.",
    path: ["email"],
  });
