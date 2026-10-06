import type { Permission } from "@/lib/auth/permissions";

export type AdminSection = {
  href: string;
  label: string;
  /** Required to see the nav item and open the page. Omitted = any signed-in user. */
  permission?: Permission;
  /** Build phase that delivers the page (docs/spec.md §4). */
  phase?: number;
};

/** Admin sections in nav order. Pages read their permission from here too. */
export const ADMIN_SECTIONS = {
  dashboard: { href: "/admin", label: "Dashboard" },
  bookings: { href: "/admin/bookings", label: "Bookings", permission: "bookings.manage" },
  guests: { href: "/admin/guests", label: "Guests", permission: "bookings.manage" },
  enquiries: { href: "/admin/enquiries", label: "Enquiries", permission: "enquiries.manage" },
  rooms: { href: "/admin/rooms", label: "Rooms", permission: "rooms.manage", phase: 2 },
  media: { href: "/admin/media", label: "Media", permission: "media.manage", phase: 2 },
  content: { href: "/admin/content", label: "Content", permission: "content.manage", phase: 5 },
  inventory: { href: "/admin/inventory", label: "Inventory", permission: "inventory.recordMovements", phase: 4 },
  activityLog: { href: "/admin/activity", label: "Activity log", permission: "activityLog.view" },
  users: { href: "/admin/users", label: "Users", permission: "users.manage" },
  profile: { href: "/admin/profile", label: "Your profile" },
} as const satisfies Record<string, AdminSection>;

export type AdminSectionKey = keyof typeof ADMIN_SECTIONS;
