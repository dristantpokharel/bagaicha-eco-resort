import { describe, expect, it } from "vitest";
import { fillTokens, type TokenContext } from "./tokens";

const ctx: TokenContext = {
  checkInTime: "2:00 PM",
  checkOutTime: "11:00 AM",
  address: "Khairi, Gulariya-3, Bardiya, Nepal",
  cancellationPolicy: "Tell us 24 hours ahead.",
  childUnderAge: 8,
  rooms: [
    { name: "Family Room", maxGuests: 6, maxAdults: 6, maxChildren: null, childPricePerNightNpr: 0 },
    { name: "Deluxe Room", maxGuests: 3, maxAdults: 2, maxChildren: null, childPricePerNightNpr: 500 },
  ],
  nearby: [{ name: "Nepalgunj", distance: "~40 km", travelTime: "53 mins" }],
};

describe("fillTokens", () => {
  it("fills times, address and the cancellation policy", () => {
    const r = fillTokens("In {{checkInTime}}, out {{ checkOutTime }}. {{address}}. {{cancellationPolicy}}", ctx);
    expect(r).toEqual({
      text: "In 2:00 PM, out 11:00 AM. Khairi, Gulariya-3, Bardiya, Nepal. Tell us 24 hours ahead.",
      complete: true,
    });
  });

  it("describes rooms and per-room child rates from the database values", () => {
    expect(fillTokens("{{rooms}}", ctx).text).toBe(
      "Family Room (up to 6 guests, children included) and Deluxe Room (up to 3 guests, children included, max 2 adults)",
    );
    expect(fillTokens("{{childRates}}", ctx).text).toBe(
      "Family Room: children stay free; Deluxe Room: NPR 500 per child per night",
    );
    expect(fillTokens("under {{childUnderAge}}", ctx).text).toBe("under 8");
  });

  it("looks up a nearby place by name, ignoring case", () => {
    expect(fillTokens("{{nearby:nepalgunj}}", ctx).text).toBe("~40 km (53 mins)");
  });

  it("marks text incomplete when a fact is missing or the token is unknown", () => {
    expect(fillTokens("{{nearby:Atlantis}}", ctx)).toEqual({ text: "{{nearby:Atlantis}}", complete: false });
    expect(fillTokens("{{checkInTime}}", { ...ctx, checkInTime: null }).complete).toBe(false);
    expect(fillTokens("{{nope}}", ctx).complete).toBe(false);
  });

  it("leaves ordinary text alone", () => {
    expect(fillTokens("Plain text.", ctx)).toEqual({ text: "Plain text.", complete: true });
  });
});
