import type { BookingStatus } from "@/generated/prisma/enums";
import type { Permission } from "@/lib/auth/permissions";

/** PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT; CANCELLED from PENDING or CONFIRMED (docs/spec.md §1.2). */
export const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Cancelling needs its own permission (Staff can't); every other change uses changeStatus. */
export function permissionForTransition(to: BookingStatus): Permission {
  return to === "CANCELLED" ? "bookings.cancel" : "bookings.changeStatus";
}

/** Which parts of a booking may still be edited, by status. */
export type EditableFlags = {
  checkIn: boolean;
  checkOut: boolean;
  party: boolean;
  roomType: boolean;
  room: boolean;
  guestRequests: boolean;
  notes: boolean;
};

export function editableFlags(status: BookingStatus): EditableFlags {
  switch (status) {
    case "PENDING":
      return { checkIn: true, checkOut: true, party: true, roomType: true, room: false, guestRequests: true, notes: true };
    case "CONFIRMED":
      return { checkIn: true, checkOut: true, party: true, roomType: false, room: true, guestRequests: true, notes: true };
    case "CHECKED_IN":
      return { checkIn: false, checkOut: true, party: false, roomType: false, room: false, guestRequests: true, notes: true };
    default:
      return { checkIn: false, checkOut: false, party: false, roomType: false, room: false, guestRequests: false, notes: true };
  }
}
