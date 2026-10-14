import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, loadOverview, AuthorizationError } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  loadOverview: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {
    constructor(readonly reason: "unauthenticated" | "forbidden") {
      super(reason);
    }
  },
}));

vi.mock("@/lib/auth/session", () => ({ AuthorizationError }));
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("@/lib/inventory/overview", () => ({ loadOverview }));

import { GET } from "./route";

const call = (table = "to-buy") => GET(new Request(`http://localhost/admin/inventory/overview/export?table=${table}`));

describe("overview CSV export", () => {
  beforeEach(() => {
    requirePermission.mockReset();
    loadOverview.mockReset();
  });

  it("asks for inventory.overview and reads nothing when refused (Staff get 403, signed-out visitors 401)", async () => {
    requirePermission.mockRejectedValueOnce(new AuthorizationError("forbidden"));
    expect((await call()).status).toBe(403);
    requirePermission.mockRejectedValueOnce(new AuthorizationError("unauthenticated"));
    expect((await call()).status).toBe(401);
    expect(requirePermission).toHaveBeenCalledWith("inventory.overview");
    expect(loadOverview).not.toHaveBeenCalled();
  });

  it("rejects an unknown table", async () => {
    requirePermission.mockResolvedValue({ id: "u" });
    expect((await call("users")).status).toBe(400);
    expect(loadOverview).not.toHaveBeenCalled();
  });

  it("downloads a CSV for a known table", async () => {
    requirePermission.mockResolvedValue({ id: "u" });
    loadOverview.mockResolvedValue({ toBuy: [{ name: "=Soap", category: "Bath", unit: "pcs", have: "1", alertAt: "5", arrivalsShort: "0", buy: "4" }] });
    const response = await call();
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="inventory-to-buy-\d{4}-\d{2}-\d{2}\.csv"/);
    const text = await response.text();
    expect(text).toContain("Item,Category,Unit");
    expect(text).toContain("'=Soap");
  });
});
