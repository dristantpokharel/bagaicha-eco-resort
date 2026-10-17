import { deliveryUrl } from "@/lib/cloudinary/delivery";
import type { Business, PublicMedia, PublicRoomType } from "@/lib/content/queries";
import type { PublicGuide } from "@/lib/guides/queries";
import { SITE } from "@/config/site";

/** Builders for schema.org JSON-LD. Pure functions: every value comes from the database or SITE. */

const abs = (path: string) => new URL(path, SITE.url).toString();

/** Serialise for a <script type="application/ld+json">; `<` is escaped so no field can close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** "2:00 PM" → "14:00". Anything else returns null (the property is then left out). */
export function toIsoTime(text: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*$/i.exec(text ?? "");
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const meridiem = m[3]?.toLowerCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  } else if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: abs(item.path) })),
  };
}

export function blogPostingJsonLd(guide: PublicGuide, publisher: { name: string; logo?: string }) {
  const url = abs(`/guides/${guide.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: guide.title,
    description: guide.seoDescription ?? guide.excerpt,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: guide.publishedAt.toISOString(),
    dateModified: guide.updatedAt.toISOString(),
    image: guide.cover ? [deliveryUrl(guide.cover.url, 1200)] : undefined,
    keywords: guide.tags.length ? guide.tags.join(", ") : undefined,
    author: { "@type": "Person", name: guide.authorName, jobTitle: guide.authorRole ?? undefined },
    publisher: { "@type": "Organization", name: publisher.name, logo: publisher.logo ? { "@type": "ImageObject", url: publisher.logo } : undefined },
  };
}

export function faqPageJsonLd(faq: { question: string; answer: string }[]) {
  if (faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

/** Amenities are saved as free text, sometimes several to an entry ("AC, TV"): one feature each. */
const features = (amenities: string[]) => [...new Set(amenities.flatMap((a) => a.split(",")).map((a) => a.trim()).filter(Boolean))];

const npr = (n: number) => n.toLocaleString("en-US");

/** The resort as a Hotel (a LodgingBusiness), built only from what the database holds. */
export function hotelJsonLd(business: Business, rooms: PublicRoomType[], image?: PublicMedia) {
  const prices = rooms.map((r) => r.basePriceNpr).filter((p) => p > 0);
  const amenities = features(rooms.flatMap((r) => r.amenities));
  const checkin = toIsoTime(business.checkInTime);
  const checkout = toIsoTime(business.checkOutTime);
  return {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: business.name,
    description: business.intro ?? undefined,
    url: SITE.url.toString(),
    image: image ? deliveryUrl(image.url, 1200) : undefined,
    telephone: business.phones[0],
    email: business.emails[0],
    address: business.address ? { "@type": "PostalAddress", streetAddress: business.address, addressCountry: "NP" } : undefined,
    geo:
      business.latitude != null && business.longitude != null
        ? { "@type": "GeoCoordinates", latitude: business.latitude, longitude: business.longitude }
        : undefined,
    hasMap: business.googleMapsUrl ?? undefined,
    sameAs: [business.instagramUrl, business.facebookUrl].filter(Boolean),
    checkinTime: checkin ?? undefined,
    checkoutTime: checkout ?? undefined,
    priceRange: prices.length ? (Math.min(...prices) === Math.max(...prices) ? `NPR ${npr(prices[0])}` : `NPR ${npr(Math.min(...prices))} - ${npr(Math.max(...prices))}`) : undefined,
    amenityFeature: amenities.length ? amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })) : undefined,
    containsPlace: rooms.length
      ? rooms.map((r) => ({
          "@type": "HotelRoom",
          name: r.name,
          description: r.description ?? undefined,
          url: abs("/stay"),
          image: r.photos[0] ? deliveryUrl(r.photos[0].url, 1200) : undefined,
          occupancy: { "@type": "QuantitativeValue", maxValue: r.maxGuests },
          amenityFeature: features(r.amenities).length ? features(r.amenities).map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })) : undefined,
        }))
      : undefined,
    makesOffer: rooms.length
      ? rooms.map((r) => ({
          "@type": "Offer",
          name: r.name,
          url: abs("/book"),
          itemOffered: { "@type": "HotelRoom", name: r.name },
          priceSpecification: { "@type": "UnitPriceSpecification", price: r.basePriceNpr, priceCurrency: "NPR", unitText: "night" },
        }))
      : undefined,
  };
}
