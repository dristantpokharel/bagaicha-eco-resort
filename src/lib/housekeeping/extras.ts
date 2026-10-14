import type { BookingStatus, RoomStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";

export type ExtraTiming = "NOW" | "LATER";

/**
 * When does an extra go into the room? Straight away when the room is already set up for this guest: in-house, or
 * Ready and this is its next arrival. Otherwise it waits on the prep checklist (room Dirty or out of order, a guest
 * still inside, a later booking, or no room assigned yet).
 */
export function planExtraTiming(params: {
  bookingStatus: BookingStatus;
  hasRoom: boolean;
  roomStatus: RoomStatus | null;
  isNextArrival: boolean;
}): ExtraTiming {
  const { bookingStatus, hasRoom, roomStatus, isNextArrival } = params;
  if (bookingStatus === "CANCELLED" || bookingStatus === "CHECKED_OUT") {
    throw new ActionError("Extras can only be added to a stay that hasn't ended or been cancelled.");
  }
  if (!hasRoom) return "LATER";
  if (bookingStatus === "CHECKED_IN") return "NOW";
  if (bookingStatus === "CONFIRMED" && roomStatus === "READY" && isNextArrival) return "NOW";
  return "LATER";
}
