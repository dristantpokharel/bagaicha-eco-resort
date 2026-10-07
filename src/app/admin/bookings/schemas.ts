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

/** Staff rooms: a JSON array of { roomTypeId, adults, children, roomId? }. A room makes that line CONFIRMED. */
const staffRoomLine = z.object({
  roomTypeId: id,
  roomId: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .transform((v) => v || undefined),
  adults: z.number().int().min(0).max(20),
  children: z.number().int().min(0).max(20),
});
const staffRoomsField = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "The room list wasn't understood. Reload the page and try again." });
      return z.NEVER;
    }
  })
  .pipe(z.array(staffRoomLine).min(1, { error: "Add at least one room." }).max(20, { error: "That is too many rooms for one booking." }));

export const manualBookingSchema = z.object({
  rooms: staffRoomsField,
  checkIn: dateString,
  checkOut: dateString,
  // Staff-entered guests: only name and phone are required (walk-ins may have no email).
  name: guestName,
  phone: requiredPhone,
  email: optionalEmail,
  country,
  source: z.enum(["PHONE", "WALK_IN", "OTHER"], { error: "Choose how the booking came in." }),
  specialRequests: longText(1000),
  internalNotes: longText(2000),
});

/** Reservation-level edits: dates (applied to every open room), the guest's requests and staff notes. */
export const updateReservationSchema = z.object({
  reservationId: id,
  checkIn: dateString.optional(),
  checkOut: dateString.optional(),
  specialRequests: longText(1000),
  internalNotes: longText(2000),
});

/** Edits to one room line. */
export const updateLineSchema = z.object({
  bookingId: id,
  roomTypeId: optionalId,
  roomId: optionalId,
  adults: adultsField.optional(),
  children: childrenField.optional(),
});

export const confirmLineSchema = z.object({ bookingId: id, roomId: id.refine(Boolean, "Choose a room.") });
export const lineIdSchema = z.object({ bookingId: id });
export const cancelLineSchema = z.object({
  bookingId: id,
  reason: z.string().trim().min(3, { error: "Give a short reason." }).max(500),
});
export const reservationIdSchema = z.object({ reservationId: id });
export const cancelReservationSchema = z.object({
  reservationId: id,
  reason: z.string().trim().min(3, { error: "Give a short reason." }).max(500),
});
