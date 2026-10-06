import type { Role } from "@/generated/prisma/enums";

/**
 * Single source of truth for who can do what (docs/spec.md §2).
 * The UI hides what a role can't do; the server enforces it via
 * requirePermission / requirePagePermission.
 */
export const ROLE_PERMISSIONS = {
  SUPERUSER: [
    "users.manage",
    "content.manage",
    "rooms.manage",
    "media.manage",
    "bookings.manage",
    "bookings.changeStatus",
    "bookings.cancel",
    "rooms.blockDates",
    "inventory.manageItems",
    "inventory.recordMovements",
    "enquiries.manage",
    "activityLog.view",
  ],
  ADMIN: [
    "content.manage",
    "rooms.manage",
    "media.manage",
    "bookings.manage",
    "bookings.changeStatus",
    "bookings.cancel",
    "rooms.blockDates",
    "inventory.manageItems",
    "inventory.recordMovements",
    "enquiries.manage",
    "activityLog.view",
  ],
  STAFF: [
    "bookings.manage",
    "bookings.changeStatus",
    "inventory.recordMovements",
    "enquiries.manage",
  ],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof ROLE_PERMISSIONS)["SUPERUSER"][number];

export function can(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPERUSER: "Superuser",
  ADMIN: "Admin",
  STAFF: "Staff",
};
