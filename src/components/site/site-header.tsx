"use client";

import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";

type NavItem = { label: string; href: string };

/**
 * Transparent over the hero, solid cream once scrolled. On phones the links
 * move into a full-width panel behind a menu button.
 */
export function SiteHeader({ name, nav, bookingHref }: { name: string; nav: readonly NavItem[]; bookingHref: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-500 ease-calm ${
        solid ? "bg-cream text-ink shadow-[0_1px_0_rgba(40,51,39,0.12)]" : "bg-transparent text-cream"
      }`}
    >
      <div className="container-page flex h-18 items-center justify-between gap-6 md:h-20">
        <a
          href="#top"
          className="flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
        >
          <span className="block size-12 shrink-0 rounded-full bg-cream p-0.5 md:size-14">
            <Image src="/logo-mark.png" alt="" width={56} height={56} className="size-full" />
          </span>
          <span className="font-display text-lg leading-tight font-semibold italic">{name}</span>
        </a>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {nav.map((item) => (
              <li key={item.href + item.label}>
                <a
                  href={item.href}
                  className="text-label underline-offset-8 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={bookingHref}
            className={buttonClasses({
              variant: solid ? "brand" : "brand-light",
              size: "lg",
              className: "max-sm:hidden",
            })}
          >
            Book Your Stay
          </a>
          <button
            type="button"
            className="inline-flex size-12 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-current lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <div id="mobile-menu" hidden={!open} className="border-t border-ink/10 bg-cream lg:hidden">
        <nav aria-label="Main mobile" className="container-page py-6">
          <ul className="flex flex-col">
            {nav.map((item) => (
              <li key={item.href + item.label} className="border-b border-ink/10">
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-4 font-display text-2xl text-ink-heading italic"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={bookingHref}
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "brand", size: "lg", className: "mt-6 w-full" })}
          >
            Book Your Stay
          </a>
        </nav>
      </div>
    </header>
  );
}
