import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { buttonClasses } from "@/components/ui/button";
import { MediaPhoto } from "@/components/site/photo";
import { RESORT_TIMEZONE } from "@/lib/dates";
import { BOOKING_HREF } from "@/config/site-copy";
import type { PublicGuide } from "@/lib/guides/queries";

export const formatGuideDate = (date: Date) => formatInTimeZone(date, RESORT_TIMEZONE, "d MMMM yyyy");

/** Links to the pages a reader is most likely to want next, plus the booking and enquiry actions. */
export function GuideCtas({ tone = "band" }: { tone?: "band" | "inline" }) {
  if (tone === "inline") {
    return (
      <p className="text-body border-y border-ink/15 py-3 text-ink">
        Planning a visit?{" "}
        <Link href="/explore" className="text-forest underline underline-offset-4">Explore what to do</Link>,{" "}
        <Link href="/stay" className="text-forest underline underline-offset-4">see the rooms</Link> or{" "}
        <Link href="/location" className="text-forest underline underline-offset-4">find us on the map</Link>.
      </p>
    );
  }
  return (
    <aside aria-labelledby="guide-cta-heading" className="bg-forest-dark px-6 py-10 text-cream md:px-10">
      <h2 id="guide-cta-heading" className="text-heading-strong">Plan your stay</h2>
      <p className="text-body mt-3 max-w-xl">Stay with us in Bardiya, see what there is to do, or ask us about a custom stay or event.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={BOOKING_HREF} className={buttonClasses({ variant: "brand-light", size: "lg" })}>Book your stay</Link>
        <Link href="/explore" className={buttonClasses({ variant: "brand-outline", size: "lg" })}>Explore</Link>
        <Link href="/enquiry" className={buttonClasses({ variant: "brand-outline", size: "lg" })}>Send an enquiry</Link>
      </div>
    </aside>
  );
}

export function GuideCard({ guide }: { guide: Pick<PublicGuide, "slug" | "title" | "excerpt" | "cover" | "publishedAt" | "readingMinutes" | "tags"> }) {
  return (
    <article className="group flex flex-col">
      <Link href={`/guides/${guide.slug}`} className="block focus-visible:outline-2 focus-visible:outline-forest">
        {guide.cover ? (
          <MediaPhoto media={guide.cover} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="aspect-[3/2]" imgClassName="transition-transform duration-700 group-hover:scale-[1.02]" />
        ) : (
          <div className="aspect-[3/2] bg-sage" aria-hidden="true" />
        )}
        <p className="mt-4 font-label text-xs tracking-widest text-ink-muted uppercase">
          {formatGuideDate(guide.publishedAt)} · {guide.readingMinutes} min read
        </p>
        <h2 className="text-title mt-2 text-ink-heading">{guide.title}</h2>
        {guide.excerpt && <p className="mt-2 text-ink">{guide.excerpt}</p>}
      </Link>
    </article>
  );
}
