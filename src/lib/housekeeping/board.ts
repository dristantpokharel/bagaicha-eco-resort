import type { RoomStatus } from "@/generated/prisma/enums";
import { roomTodo, type RoomTodo } from "./status";

export type BoardStay = { bookingId: string; reference: string; guestName: string };

export type BoardRoom = {
  id: string;
  name: string;
  roomTypeName: string;
  status: RoomStatus;
  statusNote: string | null;
  inspectPending: boolean;
  /** A prep with a store shortfall is the latest word on this Ready room. */
  preppedShort: boolean;
  arrivalToday: BoardStay | null;
  departureToday: BoardStay | null;
  /** A date block covers today (the room may be out for a while). */
  blockedToday: boolean;
  todo: RoomTodo;
  /** Check-out and arrival in one room today. */
  sameDay: boolean;
};

export type BoardFilter = "all" | "prep" | "inspect" | "ooo";

export const BOARD_FILTERS: { value: BoardFilter; label: string }[] = [
  { value: "all", label: "All rooms" },
  { value: "prep", label: "Needs prep" },
  { value: "inspect", label: "Needs inspection" },
  { value: "ooo", label: "Out of order" },
];

export function parseBoardFilter(value: string | undefined): BoardFilter {
  return BOARD_FILTERS.some((f) => f.value === value) ? (value as BoardFilter) : "all";
}

export function toBoardRoom(
  room: { id: string; name: string; roomTypeName: string; status: RoomStatus; statusNote: string | null; inspectBookingId: string | null },
  facts: { arrivalToday: BoardStay | null; departureToday: BoardStay | null; preppedShort: boolean; blockedToday: boolean },
): BoardRoom {
  const inspectPending = room.inspectBookingId !== null;
  return {
    id: room.id,
    name: room.name,
    roomTypeName: room.roomTypeName,
    status: room.status,
    statusNote: room.statusNote,
    inspectPending,
    preppedShort: room.status === "READY" && facts.preppedShort,
    arrivalToday: facts.arrivalToday,
    departureToday: facts.departureToday,
    blockedToday: facts.blockedToday,
    todo: roomTodo({ status: room.status, inspectPending }),
    sameDay: facts.arrivalToday !== null && facts.departureToday !== null,
  };
}

/**
 * Filters the board. "Needs prep" is every Dirty room (housekeeping cleans right after checkout, not only before
 * arrivals); "needs inspection" is a checked-out stay still to count. Rooms with work today come first.
 */
export function filterBoard(rooms: readonly BoardRoom[], filter: BoardFilter): BoardRoom[] {
  const keep = (r: BoardRoom) =>
    filter === "prep" ? r.status === "DIRTY" : filter === "inspect" ? r.todo === "INSPECT" : filter === "ooo" ? r.status === "OUT_OF_ORDER" : true;
  const urgency = (r: BoardRoom) => (r.todo && r.arrivalToday ? 0 : r.todo ? 1 : r.status === "OUT_OF_ORDER" ? 2 : 3);
  return rooms.filter(keep).sort((a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** The two Today lists: arrivals whose room still needs preparing, and stays to inspect. */
export function todayHousekeeping(rooms: readonly BoardRoom[]) {
  return {
    toPrep: rooms.filter((r) => r.arrivalToday && (r.status === "DIRTY" || r.status === "OUT_OF_ORDER")),
    toInspect: rooms.filter((r) => r.todo === "INSPECT"),
  };
}
