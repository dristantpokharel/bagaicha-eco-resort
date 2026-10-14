import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, dbTouched, AuthorizationError } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  dbTouched: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/auth/session", () => ({ AuthorizationError }));
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: () => dbTouched() }) }));

import { addExtraAction, removeExtraAction } from "./extras-actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const cases = [
  ["addExtraAction", addExtraAction, { bookingId: "b", itemId: "i", quantity: "1" }],
  ["removeExtraAction", removeExtraAction, { extraId: "e" }],
] as const;

describe("extras actions are authorized before they do anything", () => {
  beforeEach(() => {
    requirePermission.mockReset();
    dbTouched.mockReset();
  });

  it.each(cases)("%s needs housekeeping.work and stops when refused", async (_name, action, fields) => {
    requirePermission.mockRejectedValue(new AuthorizationError("You don't have access."));
    expect(await action(null, form(fields))).toMatchObject({ ok: false, error: "You don't have access." });
    expect(requirePermission).toHaveBeenCalledWith("housekeeping.work");
    expect(dbTouched).not.toHaveBeenCalled();
  });
});
