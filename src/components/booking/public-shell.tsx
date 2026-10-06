import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/config/site";

/**
 * Minimal public frame for the booking and enquiry pages. The full public
 * header/footer arrive with the Phase 5 redesign.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-forest/15 bg-cream">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
            <Image src="/logo-mark.png" alt="" width={40} height={40} className="size-10" />
            <span className="font-display text-lg font-semibold italic text-forest">{SITE.name}</span>
          </Link>
          <nav aria-label="Booking" className="flex gap-5 text-sm text-forest">
            <Link href="/book" className="underline-offset-4 hover:underline">Book</Link>
            <Link href="/enquiry" className="underline-offset-4 hover:underline">Enquiry</Link>
          </nav>
        </div>
      </header>
      <main className="container-page w-full flex-1 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-forest/15 py-6">
        <p className="container-page text-sm text-ink-muted">
          {SITE.name}, {SITE.address}
        </p>
      </footer>
    </>
  );
}
