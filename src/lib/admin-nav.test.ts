import { describe, expect, it } from "vitest";
import { activeHref, phoneNav, visibleNavGroups } from "./admin-nav";

const labels = (role: Parameters<typeof visibleNavGroups>[0]) => visibleNavGroups(role).flatMap((g) => g.items.map((i) => i.label));

describe("visibleNavGroups", () => {
  it("shows a superuser everything, in group order", () => {
    expect(visibleNavGroups("SUPERUSER").map((g) => g.label)).toEqual(["Front desk", "Property", "Website", "Settings"]);
    expect(labels("SUPERUSER")).toEqual([
      "Today", "Bookings", "Calendar", "Guests", "Enquiries", "Rooms", "Inventory", "Content", "Media", "Users", "Activity log", "Your profile",
    ]);
  });

  it("hides what an admin can't open (no Users)", () => {
    expect(labels("ADMIN")).not.toContain("Users");
    expect(labels("ADMIN")).toContain("Activity log");
  });

  it("gives staff front desk, inventory and their profile only; drops empty groups", () => {
    expect(labels("STAFF")).toEqual(["Today", "Bookings", "Calendar", "Guests", "Enquiries", "Inventory", "Your profile"]);
    expect(visibleNavGroups("STAFF").map((g) => g.label)).toEqual(["Front desk", "Property", "Settings"]);
  });
});

describe("phoneNav", () => {
  it("puts four tabs in the bar and the rest in More, grouped, with no repeats", () => {
    const { tabs, more } = phoneNav("ADMIN");
    expect(tabs.map((t) => t.label)).toEqual(["Today", "Bookings", "Calendar", "Inventory"]);
    const moreLabels = more.flatMap((g) => g.items.map((i) => i.label));
    expect(moreLabels).toEqual(["Guests", "Enquiries", "Rooms", "Content", "Media", "Activity log", "Your profile"]);
  });

  it("keeps the profile reachable for staff", () => {
    expect(phoneNav("STAFF").more.flatMap((g) => g.items.map((i) => i.label))).toEqual(["Guests", "Enquiries", "Your profile"]);
  });
});

describe("activeHref", () => {
  const hrefs = ["/admin", "/admin/bookings", "/admin/bookings/calendar", "/admin/inventory"];
  it("matches /admin only exactly", () => {
    expect(activeHref("/admin", hrefs)).toBe("/admin");
    expect(activeHref("/admin/guests", hrefs)).toBeNull();
  });
  it("prefers the most specific item", () => {
    expect(activeHref("/admin/bookings/calendar", hrefs)).toBe("/admin/bookings/calendar");
    expect(activeHref("/admin/bookings/abc123", hrefs)).toBe("/admin/bookings");
    expect(activeHref("/admin/inventory/record", hrefs)).toBe("/admin/inventory");
  });
  it("doesn't match on a shared prefix", () => {
    expect(activeHref("/admin/bookingsx", hrefs)).toBeNull();
  });
});
