import Link from "next/link";
import { BOOKING_HREF, HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicRoomType } from "@/lib/content/queries";
import { formatNpr } from "@/lib/money";
import { Icon } from "../icons";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";
import { Kicker, SectionHeading } from "../typography";

/** Home rooms band: lead photo, detail row and one line per room type, all from RoomType + RoomTypeMedia. */
export function RoomsTeaser({ rooms }: { rooms: PublicRoomType[] }) {
  const photos = rooms.flatMap((r) => r.photos.slice(0, 2));
  const [main, ...details] = photos;
  const copy = HOME.rooms;
  return (
    <section aria-labelledby="stay-heading" className="bg-cream-dark py-section-sm md:py-section">
      <div className="container-page">
        <div className="grid gap-12 md:grid-cols-12 md:gap-10">
          <Reveal className="flex flex-col gap-10 md:col-span-4">
            <Kicker words={copy.kicker} />
            <SectionHeading id="stay-heading" lead={copy.lead} accent={copy.accent} soft={copy.soft} />
            <p className="text-body">{copy.line}</p>
            {rooms.length > 0 && (
              <ul className="border-t border-ink/20">
                {rooms.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-4 border-b border-ink/20 py-3">
                    <Link href={`/stay#${r.slug}`} className="font-display text-xl font-bold text-ink-heading italic underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-sm text-ink">From {formatNpr(r.basePriceNpr)} / night</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Link href="/stay" className={buttonClasses({ variant: "brand", size: "lg" })}>
                See the rooms
              </Link>
              <Link href={BOOKING_HREF} className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-ink-heading" })}>
                Book Your Stay
              </Link>
            </div>
          </Reveal>
          <Reveal className="md:col-span-8" delay={150}>
            {main && (
              <div className="relative">
                <MediaPhoto media={main} sizes="(min-width: 768px) 60vw, 100vw" className="aspect-[4/3]" />
                <div className="relative -mt-12 ml-auto max-w-[17rem] rounded-tl-organic bg-forest px-7 pt-8 pb-6 text-right text-cream md:absolute md:right-0 md:bottom-0 md:mt-0 md:max-w-xs">
                  <Icon name="bed" size={36} className="ml-auto" />
                  <p className="mt-3 font-label text-xl tracking-[0.2em] uppercase">{copy.overlay.title}</p>
                  <p className="mt-2 text-sm leading-relaxed md:text-base">{copy.overlay.body}</p>
                </div>
              </div>
            )}
          </Reveal>
        </div>
        {details.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-3 md:mt-4 md:gap-4">
            {details.slice(0, 3).map((d, i) => (
              <li key={d.url}>
                <Reveal delay={i * 120}>
                  <MediaPhoto media={d} sizes="33vw" className="aspect-square md:aspect-[4/3]" />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
