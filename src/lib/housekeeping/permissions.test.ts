import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/permissions";
import { ADMIN_SECTIONS, visibleNavGroups } from "@/lib/admin-nav";

describe("housekeeping permissions", () => {
  it("staff do checklists, room status and extras; par lists and the owner overview are Admin and up", () => {
    expect(can("STAFF", "housekeeping.work")).toBe(true);
    expect(can("STAFF", "inventory.managePar")).toBe(false);
    expect(can("STAFF", "inventory.overview")).toBe(false);
    for (const role of ["ADMIN", "SUPERUSER"] as const) {
      expect(can(role, "housekeeping.work")).toBe(true);
      expect(can(role, "inventory.managePar")).toBe(true);
      expect(can(role, "inventory.overview")).toBe(true);
    }
  });

  it("only Admin and up can skip an inspection", () => {
    expect(can("STAFF", "housekeeping.skipInspection")).toBe(false);
    expect(can("ADMIN", "housekeeping.skipInspection")).toBe(true);
    expect(can("SUPERUSER", "housekeeping.skipInspection")).toBe(true);
  });

  it("puts Housekeeping in the Front desk group for everyone who can work on it", () => {
    expect(ADMIN_SECTIONS.housekeeping.permission).toBe("housekeeping.work");
    for (const role of ["STAFF", "ADMIN", "SUPERUSER"] as const) {
      const front = visibleNavGroups(role).find((g) => g.label === "Front desk");
      expect(front?.items.map((i) => i.label)).toContain("Housekeeping");
    }
  });
});
