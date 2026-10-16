import Link from "next/link";
import { MapPin } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { MediaImage } from "@/components/media/media-image";
import type { Business, PublicMedia, PublicNearby } from "@/lib/content/queries";
import { LeafSprig } from "../decor";
import { Icon, isIconName } from "../icons";
import { MapEmbed } from "../map-embed";

export function NearbyList({ nearby }: { nearby: PublicNearby[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {nearby.map((n) => (
        <li key={n.id} className="flex items-center gap-4 bg-sage px-4 py-4 md:gap-5 md:px-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-forest-dark text-cream md:size-14">
            <Icon name={isIconName(n.icon) ? n.icon : "leaf"} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-label text-sm font-medium tracking-wider text-ink-heading uppercase">{n.name}</p>
            {(n.distance || n.travelTime) && (
              <p className="mt-1 text-sm text-ink">{[n.distance, n.travelTime].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Illustrated map, Get Directions and the click-to-load Google map. */
export function MapBlock({ business, map, embed = true }: { business: Business; map?: PublicMedia; embed?: boolean }) {
  const { latitude, longitude } = business;
  return (
    <div className="flex flex-col items-start gap-6">
      {map && (
        <div className="relative w-full" style={{ aspectRatio: `${map.width} / ${map.height}` }}>
          <MediaImage media={map} sizes="(min-width: 1024px) 55vw, 100vw" className="object-contain" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {business.directionsUrl && (
          <a href={business.directionsUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "brand", size: "lg" })}>
            Get Directions
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        {embed && business.googleMapsUrl && (
          <a href={business.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-ink-heading" })}>
            Open in Google Maps
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      {embed && latitude != null && longitude != null && (
        <div className="w-full">
          <MapEmbed lat={latitude} lng={longitude} title={`Map showing ${business.name}`} />
        </div>
      )}
    </div>
  );
}

/** Home location band: illustrated map, address, the Nepalgunj distance, directions and a link to /location. */
export function LocationSection({ business, nearby, map }: { business: Business; nearby: PublicNearby[]; map?: PublicMedia }) {
  const airport = nearby.find((n) => /nepalgunj/i.test(n.name));
  const distance = airport && [airport.distance, airport.travelTime].filter(Boolean).join(" · ");
  return (
    <section aria-labelledby="location-heading" className="relative overflow-hidden bg-cream-dark py-section-sm md:py-section">
      <LeafSprig className="pointer-events-none absolute -top-4 -right-8 w-28 -scale-x-100 md:w-36" />
      <div className="container-page grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col items-start gap-5 lg:col-span-5">
          <h2
            id="location-heading"
            className="rounded-full bg-sage px-7 py-3 whitespace-nowrap font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-ink-heading italic"
          >
            Our Location
          </h2>
          <address className="flex flex-col gap-3 not-italic">
            {business.address && (
              <span className="flex items-start gap-3 font-label text-lg font-semibold text-ink-heading">
                <MapPin aria-hidden="true" strokeWidth={1.75} className="mt-0.5 shrink-0" />
                {business.address}
              </span>
            )}
            {airport && distance && (
              <span className="flex items-start gap-3 text-ink">
                <Icon name="plane" size={22} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold text-ink-heading">{airport.name}</span>: {distance}
                </span>
              </span>
            )}
          </address>
          <div className="flex flex-wrap items-center gap-3">
            {business.directionsUrl && (
              <a href={business.directionsUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "brand", size: "lg" })}>
                Get directions
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            <Link href="/location" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-ink-heading" })}>
              More about getting here
            </Link>
          </div>
        </div>
        {map && (
          <div className="lg:col-span-7">
            <div className="relative w-full" style={{ aspectRatio: `${map.width} / ${map.height}` }}>
              <MediaImage media={map} sizes="(min-width: 1024px) 55vw, 100vw" className="object-contain" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
