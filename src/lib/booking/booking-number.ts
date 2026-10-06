import type { Prisma } from "@/generated/prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { RESORT_TIMEZONE } from "@/lib/dates";

/** "BG-2026-000123". The counter is global and never resets between years. */
export function formatBookingNumber(year: number, sequence: number | bigint): string {
  return `BG-${year}-${String(sequence).padStart(6, "0")}`;
}

/** Next number from the database sequence. Call inside the booking's transaction. */
export async function nextBookingNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('booking_number_seq') AS n`;
  const year = Number(formatInTimeZone(now, RESORT_TIMEZONE, "yyyy"));
  return formatBookingNumber(year, rows[0].n);
}
