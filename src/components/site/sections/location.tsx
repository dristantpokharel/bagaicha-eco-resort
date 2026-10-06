import { MapPin, Phone } from "lucide-react";
import { HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import { MediaImage } from "@/components/media/media-image";
import type { Business, PublicMedia, PublicNearby } from "@/lib/content/queries";
import { formatWhatsapp, telHref, whatsappHref } from "@/lib/content/contact";
import { LeafSprig } from "../decor";
import { Icon, isIconName, WhatsAppIcon } from "../icons";
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
export function MapBlock({ business, map }: { business: Business; map?: PublicMedia }) {
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
        {business.googleMapsUrl && (
          <a href={business.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-ink-heading" })}>
            Open in Google Maps
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      {latitude != null && longitude != null && (
        <div className="w-full">
          <MapEmbed lat={latitude} lng={longitude} title={`Map showing ${business.name}`} />
        </div>
      )}
    </div>
  );
}

/** Home location band. */
export function LocationSection({ business, nearby, map }: { business: Business; nearby: PublicNearby[]; map?: PublicMedia }) {
  const [phone] = business.phones;
  return (
    <section aria-labelledby="location-heading" className="relative overflow-hidden bg-cream-dark py-section-sm md:py-section">
      <LeafSprig className="pointer-events-none absolute -top-4 -right-8 w-28 -scale-x-100 md:w-36" />
      <div className="container-page">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
          <h2
            id="location-heading"
            className="self-start rounded-full bg-sage px-7 py-3 whitespace-nowrap font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-ink-heading italic"
          >
            Our Location
          </h2>
          <address className="flex flex-col gap-4 not-italic sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10">
            {business.address && (
              <span className="flex items-start gap-3 font-label text-lg font-semibold text-ink-heading">
                <MapPin aria-hidden="true" strokeWidth={1.75} className="mt-0.5 shrink-0" />
                {business.address}
              </span>
            )}
            {phone && (
              <a href={telHref(phone)} className="flex items-center gap-3 font-label font-semibold text-ink-heading underline-offset-4 hover:underline">
                <Phone aria-hidden="true" strokeWidth={1.75} size={20} />
                {phone}
              </a>
            )}
            {business.whatsapp && (
              <a href={whatsappHref(business.whatsapp)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "brand", size: "lg", className: "self-start" })}>
                <WhatsAppIcon size={18} />
                Chat on WhatsApp
                <span className="sr-only"> {formatWhatsapp(business.whatsapp)} (opens in a new tab)</span>
              </a>
            )}
          </address>
        </div>

        <p className="text-body mt-6 max-w-3xl md:mt-10">{HOME.location.body}</p>

        <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-12 lg:gap-12">
          {nearby.length > 0 && (
            <div className="lg:col-span-5">
              <h3 className="sr-only">Nearby places</h3>
              <NearbyList nearby={nearby} />
            </div>
          )}
          <div className={nearby.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}>
            <MapBlock business={business} map={map} />
          </div>
        </div>
      </div>
    </section>
  );
}
