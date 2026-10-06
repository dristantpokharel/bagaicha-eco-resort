import { BOOKING } from "@/config/booking";
import { formatNpr } from "@/lib/money";

/**
 * FAQ answers and policy text can name a fact with a token instead of repeating it, so the
 * fact stays in one place (docs: AGENTS.md rule 6):
 *
 *   {{checkInTime}} {{checkOutTime}} {{address}} {{cancellationPolicy}} {{childUnderAge}}
 *   {{childRates}} {{rooms}} {{nearby:Nepalgunj}}
 *
 * A token that can't be filled (no value saved yet) leaves the whole text incomplete, and
 * the site hides incomplete text in production.
 */
export type TokenContext = {
  checkInTime: string | null;
  checkOutTime: string | null;
  address: string | null;
  cancellationPolicy: string | null;
  rooms: { name: string; maxGuests: number; childPricePerNightNpr: number }[];
  nearby: { name: string; distance: string | null; travelTime: string | null }[];
};

export const TOKEN_HELP =
  "You can use {{checkInTime}}, {{checkOutTime}}, {{address}}, {{cancellationPolicy}}, {{childUnderAge}}, {{childRates}}, {{rooms}} and {{nearby:Place name}} to insert saved facts.";

const guests = (n: number) => `${n} guest${n === 1 ? "" : "s"}`;

function resolve(name: string, arg: string | undefined, ctx: TokenContext): string | null {
  switch (name) {
    case "checkInTime":
      return ctx.checkInTime;
    case "checkOutTime":
      return ctx.checkOutTime;
    case "address":
      return ctx.address;
    case "cancellationPolicy":
      return ctx.cancellationPolicy;
    case "childUnderAge":
      return String(BOOKING.childUnderAge);
    case "childRates":
      return ctx.rooms.length
        ? ctx.rooms
            .map((r) =>
              r.childPricePerNightNpr > 0
                ? `${r.name}: ${formatNpr(r.childPricePerNightNpr)} per child per night`
                : `${r.name}: children stay free`,
            )
            .join("; ")
        : null;
    case "rooms":
      return ctx.rooms.length
        ? ctx.rooms.map((r) => `${r.name} (up to ${guests(r.maxGuests)}, children included)`).join(" and ")
        : null;
    case "nearby": {
      const place = ctx.nearby.find((n) => n.name.toLowerCase() === (arg ?? "").trim().toLowerCase());
      if (!place?.distance) return null;
      return place.travelTime ? `${place.distance} (${place.travelTime})` : place.distance;
    }
    default:
      return null;
  }
}

export function fillTokens(text: string, ctx: TokenContext): { text: string; complete: boolean } {
  let complete = true;
  const filled = text.replace(/\{\{\s*([a-zA-Z]+)\s*(?::([^}]*))?\}\}/g, (match, name: string, arg?: string) => {
    const value = resolve(name, arg, ctx);
    if (value == null || value === "") {
      complete = false;
      return match;
    }
    return value;
  });
  return { text: filled, complete };
}
