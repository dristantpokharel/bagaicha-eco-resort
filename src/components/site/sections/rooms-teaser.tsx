import Link from "next/link";
import { HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicRoomType } from "@/lib/content/queries";
import { formatNpr } from "@/lib/money";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";
import { SectionHeading } from "../typography";

/** Home rooms: one card per active room type (photo, name, short line, price, Book this room). */
export function RoomsBand({ rooms }: { rooms: PublicRoomType[] }) {
  if (rooms.length === 0) return null;
  const copy = HOME.rooms;
  return (
    <section aria-labelledby="stay-heading" className="bg-cream-dark py-section-sm md:py-section">
      <div className="container-page">
        <Reveal>
          <SectionHeading id="stay-heading" lead={copy.lead} accent={copy.accent} soft={copy.soft} />
        </Reveal>
        <ul className={`mt-8 grid gap-8 md:mt-12 md:gap-10 sm:grid-cols-2 ${rooms.length > 2 ? "lg:grid-cols-3" : ""}`}>
          {rooms.map((room, i) => (
            <li key={room.id}>
              <Reveal delay={i * 120} className="flex h-full flex-col">
                {room.photos[0] && <MediaPhoto media={room.photos[0]} sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw" className="aspect-[4/3]" />}
                <h3 className="mt-5 font-display text-2xl font-bold text-ink-heading italic">{room.name}</h3>
                {room.description && <p className="mt-2 line-clamp-2 text-ink">{room.description}</p>}
                <p className="mt-3 font-label text-sm font-semibold tracking-wide text-ink-heading">from {formatNpr(room.basePriceNpr)} / night</p>
                <Link
                  href={`/book?room=${encodeURIComponent(room.slug)}`}
                  className={buttonClasses({ variant: "brand", size: "lg", className: "mt-5 self-start" })}
                >
                  Book this room
                  <span className="sr-only">: {room.name}</span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
