import type { BookingStatus, RoomStatus } from "@/generated/prisma/enums";
import { addDays, nightsBetween, parseDateOnly, toDateOnlyString } from "./dates";
import { computeQuote } from "./pricing";
import { reservationDateFlags } from "./status";

/**
 * The tape chart's rules, as plain functions on plain data (dates are "yyyy-mm-dd" strings), so the browser can
 * show a drop as valid or red while dragging and the tests can cover every case. The server re-checks everything
 * (src/lib/booking/tape-service.ts); nothing here is trusted.
 */

export type TapeRoom = { id: string; name: string; typeId: string; isActive: boolean; /** Housekeeping status, shown as a dot. */ status?: RoomStatus };
export type TapeType = { id: string; name: string; rooms: TapeRoom[] };

export type TapeBar = {
  /** Booking or block id. */
  id: string;
  kind: "booking" | "block";
  reservationId: string | null;
  reference: string | null;
  /** Guest name, or the reason for a block. */
  title: string;
  status: BookingStatus | null;
  roomId: string | null;
  roomTypeId: string | null;
  checkIn: string;
  checkOut: string;
};

export type TapeLine = {
  id: string;
  status: BookingStatus;
  roomId: string | null;
  roomTypeId: string;
  children: number;
  pricePerNightNpr: number;
  childPricePerNightNpr: number;
  totalPriceNpr: number;
};

export type TapeReservation = {
  id: string;
  reference: string;
  guestName: string;
  hasEmail: boolean;
  lines: TapeLine[];
};

export type TapeData = {
  types: TapeType[];
  bars: TapeBar[];
  reservations: Record<string, TapeReservation>;
  /** Today in Asia/Kathmandu. */
  today: string;
};

const OCCUPYING: readonly BookingStatus[] = ["CONFIRMED", "CHECKED_IN"];
const isOpen = (s: BookingStatus) => s !== "CANCELLED" && s !== "CHECKED_OUT";

// ─── Dates ───────────────────────────────────────────────────────────────────

export const shiftDate = (date: string, days: number) => toDateOnlyString(addDays(parseDateOnly(date)!, days));
export const nightsOf = (checkIn: string, checkOut: string) => nightsBetween(parseDateOnly(checkIn)!, parseDateOnly(checkOut)!);
/** Whole days from a to b (negative when b is earlier). */
export const daysBetween = (a: string, b: string) => nightsOf(a, b);
const overlaps = (aIn: string, aOut: string, bIn: string, bOut: string) => aIn < bOut && aOut > bIn;

// ─── What a bar may do ───────────────────────────────────────────────────────

export type Caps = {
  /** Can be dragged at all. */
  drag: boolean;
  /** Can change rooms (to another room of its type, or be assigned one). */
  room: boolean;
  /** Can move both dates together. */
  shift: boolean;
  start: boolean;
  end: boolean;
};
const NONE: Caps = { drag: false, room: false, shift: false, start: false, end: false };

/**
 * Checked-in stays: only the check-out edge. Checked-out and cancelled: nothing. Blocks: Admin and above.
 * A room of a reservation that already has guests in follows the reservation's date rules (no check-in change).
 */
export function capabilities(bar: TapeBar, data: TapeData, canBlock: boolean): Caps {
  if (bar.kind === "block") return canBlock ? { drag: true, room: true, shift: true, start: true, end: true } : NONE;
  if (!bar.status || !bar.reservationId) return NONE;
  const lines = data.reservations[bar.reservationId]?.lines ?? [];
  const flags = reservationDateFlags(lines.map((l) => l.status));
  switch (bar.status) {
    case "PENDING":
      return { drag: true, room: true, shift: flags.checkIn && flags.checkOut, start: flags.checkIn, end: flags.checkOut };
    case "CONFIRMED":
      return { drag: true, room: true, shift: flags.checkIn && flags.checkOut, start: flags.checkIn, end: flags.checkOut };
    case "CHECKED_IN":
      return { drag: flags.checkOut, room: false, shift: false, start: false, end: flags.checkOut };
    default:
      return NONE;
  }
}

// ─── Targets ─────────────────────────────────────────────────────────────────

/** Where a bar would end up. `roomId` null = the Unassigned lane of `typeId`. */
export type Candidate = { roomId: string | null; typeId: string | null; checkIn: string; checkOut: string };

export type DragMode = "move" | "start" | "end";

