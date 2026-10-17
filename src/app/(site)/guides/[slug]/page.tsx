import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { deliveryUrl } from "@/lib/cloudinary/delivery";
import { getBusiness } from "@/lib/content/queries";
import { getVisibleGuide, relatedGuides, visibleGuides } from "@/lib/guides/queries";
import { GuidePost } from "@/components/guides/guide-post";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = await getVisibleGuide((await params).slug);
  if (!guide) return {};
  const title = guide.seoTitle || guide.title;
  const description = guide.seoDescription || guide.excerpt;
  const path = `/guides/${guide.slug}`;
  const images = guide.cover ? [{ url: deliveryUrl(guide.cover.url, 1200), width: 1200, alt: guide.cover.altText || guide.title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    authors: [{ name: guide.authorName }],
    openGraph: {
      type: "article",
      title: `${title} · ${SITE.name}`,
      description,
      url: path,
      publishedTime: guide.publishedAt.toISOString(),
      modifiedTime: guide.updatedAt.toISOString(),
      authors: [guide.authorName],
      tags: guide.tags,
      images,
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE.name}`, description, images: images?.map((i) => i.url) },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const [all, business] = await Promise.all([visibleGuides(), getBusiness()]);
  const guide = all.find((g) => g.slug === slug);
  if (!guide) notFound();
  return <GuidePost guide={guide} related={relatedGuides(all, guide)} publisherName={business.name} />;
}
