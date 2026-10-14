import type { RoomStatus } from "@/generated/prisma/enums";

// No server-only imports here: client components (tape chart, status badge, status control) use these.

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  DIRTY: "Dirty",
  READY: "Ready",
  OCCUPIED: "Occupied",
  OUT_OF_ORDER: "Out of order",
};

/** What staff may set by hand. Occupied only ever comes from checking a guest in. */
export const MANUAL_STATUSES = ["DIRTY", "READY", "OUT_OF_ORDER"] as const satisfies readonly RoomStatus[];

export const OUT_OF_ORDER_HINT = "Block dates on the calendar if it'll be out for a while.";
