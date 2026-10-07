import { describe, expect, it } from "vitest";
import { snapshotDiff, snapshotOf, type ContactDetails } from "./guest-snapshot";

const saved: ContactDetails = { name: "Sita Rai", email: "sita@example.test", phone: "9800000001", country: "Nepal" };

describe("snapshotOf", () => {
  it("reads the reservation's guest columns in the guest's shape", () => {
    expect(snapshotOf({ guestName: "A", guestEmail: null, guestPhone: "1", guestCountry: null })).toEqual({ name: "A", email: null, phone: "1", country: null });
  });
});

describe("snapshotDiff", () => {
  it("is empty when the details match (ignoring case and surrounding spaces)", () => {
    expect(snapshotDiff({ ...saved, name: " sita rai ", email: "SITA@example.test" }, saved)).toEqual([]);
  });

  it("lists each field that differs", () => {
    expect(snapshotDiff({ ...saved, name: "Sita Rai Magar", phone: "9811111111" }, saved)).toEqual(["name", "phone"]);
  });

  it("does not count a field left blank on the submission", () => {
    expect(snapshotDiff({ name: "Sita Rai", email: null, phone: "", country: null }, saved)).toEqual([]);
  });

  it("counts a submitted value where the guest has none", () => {
    expect(snapshotDiff(saved, { ...saved, country: null })).toEqual(["country"]);
  });
});
