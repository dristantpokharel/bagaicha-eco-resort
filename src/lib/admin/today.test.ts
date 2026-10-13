import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

import { buildNextDays, loadToday, waitingLabel } from "./today";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("waitingLabel", () => {
  const now = new Date("2032-03-10T12:00:00Z");
  it("reads naturally", () => {
    expect(waitingLabel(new Date("2032-03-10T11:30:00Z"), now)).toBe("under an hour");
    expect(waitingLabel(new Date("2032-03-10T11:00:00Z"), now)).toBe("1 hour");
    expect(waitingLabel(new Date("2032-03-10T07:00:00Z"), now)).toBe("5 hours");
    expect(waitingLabel(new Date("2032-03-07T12:00:00Z"), now)).toBe("3 days");
  });
});

describe("buildNextDays", () => {
  const lines = [
    { status: "CONFIRMED" as const, checkIn: d("2032-03-11"), checkOut: d("2032-03-13") },
    { status: "CONFIRMED" as const, checkIn: d("2032-03-11"), checkOut: d("2032-03-12") },
    { status: "CHECKED_IN" as const, checkIn: d("2032-03-08"), checkOut: d("2032-03-12") },
  ];
  it("counts rooms arriving and leaving on each of the 7 days after today", () => {
    const days = buildNextDays(d("2032-03-10"), lines);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: "2032-03-11", arriving: 2, departing: 0 });
    expect(days[1]).toEqual({ date: "2032-03-12", arriving: 0, departing: 2 });
    expect(days[2]).toEqual({ date: "2032-03-13", arriving: 0, departing: 1 });
    expect(days[6].date).toBe("2032-03-17");
  });
  it("doesn't count checked-in rooms as arriving", () => {
    expect(buildNextDays(d("2032-03-07"), lines)[0]).toEqual({ date: "2032-03-08", arriving: 0, departing: 0 });
  });
});

describe("loadToday", () => {
  const reservation = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    reference: `BG-${id}`,
    guestName: `Guest ${id}`,
    guestPhone: null,
    checkIn: d("2032-03-10"),
    checkOut: d("2032-03-12"),
    createdAt: new Date("2032-03-10T01:00:00Z"),
    bookings: [
      { id: `${id}-a`, status: "CONFIRMED", adults: 2, children: 0, roomTypeId: "t1", roomType: { name: "Deluxe" }, room: { name: "201" } },
      { id: `${id}-b`, status: "PENDING", adults: 1, children: 1, roomTypeId: "t1", roomType: { name: "Deluxe" }, room: null },
      { id: `${id}-c`, status: "CANCELLED", adults: 1, children: 0, roomTypeId: "t1", roomType: { name: "Deluxe" }, room: null },
    ],
    ...over,
  });

  function client() {
    const reservationCalls: unknown[] = [];
    const findMany = vi.fn(async (args: { where: Record<string, unknown> }) => {
      reservationCalls.push(args.where);
      return args.where.checkIn ? [reservation("r1")] : [];
    });
    return {
      calls: reservationCalls,
      db: {
        room: { count: vi.fn(async () => 8), findMany: vi.fn(async () => [{ id: "rm1", name: "202" }]) },
        booking: {
          findMany: vi.fn(async (args: { select: Record<string, boolean> }) => (args.select.roomId ? [{ roomId: "rm1" }, { roomId: "rm1" }, { roomId: "rm2" }] : [])),
        },
        reservation: { findMany, count: vi.fn(async () => 14) },
      } as unknown as Parameters<typeof loadToday>[0],
    };
  }

  // 02:00 UTC on 10 March is 07:45 in Kathmandu: the same date. 20:00 UTC on 9 March is 01:45 on 10 March there.
  it("uses the Kathmandu date, even when UTC is still yesterday", async () => {
    const { db } = client();
    const data = await loadToday(db, "STAFF", new Date("2032-03-09T20:00:00Z"));
    expect(data.date).toBe("2032-03-10");
  });

  it("counts distinct rooms occupied tonight against active rooms", async () => {
    const { db } = client();
    const data = await loadToday(db, "STAFF", new Date("2032-03-10T02:00:00Z"));
    expect(data.occupiedTonight).toBe(2);
    expect(data.totalRooms).toBe(8);
  });

  it("shows an arrival's open rooms (not cancelled ones) and the free rooms for the unassigned one", async () => {
    const { db } = client();
    const data = await loadToday(db, "STAFF", new Date("2032-03-10T02:00:00Z"));
    expect(data.arrivals).toHaveLength(1);
    expect(data.arrivals[0].lines.map((l) => l.id)).toEqual(["r1-a", "r1-b"]);
    expect(data.arrivals[0].lines[1]).toMatchObject({ status: "PENDING", roomName: null, guests: 2 });
    expect(data.freeRooms).toEqual({ "r1-b": [{ id: "rm1", name: "202" }] });
    expect(data.pending.total).toBe(14);
  });

  it("returns nothing, and queries nothing, for a role without booking access", async () => {
    const { db, calls } = client();
    const mutable = (await import("@/lib/auth/permissions")).ROLE_PERMISSIONS as unknown as { STAFF: string[] };
    const original = mutable.STAFF;
    mutable.STAFF = ["inventory.recordMovements"];
    try {
      const data = await loadToday(db, "STAFF", new Date("2032-03-10T02:00:00Z"));
      expect(data.arrivals).toEqual([]);
      expect(data.totalRooms).toBe(0);
      expect(calls).toEqual([]);
    } finally {
      mutable.STAFF = original;
    }
  });
});