/** The candidate for dragging a bar by `dayDelta` days onto a row. */
export function candidateFor(bar: TapeBar, mode: DragMode, dayDelta: number, row: { roomId: string | null; typeId: string | null }, caps: Caps): Candidate {
  const base = { roomId: row.roomId, typeId: row.typeId };
  if (mode === "start") return { ...base, roomId: bar.roomId, typeId: bar.roomTypeId, checkIn: shiftDate(bar.checkIn, dayDelta), checkOut: bar.checkOut };
  if (mode === "end") return { ...base, roomId: bar.roomId, typeId: bar.roomTypeId, checkIn: bar.checkIn, checkOut: shiftDate(bar.checkOut, dayDelta) };
  // An unassigned request dropped on a room is assigned for the dates it already has; sideways movement is ignored.
  const assigning = bar.kind === "booking" && bar.status === "PENDING" && row.roomId !== null;
  const delta = caps.shift && !assigning ? dayDelta : 0;
  return { ...base, checkIn: shiftDate(bar.checkIn, delta), checkOut: shiftDate(bar.checkOut, delta) };
}

export type Operation = "move" | "assign" | "block";

export type Evaluation =
  | { ok: true; op: Operation; roomChanged: boolean; datesChanged: boolean }
  | { ok: false; reason: string; noop?: boolean };

const fail = (reason: string): Evaluation => ({ ok: false, reason });

function roomName(data: TapeData, id: string) {
  for (const t of data.types) for (const r of t.rooms) if (r.id === id) return r.name;
  return "That room";
}

/** The booking or block that stops `roomId` being used for [checkIn, checkOut), ignoring `ignoreIds`. */
export function findConflict(data: TapeData, roomId: string, checkIn: string, checkOut: string, ignoreIds: ReadonlySet<string>): string | null {
  for (const other of data.bars) {
    if (other.roomId !== roomId || ignoreIds.has(other.id)) continue;
    if (!overlaps(checkIn, checkOut, other.checkIn, other.checkOut)) continue;
    if (other.kind === "block") return `${roomName(data, roomId)} is blocked for part of these dates (${other.title}).`;
    if (other.status && OCCUPYING.includes(other.status)) return `${roomName(data, roomId)} is already booked for overlapping dates (${other.reference}, ${other.title}).`;
  }
  return null;
}

/** Whether a candidate is allowed, and what kind of change it is. The first broken rule explains itself. */
export function evaluate(bar: TapeBar, cand: Candidate, data: TapeData, ctx: { canBlock: boolean }): Evaluation {
  const caps = capabilities(bar, data, ctx.canBlock);
  if (!caps.drag) return fail(bar.kind === "block" ? "Only an Admin can change blocks." : "This stay can't be changed any more.");

  const datesChanged = cand.checkIn !== bar.checkIn || cand.checkOut !== bar.checkOut;
  const roomChanged = cand.roomId !== bar.roomId;
  if (!datesChanged && !roomChanged) return { ok: false, reason: "No change.", noop: true };
  if (nightsOf(cand.checkIn, cand.checkOut) < 1) return fail("A stay needs at least one night.");

  const targetRoom = cand.roomId ? data.types.flatMap((t) => t.rooms).find((r) => r.id === cand.roomId) : null;
  if (cand.roomId && (!targetRoom || !targetRoom.isActive)) return fail("That room is archived.");

  // ─── Blocks: any active room, nothing booked there.
  if (bar.kind === "block") {
    if (!cand.roomId) return fail("A block belongs to a room.");
    const clash = findConflict(data, cand.roomId, cand.checkIn, cand.checkOut, new Set([bar.id]));
    return clash ? fail(clash) : { ok: true, op: "block", roomChanged, datesChanged };
  }

  // ─── Bookings.
  if (cand.typeId !== bar.roomTypeId) return fail("Room type can't change here. Cancel and rebook to change the type.");
  if (datesChanged) {
    if (cand.checkIn !== bar.checkIn && !caps.start) return fail("Check-in can't change once guests are in or checked out.");
    if (cand.checkOut !== bar.checkOut && !caps.end) return fail("This stay can't end on another day.");
  }

  const isPending = bar.status === "PENDING";
  if (roomChanged) {
    if (!caps.room) return fail("A stay that has started stays in its room.");
    if (!cand.roomId) return fail("A confirmed room can't go back to unassigned.");
    if (isPending && datesChanged) return fail("Assign the room first, then change the dates.");
  }

  // Every room of the reservation that holds a physical room moves with the dates; each must be free.
  const reservation = data.reservations[bar.reservationId!];
  const siblings = reservation?.lines.filter((l) => isOpen(l.status) && OCCUPYING.includes(l.status) && l.id !== bar.id) ?? [];
  const mine = !isPending || roomChanged ? [{ id: bar.id, roomId: cand.roomId }] : [];
  for (const l of [...mine, ...(datesChanged ? siblings.map((s) => ({ id: s.id, roomId: s.roomId })) : [])]) {
    if (!l.roomId) continue;
    const clash = findConflict(data, l.roomId, cand.checkIn, cand.checkOut, new Set([l.id]));
    if (clash) return fail(l.id === bar.id ? clash : `${clash} (another room of the same booking)`);
  }

  return { ok: true, op: isPending && roomChanged ? "assign" : "move", roomChanged, datesChanged };
}

