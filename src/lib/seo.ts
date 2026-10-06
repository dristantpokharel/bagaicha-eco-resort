import "server-only";
import type { Metadata } from "next";
import { deliveryUrl } from "@/lib/cloudinary/delivery";
import { getHomepageSlots } from "@/lib/content/queries";
import { SITE } from "@/config/site";

/**
 * Per-page metadata: title, description, canonical URL (relative to
 * NEXT_PUBLIC_SITE_URL via metadataBase) and Open Graph, with the hero photo as the share image.
 */
export async function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Promise<Metadata> {
  const slots = await getHomepageSlots();
  const hero = slots.HERO_DESKTOP?.[0] ?? slots.HERO_MOBILE?.[0];
  const images = hero ? [{ url: deliveryUrl(hero.url, 1200), alt: hero.altText || SITE.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · ${SITE.name}`, description, url: path, type: "website", images },
    twitter: { card: images ? "summary_large_image" : "summary", title: `${title} · ${SITE.name}`, description, images: images?.map((i) => i.url) },
  };
}
