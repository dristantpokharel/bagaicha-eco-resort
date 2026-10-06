import { BOOKING } from "@/config/booking";

/**
 * Normalizes a phone number to international form ("+9779812345678").
 * Numbers without a country code get the default (+977); a single leading 0
 * is dropped. Returns null when it can't be a valid number (8–15 digits, E.164).
 */
export function normalizePhone(input: string, defaultCountryCode: string = BOOKING.defaultCountryCode): string | null {
  const cleaned = input.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;

  const defaultDigits = defaultCountryCode.replace(/\D/g, "");
  let digits: string;
  if (cleaned.startsWith("+")) digits = cleaned.slice(1);
  else if (cleaned.startsWith("00")) digits = cleaned.slice(2);
  // "977 98…" typed without the plus.
  else if (cleaned.startsWith(defaultDigits) && cleaned.length >= defaultDigits.length + 8) digits = cleaned;
  else digits = defaultDigits + cleaned.replace(/^0+/, "");

  if (digits.startsWith("0") || digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** wa.me link for a stored (normalized) number. */
export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
