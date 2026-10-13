"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, Ellipsis, ClipboardList, Package, type LucideIcon } from "lucide-react";
import { activeHref, type AdminSectionKey, type NavGroup, type NavItem } from "@/lib/admin-nav";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const TAB_ICONS: Partial<Record<AdminSectionKey, LucideIcon>> = {
  dashboard: CalendarCheck,
  bookings: ClipboardList,
  calendar: CalendarDays,
  inventory: Package,
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest";

/** Desktop sidebar: every group the role can reach, with its label. Hidden on phones (the tab bar replaces it). */
export function AdminSidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const active = activeHref(pathname, groups.flatMap((g) => g.items.map((i) => i.href)));

  return (
    <aside className="hidden w-56 shrink-0 border-r border-forest/10 bg-white p-3 md:block">
      <nav aria-label="Admin" className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="px-3 pb-1 text-xs font-semibold tracking-wide text-charcoal-light uppercase">{group.label}</h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.href === active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${focus} ${
                      item.href === active ? "bg-forest text-cream" : "text-charcoal hover:bg-forest/5 hover:text-forest"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/**
 * Phone navigation (below 768px): the main tabs plus "More", which opens a sheet with everything else by group.
 * Fixed to the bottom, clear of the home indicator, with 44px+ targets.
 */
export function PhoneTabBar({
  tabs,
  more,
  userName,
  roleLabel,
  signOut,
}: {
  tabs: NavItem[];
  more: NavGroup[];
  userName: string;
  roleLabel: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  // The sheet is open for the page it was opened on, so navigating closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const moreOpen = openAt === pathname;
  const active = activeHref(pathname, [...tabs, ...more.flatMap((g) => g.items)].map((i) => i.href));
  const moreActive = more.some((g) => g.items.some((i) => i.href === active));

  const tab = "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium";
  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-forest/15 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {tabs.map((item) => {
            const Icon = TAB_ICONS[item.key] ?? ClipboardList;
            const isActive = item.href === active;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${tab} ${focus} ${isActive ? "text-forest" : "text-charcoal-light"}`}
                >
                  <Icon aria-hidden="true" className="size-6" strokeWidth={isActive ? 2.5 : 1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setOpenAt(pathname)}
              aria-haspopup="dialog"
              className={`${tab} w-full ${focus} ${moreActive ? "text-forest" : "text-charcoal-light"}`}
            >
              <Ellipsis aria-hidden="true" className="size-6" strokeWidth={moreActive ? 2.5 : 1.75} />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setOpenAt(null)} label="More" placement="bottom">
        <div className="overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg text-forest">More</h2>
            <button type="button" onClick={() => setOpenAt(null)} className={`min-h-11 rounded-md px-3 text-sm text-forest ${focus}`}>
              Close
            </button>
          </div>
          <nav aria-label="More" className="space-y-4">
            {more.map((group) => (
              <div key={group.label}>
                <h3 className="pb-1 text-xs font-semibold tracking-wide text-charcoal-light uppercase">{group.label}</h3>
                <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={item.href === active ? "page" : undefined}
                        className={`flex min-h-12 items-center px-4 text-base ${focus} ${item.href === active ? "font-medium text-forest" : "text-charcoal"}`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <form action={signOut} className="mt-5 flex items-center justify-between gap-3 border-t border-forest/10 pt-4">
            <p className="min-w-0 text-sm leading-tight">
              <span className="block truncate font-medium text-charcoal">{userName}</span>
              <span className="block text-xs text-charcoal-light">{roleLabel}</span>
            </p>
            <Button type="submit" variant="secondary" className="min-h-11">
              Sign out
            </Button>
          </form>
        </div>
      </Sheet>
    </>
  );
}
