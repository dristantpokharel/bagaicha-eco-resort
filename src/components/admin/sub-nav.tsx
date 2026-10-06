"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLink } from "./admin-nav";

/** Tabs for pages inside one admin section (exact path match). */
export function SubNav({ label, links }: { label: string; links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-6 border-b border-forest/10">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-forest ${
                  active
                    ? "border-forest font-medium text-forest"
                    : "border-transparent text-charcoal-light hover:border-forest/30 hover:text-forest"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
