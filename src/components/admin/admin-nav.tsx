"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

export function AdminNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-forest ${
                  active ? "bg-forest text-cream" : "text-charcoal hover:bg-forest/5 hover:text-forest"
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
