import type { BookingStatus } from "@/generated/prisma/enums";

/** A reservation's status is never stored: it is derived from its room lines. */
export type ReservationStatus = "PENDING" | "PARTIALLY_CONFIRMED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

const CONFIRMED_OR_LATER: readonly BookingStatus[] = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];

/**
 * - cancelled: every line is cancelled.
 * - completed: every line that wasn't cancelled is checked out.
 * - pending: no line is confirmed yet (cancelled lines don't change that).
 * - partially confirmed: some line is confirmed or later, and another is still pending or was cancelled.
 * - confirmed: every line is confirmed or later and none was cancelled.
 */
export function deriveReservationStatus(lines: readonly { status: BookingStatus }[]): ReservationStatus {
  const active = lines.filter((l) => l.status !== "CANCELLED");
  if (lines.length > 0 && active.length === 0) return "CANCELLED";
  if (active.length > 0 && active.every((l) => l.status === "CHECKED_OUT")) return "COMPLETED";
  if (!active.some((l) => CONFIRMED_OR_LATER.includes(l.status))) return "PENDING";
  const unresolved = active.some((l) => l.status === "PENDING");
  return unresolved || active.length < lines.length ? "PARTIALLY_CONFIRMED" : "CONFIRMED";
}

export type ResolutionEmail = "confirmed" | "partial" | "cancelled";

/**
 * Which email the guest gets once every room has been decided; null while any line is still pending.
 * All kept and none cancelled → confirmed; everything cancelled → cancelled; otherwise → partly confirmed.
 */
export function resolutionEmail(lines: readonly { status: BookingStatus }[]): ResolutionEmail | null {
  if (lines.length === 0 || lines.some((l) => l.status === "PENDING")) return null;
  const cancelled = lines.filter((l) => l.status === "CANCELLED").length;
  if (cancelled === lines.length) return "cancelled";
  return cancelled === 0 ? "confirmed" : "partial";
}
