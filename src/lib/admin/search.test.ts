import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { normaliseQuery, phoneDigits, searchAdmin, searchKindsFor } from "./search";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

/** A client that records which tables were read and returns one row for each. */
function fakeClient() {
  const calls: string[] = [];
  const find = (name: string, row: unknown) => vi.fn(async (args: unknown) => (calls.push(name), void args, [row]));
  const client = {
    reservation: { findMany: find("reservation", { id: "r1", reference: "BG-2032-000007", guestName: "Sita Rai", guestPhone: "+9779812345678", checkIn: new Date("2032-01-10"), checkOut: new Date("2032-01-12"), bookings: [{ status: "PENDING" }] }) },
    guest: { findMany: find("guest", { id: "g1", name: "Sita Rai", email: null, phone: "+9779812345678", _count: { reservations: 2 } }) },
    enquiry: { findMany: find("enquiry", { id: "e1", name: "Ram", email: "ram@example.test", phone: null, status: "NEW" }) },
    inventoryItem: { findMany: find("inventory", { id: "i1", name: "Soap", category: "Bathroom", isActive: true, quantity: new Prisma.Decimal(0), lowStockThreshold: new Prisma.Decimal(5) }) },
    activityLog: { create: vi.fn() },
  };
  return { client: client as unknown as Parameters<typeof searchAdmin>[0], calls, raw: client };
}

describe("query handling", () => {
  it("needs two characters", () => {
    expect(normaliseQuery(" a ")).toBeNull();
    expect(normaliseQuery("  ab  ")).toBe("ab");
    expect(normaliseQuery("sita   rai")).toBe("sita rai");
  });
  it("only treats phone-looking queries as phone digits, from three digits", () => {
    expect(phoneDigits("5678")).toBe("5678");
    expect(phoneDigits("+977 98-123")).toBe("97798123");
    expect(phoneDigits("98")).toBeNull();
    expect(phoneDigits("BG-2032-000007")).toBeNull();
  });
});

describe("search permission filtering", () => {
  it("staff can search bookings, guests, enquiries and inventory", () => {
    expect(searchKindsFor("STAFF")).toEqual(["reservation", "guest", "enquiry", "inventory"]);
  });

  it("returns grouped hits with status chips", async () => {
    const { client } = fakeClient();
    const groups = await searchAdmin(client, "ADMIN", "sita");
    expect(groups.map((g) => g.label)).toEqual(["Bookings", "Guests", "Enquiries", "Inventory"]);
    expect(groups[0].hits[0]).toMatchObject({ href: "/admin/bookings/r1", chip: { label: "Pending", tone: "pending" } });
    expect(groups[3].hits[0].chip).toEqual({ label: "Out of stock", tone: "bad" });
  });

  it("never queries a table the role has no permission for", async () => {
    // Every role today can see all four kinds; prove the gate by narrowing the permissions map.
    const perms = await import("@/lib/auth/permissions");
    const original = perms.ROLE_PERMISSIONS.STAFF;
    const mutable = perms.ROLE_PERMISSIONS as unknown as { STAFF: string[] };
    mutable.STAFF = ["inventory.recordMovements"];
    try {
      const { client, calls } = fakeClient();
      const groups = await searchAdmin(client, "STAFF", "soap");
      expect(calls).toEqual(["inventory"]);
      expect(groups.map((g) => g.kind)).toEqual(["inventory"]);
    } finally {
      mutable.STAFF = [...original];
    }
  });

  it("does nothing for short queries and never writes to the activity log", async () => {
    const { client, calls, raw } = fakeClient();
    expect(await searchAdmin(client, "SUPERUSER", "a")).toEqual([]);
    expect(calls).toEqual([]);
    await searchAdmin(client, "SUPERUSER", "sita");
    expect(raw.activityLog.create).not.toHaveBeenCalled();
  });

  it("matches phone numbers by their last digits", async () => {
    const { client, raw } = fakeClient();
    await searchAdmin(client, "ADMIN", "5678");
    const where = (raw.reservation.findMany.mock.calls[0][0] as { where: { OR: unknown[] } }).where;
    expect(where.OR).toContainEqual({ guestPhone: { contains: "5678" } });
  });
});
