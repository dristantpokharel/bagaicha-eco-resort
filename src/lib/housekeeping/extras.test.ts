import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

import { ActionError } from "@/lib/actions";
import { addExtraSchema } from "./schemas";
import { buildPrepLines } from "./checklist";
import { planExtraTiming } from "./extras";

const base = { hasRoom: true, roomStatus: "READY" as const, isNextArrival: true };

describe("planExtraTiming", () => {
  it("applies at once when the room is Ready for this guest's arrival", () => {
    expect(planExtraTiming({ ...base, bookingStatus: "CONFIRMED" })).toBe("NOW");
  });

  it("applies at once during the stay", () => {
    expect(planExtraTiming({ ...base, bookingStatus: "CHECKED_IN", roomStatus: "OCCUPIED", isNextArrival: false })).toBe("NOW");
  });

  it.each(["DIRTY", "OUT_OF_ORDER", "OCCUPIED"] as const)("waits for prep when the room is %s", (roomStatus) => {
    expect(planExtraTiming({ ...base, bookingStatus: "CONFIRMED", roomStatus })).toBe("LATER");
  });

  it("waits when the room is Ready for someone else's earlier arrival", () => {
    expect(planExtraTiming({ ...base, bookingStatus: "CONFIRMED", isNextArrival: false })).toBe("LATER");
  });

  it("waits when no room is assigned yet", () => {
    expect(planExtraTiming({ bookingStatus: "PENDING", hasRoom: false, roomStatus: null, isNextArrival: false })).toBe("LATER");
  });

  it("refuses a stay that has ended or was cancelled", () => {
    for (const bookingStatus of ["CHECKED_OUT", "CANCELLED"] as const) {
      expect(() => planExtraTiming({ ...base, bookingStatus })).toThrow(ActionError);
    }
  });
});

describe("prep checklist with extras", () => {
  const items = new Map([
    ["blanket", { id: "blanket", name: "Blanket", unit: "pcs", isConsumable: false, isFixedInRoom: false, isActive: true }],
    ["heater", { id: "heater", name: "Heater", unit: "pcs", isConsumable: false, isFixedInRoom: true, isActive: true }],
  ]);

  it("shows par and the extra separately, and needs both", () => {
    const [line] = buildPrepLines({
      par: new Map([["blanket", "1"]]),
      extras: new Map([["blanket", "2"]]),
      items,
      inRoom: new Map(),
      available: new Map([["blanket", "9"]]),
    });
    expect(line).toMatchObject({ par: "1", extra: "2", need: "3" });
  });

  it("lists an extra for an item that isn't on the par list", () => {
    const lines = buildPrepLines({ par: new Map(), extras: new Map([["heater", "1"]]), items, inRoom: new Map(), available: new Map([["heater", "1"]]) });
    expect(lines).toMatchObject([{ itemId: "heater", par: "0", extra: "1", need: "1" }]);
  });
});

describe("addExtraSchema", () => {
  const ok = { bookingId: "b", itemId: "i", quantity: "2" };
  it("takes a positive number and an optional note", () => {
    expect(addExtraSchema.parse({ ...ok, note: " cold night " })).toMatchObject({ quantity: "2", note: "cold night" });
    expect(addExtraSchema.parse({ ...ok, note: "" }).note).toBeNull();
  });
  it("rejects blank, negative and non-numeric amounts and a missing item", () => {
    for (const quantity of ["", "-1", "abc", "1,5"]) expect(addExtraSchema.safeParse({ ...ok, quantity }).success).toBe(false);
    expect(addExtraSchema.safeParse({ ...ok, itemId: "" }).success).toBe(false);
  });
});
