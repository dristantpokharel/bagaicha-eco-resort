import Link from "next/link";
import { Check } from "lucide-react";
import { BOOKING } from "@/config/booking";
import { buttonClasses } from "@/components/ui/button";
import type { PublicRoomType } from "@/lib/content/queries";
import { formatNpr } from "@/lib/money";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";
import { SectionHeading } from "../typography";
import { ContentText } from "./content-text";

/**
 * One room type as an editorial row: photos on one side, text on the other.
 * `flip` swaps the sides so a list of rooms alternates image/text, text/image.
 */
export function RoomSection({ room, flip = false }: { room: PublicRoomType; flip?: boolean }) {
  const [main, ...details] = room.photos;
  const flagged = (f: string) => room.placeholderFields.includes(f);
  return (
    <section id={room.slug} aria-labelledby={`${room.slug}-heading`} className="py-8 md:py-14">
      <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-14">
        <Reveal className={`md:col-span-7 ${flip ? "md:order-2" : ""}`}>
          {main && <MediaPhoto media={main} sizes="(min-width: 768px) 58vw, 100vw" className="aspect-[4/3]" />}
          {details.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-3 md:mt-4 md:gap-4">
              {details.slice(0, 3).map((d) => (
                <li key={d.url}>
                  <MediaPhoto media={d} sizes="(min-width: 768px) 20vw, 33vw" className="aspect-square md:aspect-[4/3]" />
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        <Reveal className={`md:col-span-5 ${flip ? "md:order-1" : ""}`} delay={150}>
          <SectionHeading as="h2" id={`${room.slug}-heading`} strong={room.name} />
          <div className="mt-6 space-y-5">
            <ContentText text={room.description} flagged={flagged("description")} />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink/20 py-5">
              <div>
                <dt className="text-label text-ink-muted">Per night</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-ink-heading italic">{formatNpr(room.basePriceNpr)}</dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Sleeps</dt>
                <dd className="mt-1 text-ink">Up to {room.maxGuests}, children included</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-label text-ink-muted">Children under {BOOKING.childUnderAge}</dt>
                <dd className="mt-1 text-ink">
                  {room.childPricePerNightNpr > 0
                    ? `${formatNpr(room.childPricePerNightNpr)} per child per night, added to the room price`
                    : "Stay free"}
                </dd>
              </div>
            </dl>
            {room.amenities.length > 0 && (
              <div>
                <h3 className="text-label text-ink-muted">Amenities</h3>
                {flagged("amenities") ? (
                  <ul className="mt-3 space-y-2">
                    {room.amenities.map((a) => (
                      <li key={a}>
                        <ContentText text={a} flagged />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {room.amenities.map((a) => (
                      <li key={a} className="flex items-start gap-2 text-ink">
                        <Check aria-hidden="true" size={18} strokeWidth={1.75} className="mt-1 shrink-0 text-leaf" />
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Link href={`/book?room=${encodeURIComponent(room.slug)}`} className={buttonClasses({ variant: "brand", size: "lg" })}>
              Book this room
              <span className="sr-only">: {room.name}</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
