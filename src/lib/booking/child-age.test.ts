import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fillTokens, type TokenContext } from "@/lib/content/tokens";
import { buildSchema, COLLECTIONS } from "@/lib/content/collections";
import { bookingCancelledEmail, requestReceivedEmail, type ReservationEmailData } from "@/lib/email/templates";
import { computeQuote } from "./pricing";

const ctx = (childUnderAge: number): TokenContext => ({
  checkInTime: null,
  checkOutTime: null,
  address: null,
  cancellationPolicy: null,
  childUnderAge,
  rooms: [],
  nearby: [],
});

const booking = (childUnderAge: number): ReservationEmailData => ({
  id: "r1",
  reference: "BG-2026-000001",
  guestName: "Test Guest",
  guestEmail: "guest@example.com",
  guestPhone: null,
  checkIn: new Date("2026-11-10T00:00:00Z"),
  checkOut: new Date("2026-11-12T00:00:00Z"),
  nights: 2,
  lines: [
    {
      roomTypeName: "Family Room",
      roomName: null,
      adults: 2,
      children: 1,
      status: "PENDING",
      cancellationReason: null,
      quote: computeQuote({ nights: 2, pricePerNightNpr: 4500, childPricePerNightNpr: 500, children: 1 }),
    },
  ],
  specialRequests: null,
  terms: { checkInTime: null, checkOutTime: null, childUnderAge, cancellationPolicy: null },
});

describe("child age setting", () => {
  it("FAQ tokens read the saved value", () => {
    const text = "Children under {{childUnderAge}} pay a rate. Children {{childUnderAge}} and over count as adults.";
    expect(fillTokens(text, ctx(6)).text).toBe("Children under 6 pay a rate. Children 6 and over count as adults.");
    expect(fillTokens(text, ctx(10)).text).toContain("under 10");
  });

  it("emails read it from the stay terms", () => {
    expect(requestReceivedEmail(booking(5)).text).toContain("1 child under 5");
    expect(requestReceivedEmail(booking(12)).text).toContain("1 child under 12");
    expect(bookingCancelledEmail(booking(7)).text).not.toContain("under 8");
  });

  it("is a required whole number in Business info, with sensible bounds", () => {
    const schema = buildSchema(COLLECTIONS.business);
    const base = { name: "Bagaicha" };
    const parse = (value: string) => schema.safeParse({ ...base, childUnderAge: value });
    expect(parse("7").success).toBe(true);
    expect((parse("7").data as { childUnderAge: number }).childUnderAge).toBe(7);
    expect(parse("").success).toBe(false);
    expect(parse("0").success).toBe(false);
    expect(parse("2.5").success).toBe(false);
    expect(parse("18").success).toBe(false);
  });

  it("is not hardcoded anywhere in the app source", () => {
    const root = join(process.cwd(), "src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === "generated") continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(path);
      }
    };
    walk(root);
    const offenders = files.filter((f) => /\b[Uu]nder 8\b|children 8\+|\b8\+/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
