import { BOOKING } from "@/config/booking";
import { partyProblem, type Capacity } from "./capacity";
import { addDays, nightsBetween, parseDateOnly } from "./dates";

export type StayInput = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
};

export type StayValidation =
  | { ok: true; checkIn: Date; checkOut: Date; nights: number }
  | { ok: false; errors: Record<string, string> };

/**
 * Date and party rules. `today` is the date in Asia/Kathmandu (todayInResort()).
 * `publicRequest` adds the limits guests face; staff may book past dates or
 * longer stays. `capacity` is the room type's occupancy limits (capacity.ts).
 */
export function validateStay(
  input: StayInput,
  options: { today: Date; publicRequest: boolean; capacity?: Capacity },
): StayValidation {
  const errors: Record<string, string> = {};
  const checkIn = parseDateOnly(input.checkIn);
  const checkOut = parseDateOnly(input.checkOut);

  if (!checkIn) errors.checkIn = "Choose a check-in date.";
  if (!checkOut) errors.checkOut = "Choose a check-out date.";

  let nights = 0;
  if (checkIn && checkOut) {
    nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) errors.checkOut = "Check-out must be after check-in.";
    else if (options.publicRequest && nights > BOOKING.maxNights) {
      errors.checkOut = `Stays are limited to ${BOOKING.maxNights} nights. Please send an enquiry for longer stays.`;
    }
    if (options.publicRequest) {
      if (checkIn < options.today) errors.checkIn = "Check-in can't be in the past.";
      else if (checkIn > addDays(options.today, BOOKING.maxDaysAhead)) {
        errors.checkIn = `Bookings open up to ${BOOKING.maxDaysAhead} days ahead.`;
      }
    }
  }

  if (!Number.isInteger(input.adults) || input.adults < 1) errors.adults = "At least 1 adult is needed.";
  if (!Number.isInteger(input.children) || input.children < 0) errors.children = "Enter 0 or more children.";
  if (options.capacity && !errors.adults && !errors.children) {
    const problem = partyProblem(options.capacity, { adults: input.adults, children: input.children });
    if (problem) errors[problem.field] = problem.message;
  }

  if (Object.keys(errors).length || !checkIn || !checkOut) return { ok: false, errors };
  return { ok: true, checkIn, checkOut, nights };
}
