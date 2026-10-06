import { describe, expect, it } from "vitest";
import { actionLabel, detailLines, entityHref, entityLabel, HIDDEN, looksLikeContact } from "./present";

const find = (lines: { label: string; value: string }[], label: string) => lines.find((l) => l.label === label)?.value;

describe("looksLikeContact", () => {
  it("catches emails and phone numbers", () => {
    expect(looksLikeContact("sita@example.com")).toBe(true);
    expect(looksLikeContact("call 9812345678 after 5")).toBe(true);
    expect(looksLikeContact("+977 981-234-5678")).toBe(true);
    expect(looksLikeContact("+9779812345678")).toBe(true);
  });
  it("leaves dates, booking numbers, prices and plain words alone", () => {
    expect(looksLikeContact("2026-10-06")).toBe(false);
    expect(looksLikeContact("BG-2026-000123")).toBe(false);
    expect(looksLikeContact("Opening stock")).toBe(false);
    expect(looksLikeContact("Guest asked for a late checkout")).toBe(false);
    expect(looksLikeContact("12.5")).toBe(false);
  });
});

describe("detailLines", () => {
  it("never shows contact keys or free-text guest notes", () => {
    const lines = detailLines({
      email: "guest@example.com",
      guestPhone: "9812345678",
      changes: {
        specialRequests: { from: "call me on 9812345678", to: "none" },
        internalNotes: { from: "a", to: "b" },
        adults: { from: 2, to: 3 },
      },
    });
    const all = JSON.stringify(lines);
    expect(all).not.toContain("guest@example.com");
    expect(all).not.toContain("9812345678");
    expect(find(lines, "Email")).toBe(HIDDEN);
    expect(find(lines, "Guest phone")).toBe(HIDDEN);
    expect(find(lines, "Changes · Special requests")).toBe(HIDDEN);
    expect(find(lines, "Changes · Internal notes")).toBe(HIDDEN);
    expect(find(lines, "Changes · Adults")).toBe("2 → 3");
  });

  it("hides contact-looking values under harmless keys", () => {
    const lines = detailLines({ reason: "guest said ring 9812345678", note: "Opening stock" });
    expect(find(lines, "Reason")).toBe(HIDDEN);
    expect(find(lines, "Note")).toBe("Opening stock");
  });

  it("formats common shapes", () => {
    const lines = detailLines({
      bookingNumber: "BG-2026-000123",
      checkIn: "2026-10-06",
      totalPriceNpr: 9000,
      from: "PENDING",
      to: "CONFIRMED",
      fields: ["name", "country"],
      change: "-2.5",
      missing: null,
    });
    expect(find(lines, "Booking number")).toBe("BG-2026-000123");
    expect(find(lines, "Check in")).toBe("2026-10-06");
    expect(find(lines, "Total price npr")).toBe("9000");
    expect(find(lines, "Fields")).toBe("name, country");
    expect(find(lines, "Missing")).toBe("none");
  });

  it("copes with non-object details", () => {
    expect(detailLines(null)).toEqual([]);
    expect(detailLines("text")).toEqual([]);
    expect(detailLines([1, 2])).toEqual([]);
  });
});

describe("actionLabel", () => {
  it("humanizes dotted and camelCase actions", () => {
    expect(actionLabel("inventoryItem.created")).toBe("Inventory item created");
    expect(actionLabel("stock.used")).toBe("Stock used");
    expect(actionLabel("user.name_changed")).toBe("User name changed");
    expect(actionLabel("enquiry.statusChanged")).toBe("Enquiry status changed");
  });
});

describe("entityHref", () => {
  const link = (entityType: string, entityId: string | null, action = "x.updated", canManageUsers = true) =>
    entityHref({ entityType, entityId, action, canManageUsers });
  it("links to the related page", () => {
    expect(link("Booking", "b1")).toBe("/admin/bookings/b1");
    expect(link("InventoryItem", "i1")).toBe("/admin/inventory/i1");
    expect(link("Guest", "g1")).toBe("/admin/guests/g1");
    expect(link("RoomType", "r1")).toBe("/admin/rooms/r1");
    expect(link("User", "u1")).toBe("/admin/users");
  });
  it("only links to users for those who can manage them", () => {
    expect(link("User", "u1", "user.created", false)).toBeNull();
  });
  it("has no link for removed things, missing ids or unknown types", () => {
    expect(link("Media", "m1", "media.deleted")).toBeNull();
    expect(link("RoomBlock", "x", "roomBlock.removed")).toBeNull();
    expect(link("Booking", null)).toBeNull();
    expect(link("Mystery", "1")).toBeNull();
  });
});

describe("entityLabel", () => {
  it("prefers the booking number, then item, room and name", () => {
    expect(entityLabel("Booking", { bookingNumber: "BG-2026-000001" })).toBe("BG-2026-000001");
    expect(entityLabel("InventoryItem", { item: "Rice" })).toBe("Rice");
    expect(entityLabel("RoomBlock", { room: "Garden 1" })).toBe("Garden 1");
    expect(entityLabel("RoomType", { name: "Cottage" })).toBe("Cottage");
    expect(entityLabel("InventoryItem", { name: { from: "a", to: "b" } })).toBe("Inventory item");
    expect(entityLabel("User", null)).toBe("User");
  });
});
