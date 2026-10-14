import { can, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/generated/prisma/enums";

export type AdminSection = {
  href: string;
  label: string;
  /** Required to see the nav item and open the page. Omitted = any signed-in user. */
  permission?: Permission;
  /** Build phase that delivers the page (docs/spec.md §4). */
  phase?: number;
};

/** Admin sections. Pages read their permission from here too. */
export const ADMIN_SECTIONS = {
  dashboard: { href: "/admin", label: "Today" },
  bookings: { href: "/admin/bookings", label: "Bookings", permission: "bookings.manage" },
  calendar: { href: "/admin/bookings/calendar", label: "Calendar", permission: "bookings.manage" },
  guests: { href: "/admin/guests", label: "Guests", permission: "bookings.manage" },
  enquiries: { href: "/admin/enquiries", label: "Enquiries", permission: "enquiries.manage" },
  housekeeping: { href: "/admin/housekeeping", label: "Housekeeping", permission: "housekeeping.work" },
  rooms: { href: "/admin/rooms", label: "Rooms", permission: "rooms.manage", phase: 2 },
  inventory: { href: "/admin/inventory", label: "Inventory", permission: "inventory.recordMovements" },
  content: { href: "/admin/content", label: "Content", permission: "content.manage", phase: 5 },
  media: { href: "/admin/media", label: "Media", permission: "media.manage", phase: 2 },
  users: { href: "/admin/users", label: "Users", permission: "users.manage" },
  activityLog: { href: "/admin/activity", label: "Activity log", permission: "activityLog.view" },
  profile: { href: "/admin/profile", label: "Your profile" },
} as const satisfies Record<string, AdminSection>;

export type AdminSectionKey = keyof typeof ADMIN_SECTIONS;

/** Navigation groups, in order. */
export const NAV_GROUPS: readonly { label: string; keys: readonly AdminSectionKey[] }[] = [
  { label: "Front desk", keys: ["dashboard", "bookings", "calendar", "housekeeping", "guests", "enquiries"] },
  { label: "Property", keys: ["rooms", "inventory"] },
  { label: "Website", keys: ["content", "media"] },
  { label: "Settings", keys: ["users", "activityLog", "profile"] },
];

/** The phone tab bar; everything else sits behind "More". */
export const TAB_KEYS: readonly AdminSectionKey[] = ["dashboard", "bookings", "calendar", "inventory"];

export type NavItem = { key: AdminSectionKey; href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

const allowed = (role: Role, section: AdminSection) => !section.permission || can(role, section.permission);

/** Groups with only the items this role can open; groups left empty are dropped. */
export function visibleNavGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.keys
      .filter((key) => allowed(role, ADMIN_SECTIONS[key]))
      .map((key) => ({ key, href: ADMIN_SECTIONS[key].href, label: ADMIN_SECTIONS[key].label })),
  })).filter((group) => group.items.length > 0);
}

/** The tab bar items this role can open, and the remaining items (by group) for the More sheet. */
export function phoneNav(role: Role): { tabs: NavItem[]; more: NavGroup[] } {
  const groups = visibleNavGroups(role);
  const items = groups.flatMap((g) => g.items);
  const tabs = TAB_KEYS.flatMap((key) => items.filter((item) => item.key === key));
  const inTabs = new Set(tabs.map((t) => t.key));
  const more = groups
    .map((g) => ({ label: g.label, items: g.items.filter((item) => !inTabs.has(item.key)) }))
    .filter((g) => g.items.length > 0);
  return { tabs, more };
}

/**
 * The nav item for the current page: the longest href that is the path or a parent of it, so
 * /admin/bookings/calendar highlights Calendar, not Bookings, and /admin only matches itself.
 */
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const match = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    if (match && (!best || href.length > best.length)) best = href;
  }
  return best;
}
