import { z } from "zod";
import {
  adultsField,
  childrenField,
  country,
  guestName,
  longText,
  optionalEmail,
  requiredPhone,
} from "@/lib/booking/schemas";

const id = z.string().trim().min(1).max(64);
const dateString = z.string().trim().max(10);
/** Selects send "" for "none". */
const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => v || undefined);

export const manualBookingSchema = z.object({
  roomTypeId: id,
  checkIn: dateString,
  checkOut: dateString,
  adults: adultsField,
  children: childrenField,
  // Staff-entered guests: only name and phone are required (walk-ins may have no email).
  name: guestName,
  phone: requiredPhone,
  email: optionalEmail,
  country,
  source: z.enum(["PHONE", "WALK_IN", "OTHER"], { error: "Choose how the booking came in." }),
  /** Assigning a room creates the booking as CONFIRMED. */
  roomId: optionalId,
  specialRequests: longText(1000),
  internalNotes: longText(2000),
});

export const updateBookingSchema = z.object({
  bookingId: id,
  roomTypeId: optionalId,
  roomId: optionalId,
  checkIn: dateString.optional(),
  checkOut: dateString.optional(),
  adults: adultsField.optional(),
  children: childrenField.optional(),
  specialRequests: longText(1000),
  internalNotes: longText(2000),
});

export const confirmBookingSchema = z.object({ bookingId: id, roomId: id.refine(Boolean, "Choose a room.") });
export const bookingIdSchema = z.object({ bookingId: id });
export const cancelBookingSchema = z.object({
  bookingId: id,
  reason: z.string().trim().min(3, { error: "Give a short reason." }).max(500),
});