// ─── Price impact ────────────────────────────────────────────────────────────

/** The reservation's total before and after its open rooms take `checkIn`–`checkOut` (each from its own rates). */
export function priceImpact(bar: TapeBar, cand: Pick<Candidate, "checkIn" | "checkOut">, data: TapeData): { before: number; after: number; rooms: number } {
  const lines = (bar.reservationId ? data.reservations[bar.reservationId]?.lines : undefined) ?? [];
  const kept = lines.filter((l) => l.status !== "CANCELLED");
  const nights = nightsOf(cand.checkIn, cand.checkOut);
  const repriced = (l: TapeLine) =>
    computeQuote({ nights, pricePerNightNpr: l.pricePerNightNpr, childPricePerNightNpr: l.childPricePerNightNpr, children: l.children }).totalPriceNpr;
  return {
    before: kept.reduce((n, l) => n + l.totalPriceNpr, 0),
    after: kept.reduce((n, l) => n + (isOpen(l.status) ? repriced(l) : l.totalPriceNpr), 0),
    rooms: kept.filter((l) => isOpen(l.status)).length,
  };
}

// ─── Proposals (what the confirm dialog shows) ───────────────────────────────

export type Proposal = {
  op: Operation;
  bar: TapeBar;
  to: Candidate;
  roomChanged: boolean;
  datesChanged: boolean;
  /** Open rooms of the reservation that change dates together (1 for a single room). */
  rooms: number;
  price: { before: number; after: number } | null;
  /** Guest has an email address on the reservation. */
  guestHasEmail: boolean;
  /** Date changes email the guest by default; room swaps don't. */
  defaultNotify: boolean;
};

export function buildProposal(bar: TapeBar, cand: Candidate, data: TapeData, ctx: { canBlock: boolean }): { ok: true; proposal: Proposal } | { ok: false; reason: string; noop?: boolean } {
  const result = evaluate(bar, cand, data, ctx);
  if (!result.ok) return result;
  const reservation = bar.reservationId ? data.reservations[bar.reservationId] : undefined;
  const impact = result.datesChanged && bar.kind === "booking" ? priceImpact(bar, cand, data) : null;
  return {
    ok: true,
    proposal: {
      op: result.op,
      bar,
      to: cand,
      roomChanged: result.roomChanged,
      datesChanged: result.datesChanged,
      rooms: impact?.rooms ?? 1,
      price: impact ? { before: impact.before, after: impact.after } : null,
      guestHasEmail: reservation?.hasEmail ?? false,
      defaultNotify: result.op === "move" && result.datesChanged,
    },
  };
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

/** Packs bars into the fewest rows so none overlap (the Unassigned rows of a room type). */
export function packLanes<T extends { checkIn: string; checkOut: string }>(bars: readonly T[]): T[][] {
  const lanes: T[][] = [];
  for (const bar of [...bars].sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.checkOut.localeCompare(b.checkOut))) {
    const lane = lanes.find((l) => l[l.length - 1].checkOut <= bar.checkIn);
    if (lane) lane.push(bar);
    else lanes.push([bar]);
  }
  return lanes;
}

/** The nights of a room that nothing occupies or blocks, within [from, to). */
export function isNightFree(data: TapeData, roomId: string, night: string): boolean {
  return findConflict(data, roomId, night, shiftDate(night, 1), new Set()) === null;
}

/** Clamps a drag-selection of empty nights to the free run that contains `anchor`. */
export function freeRun(data: TapeData, roomId: string, anchor: string, current: string): { checkIn: string; checkOut: string } | null {
  if (!isNightFree(data, roomId, anchor)) return null;
  const forward = current >= anchor;
  let edge = anchor;
  const step = forward ? 1 : -1;
  while (edge !== current) {
    const next = shiftDate(edge, step);
    if (!isNightFree(data, roomId, next)) break;
    edge = next;
  }
  const first = forward ? anchor : edge;
  const last = forward ? edge : anchor;
  return { checkIn: first, checkOut: shiftDate(last, 1) };
}
