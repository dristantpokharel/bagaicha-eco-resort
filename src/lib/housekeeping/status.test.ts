import { describe, expect, it, vi } from "vitest";
// lib/actions pulls in Auth.js through the session module; the rules under test never use it.
vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

import { ActionError } from "@/lib/actions";
import { checkInWarning, planManualChange, roomTodo } from "./status";

const change = (from: Parameters<typeof planManualChange>[0]["from"], to: Parameters<typeof planManualChange>[0]["to"], note: string | null = null, guestInside = false) =>
  planManualChange({ from, to, note, guestInside });

describe("planManualChange", () => {
  it("allows Dirty, Ready and Out of order, and starts a new dirty cycle only for Dirty", () => {
    expect(change("READY", "DIRTY")).toEqual({ to: "DIRTY", note: null, bumpsCycle: true });
    expect(change("DIRTY", "READY")).toEqual({ to: "READY", note: null, bumpsCycle: false });
    expect(change("READY", "OUT_OF_ORDER", " leaking tap ")).toEqual({ to: "OUT_OF_ORDER", note: "leaking tap", bumpsCycle: false });
  });

  it("never sets Occupied by hand", () => {
    expect(() => change("READY", "OCCUPIED")).toThrow(ActionError);
  });

  it("requires a note for Out of order, and drops notes for other statuses", () => {
    expect(() => change("READY", "OUT_OF_ORDER", "  ")).toThrow(/what is wrong/);
    expect(change("OUT_OF_ORDER", "DIRTY", "old note").note).toBeNull();
  });

  it("sends a repaired room back to Dirty, not straight to Ready", () => {
    expect(() => change("OUT_OF_ORDER", "READY")).toThrow(/Dirty/);
    expect(change("OUT_OF_ORDER", "DIRTY").bumpsCycle).toBe(true);
  });

  it("refuses to change a room with a guest inside, or to the same status", () => {
    expect(() => change("OCCUPIED", "DIRTY", null, true)).toThrow(/checked in/);
    expect(() => change("READY", "READY")).toThrow(/already ready/);
  });

  it("lets a stale Occupied room (no guest inside) be reset", () => {
    expect(change("OCCUPIED", "DIRTY").to).toBe("DIRTY");
  });
});

describe("checkInWarning", () => {
  it("is silent for a Ready room and warns (never blocks) otherwise", () => {
    expect(checkInWarning("READY")).toBeNull();
    expect(checkInWarning("DIRTY")?.level).toBe("warn");
    expect(checkInWarning("OUT_OF_ORDER")?.level).toBe("strong");
  });
});

describe("roomTodo", () => {
  it("inspects before it preps (same-day turnaround)", () => {
    expect(roomTodo({ status: "DIRTY", inspectPending: true })).toBe("INSPECT");
    expect(roomTodo({ status: "DIRTY", inspectPending: false })).toBe("PREP");
  });
  it("does nothing for rooms that aren't Dirty", () => {
    for (const status of ["READY", "OCCUPIED", "OUT_OF_ORDER"] as const) expect(roomTodo({ status, inspectPending: true })).toBeNull();
  });
});
