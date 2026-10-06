import { deliveryUrl } from "@/lib/cloudinary/delivery";
import type { Business, PublicMedia } from "@/lib/content/queries";
import { SITE } from "@/config/site";

/** LodgingBusiness structured data, built only from what BusinessInfo actually holds. */
export function LodgingJsonLd({ business, image }: { business: Business; image?: PublicMedia }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: business.name,
    description: business.intro ?? undefined,
    url: SITE.url.toString(),
    image: image ? deliveryUrl(image.url, 1200) : undefined,
    telephone: business.phones[0],
    email: business.emails[0],
    address: business.address
      ? { "@type": "PostalAddress", streetAddress: business.address, addressCountry: "NP" }
      : undefined,
    geo:
      business.latitude != null && business.longitude != null
        ? { "@type": "GeoCoordinates", latitude: business.latitude, longitude: business.longitude }
        : undefined,
    hasMap: business.googleMapsUrl ?? undefined,
    sameAs: [business.instagramUrl, business.facebookUrl].filter(Boolean),
  };
  return (
    <script
      type="application/ld+json"
      // `<` is escaped so no field can close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
