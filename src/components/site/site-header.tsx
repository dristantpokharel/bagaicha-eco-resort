"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";

type NavItem = { label: string; href: string };

/**
 * Over the hero on the homepage it starts transparent and turns cream once scrolled.
 * Every other page starts on cream. On phones the links move into a panel behind a menu button.
 */
export function SiteHeader({ name, nav, bookingHref }: { name: string; nav: readonly NavItem[]; bookingHref: string }) {
  const pathname = usePathname();
  const overHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [openAt, setOpenAt] = useState<string | null>(null);
  // The menu closes by itself when the route changes.
  const open = openAt === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open || !overHero;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header
      className={`inset-x-0 top-0 z-40 transition-colors duration-500 ease-calm ${overHero ? "fixed" : "sticky"} ${
        solid ? "bg-cream text-ink shadow-[0_1px_0_rgba(40,51,39,0.12)]" : "bg-transparent text-cream"
      }`}
    >
      <div className="container-page flex h-18 items-center justify-between gap-6 md:h-20">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
        >
          <span className="block size-12 shrink-0 rounded-full bg-cream p-0.5 md:size-14">
            <Image src="/logo-mark.png" alt="" width={56} height={56} className="size-full" />
          </span>
          <span className="font-display text-lg leading-tight font-semibold italic">{name}</span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="text-label underline-offset-8 hover:underline aria-[current=page]:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={bookingHref}
            className={buttonClasses({ variant: solid ? "brand" : "brand-light", size: "lg", className: "max-sm:hidden" })}
          >
            Book Your Stay
          </Link>
          <button
            type="button"
            className="inline-flex size-12 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-current lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpenAt(open ? null : pathname)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <div id="mobile-menu" hidden={!open} className="max-h-[calc(100svh-4.5rem)] overflow-y-auto border-t border-ink/10 bg-cream lg:hidden">
        <nav aria-label="Main mobile" className="container-page py-6">
          <ul className="flex flex-col">
            {nav.map((item) => (
              <li key={item.href} className="border-b border-ink/10">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="block py-4 font-display text-2xl text-ink-heading italic aria-[current=page]:font-bold"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={bookingHref} className={buttonClasses({ variant: "brand", size: "lg", className: "mt-6 w-full" })}>
            Book Your Stay
          </Link>
        </nav>
      </div>
    </header>
  );
}
