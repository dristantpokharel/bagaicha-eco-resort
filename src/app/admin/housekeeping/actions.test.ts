import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, dbTouched, AuthorizationError } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  dbTouched: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/auth/session", () => ({ AuthorizationError }));
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Any use of the database is a failure of the guard: it must be refused before data is read or changed.
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: () => dbTouched() }) }));

import { completeInspectionAction, completePrepAction, saveParAction, setRoomStatusAction, skipInspectionAction } from "./actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const cases = [
  ["completePrepAction", completePrepAction, "housekeeping.work", { roomId: "r", cycle: "1" }],
  ["completeInspectionAction", completeInspectionAction, "housekeeping.work", { roomId: "r", cycle: "1" }],
  ["setRoomStatusAction", setRoomStatusAction, "housekeeping.work", { roomId: "r", status: "DIRTY" }],
  ["skipInspectionAction", skipInspectionAction, "housekeeping.skipInspection", { roomId: "r", cycle: "1", reason: "no time" }],
  ["saveParAction", saveParAction, "inventory.managePar", { roomTypeId: "t" }],
] as const;

describe("housekeeping actions are authorized before they do anything", () => {
  beforeEach(() => {
    requirePermission.mockReset();
    dbTouched.mockReset();
  });

  it.each(cases)("%s asks for %s and stops when it is refused", async (_name, action, permission, fields) => {
    requirePermission.mockRejectedValue(new AuthorizationError("You don't have access."));
    const result = await action(null, form(fields));
    expect(requirePermission).toHaveBeenCalledWith(permission);
    expect(result).toMatchObject({ ok: false, error: "You don't have access." });
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it.each(cases)("%s refuses a signed-out visitor", async (_name, action, _permission, fields) => {
    requirePermission.mockRejectedValue(new AuthorizationError("Sign in to continue."));
    expect(await action(null, form(fields))).toMatchObject({ ok: false });
    expect(dbTouched).not.toHaveBeenCalled();
  });
});
