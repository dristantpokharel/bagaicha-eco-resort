import { describe, expect, it } from "vitest";
import { parseDateOnly } from "./dates";
import { validateStay } from "./rules";

const today = parseDateOnly("2026-10-06")!;
const pub = { today, publicRequest: true, maxGuests: 2 };
const stay = (o: Partial<Parameters<typeof validateStay>[0]> = {}) => ({
  checkIn: "2026-10-10",
  checkOut: "2026-10-12",
  adults: 2,
  children: 0,
  ...o,
});

describe("validateStay", () => {
  it("accepts a normal request", () => {
    const r = validateStay(stay(), pub);
    expect(r).toMatchObject({ ok: true, nights: 2 });
  });
  it("accepts check-in today but not yesterday", () => {
    expect(validateStay(stay({ checkIn: "2026-10-06", checkOut: "2026-10-07" }), pub).ok).toBe(true);
    const r = validateStay(stay({ checkIn: "2026-10-05", checkOut: "2026-10-07" }), pub);
    expect(r.ok === false && r.errors.checkIn).toBeTruthy();
  });
  it("requires check-out after check-in", () => {
    const r = validateStay(stay({ checkOut: "2026-10-10" }), pub);
    expect(r.ok === false && r.errors.checkOut).toBeTruthy();
  });
  it("limits public stays to 30 nights and 365 days ahead", () => {
    expect(validateStay(stay({ checkIn: "2026-10-10", checkOut: "2026-11-09" }), pub).ok).toBe(true);
    expect(validateStay(stay({ checkIn: "2026-10-10", checkOut: "2026-11-10" }), pub).ok).toBe(false);
    expect(validateStay(stay({ checkIn: "2027-10-06", checkOut: "2027-10-07" }), pub).ok).toBe(true);
    expect(validateStay(stay({ checkIn: "2027-10-07", checkOut: "2027-10-08" }), pub).ok).toBe(false);
  });
  it("lets staff book past dates and long stays", () => {
    const staff = { today, publicRequest: false };
    expect(validateStay(stay({ checkIn: "2026-10-01", checkOut: "2026-12-01" }), staff).ok).toBe(true);
  });
  it("counts children toward the guest limit", () => {
    expect(validateStay(stay({ adults: 1, children: 1 }), pub).ok).toBe(true);
    const r = validateStay(stay({ adults: 2, children: 1 }), pub);
    expect(r.ok === false && r.errors.adults).toMatch(/up to 2 guests/);
  });
  it("needs at least one adult and non-negative children", () => {
    expect(validateStay(stay({ adults: 0 }), pub).ok).toBe(false);
    expect(validateStay(stay({ children: -1 }), pub).ok).toBe(false);
  });
});
