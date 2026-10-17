import type { Business, PublicMedia, PublicRoomType } from "@/lib/content/queries";
import { hotelJsonLd, serializeJsonLd } from "@/lib/structured-data";

/** One JSON-LD script. Skips nothing/null so callers can pass optional data. */
export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

/** Hotel (LodgingBusiness) structured data for the whole site, built from the database. */
export function LodgingJsonLd({ business, rooms, image }: { business: Business; rooms: PublicRoomType[]; image?: PublicMedia }) {
  return <JsonLd data={hotelJsonLd(business, rooms, image)} />;
}
