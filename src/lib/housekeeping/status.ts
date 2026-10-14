import type { RoomStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  DIRTY: "Dirty",
  READY: "Ready",
  OCCUPIED: "Occupied",
  OUT_OF_ORDER: "Out of order",
};

/** What staff may set by hand. Occupied only ever comes from checking a guest in. */
export const MANUAL_STATUSES = ["DIRTY", "READY", "OUT_OF_ORDER"] as const satisfies readonly RoomStatus[];

export const OUT_OF_ORDER_HINT = "Block dates on the calendar if it'll be out for a while.";

export type ManualChange = { to: RoomStatus; note: string | null; bumpsCycle: boolean };

/**
 * Rules for a hand-made status change. Throws an ActionError (with a field error) when it isn't allowed.
 * `guestInside` is true while a booking in the room is checked in.
 */
export function planManualChange(params: { from: RoomStatus; to: RoomStatus; note: string | null; guestInside: boolean }): ManualChange {
  const { from, to } = params;
  const note = params.note?.trim() || null;
  if (!(MANUAL_STATUSES as readonly RoomStatus[]).includes(to)) {
    throw new ActionError("Occupied is set by checking a guest in.", { status: "Choose Dirty, Ready or Out of order." });
  }
  if (from === to) throw new ActionError(`The room is already ${ROOM_STATUS_LABELS[to].toLowerCase()}.`);
  if (params.guestInside) throw new ActionError("A guest is checked in to this room. Check them out first.");
  if (from === "OUT_OF_ORDER" && to === "READY") {
    throw new ActionError("A room that was out of order goes back to Dirty so it gets checked and prepared.", {
      status: "Choose Dirty.",
    });
  }
  if (to === "OUT_OF_ORDER" && !note) {
    throw new ActionError("Say what is wrong with the room.", { note: "Say what is wrong (for example: leaking tap)." });
  }
  return { to, note: to === "OUT_OF_ORDER" ? note : null, bumpsCycle: to === "DIRTY" };
}

export type CheckInWarning = { level: "warn" | "strong"; message: string };

/** The warning shown before checking a guest into a room that isn't Ready. Never blocks. */
export function checkInWarning(status: RoomStatus): CheckInWarning | null {
  switch (status) {
    case "READY":
      return null;
    case "OUT_OF_ORDER":
      return { level: "strong", message: "This room is marked out of order. Check in anyway?" };
    case "DIRTY":
      return { level: "warn", message: "This room hasn't been prepared yet (it is Dirty). Check in anyway?" };
    case "OCCUPIED":
      return { level: "warn", message: "This room is marked occupied. Check in anyway?" };
  }
}

export type RoomTodo = "INSPECT" | "PREP" | null;

/**
 * What housekeeping owes a room right now. A checked-out stay is inspected before the room is prepared
 * (same-day turnaround included). Only Dirty rooms are worked on; out-of-order rooms are never prepped.
 */
export function roomTodo(room: { status: RoomStatus; inspectPending: boolean }): RoomTodo {
  if (room.status !== "DIRTY") return null;
  return room.inspectPending ? "INSPECT" : "PREP";
}
