import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBusiness } from "@/lib/content/queries";
import { mediaVisible } from "@/lib/content/placeholder";
import { GuidePost } from "@/components/guides/guide-post";
import { faqSchema } from "@/lib/guides/schemas";
import { readingMinutes } from "@/lib/guides/rules";
import { relatedGuides, visibleGuides, type PublicGuide } from "@/lib/guides/queries";

export const metadata = { title: "Guide preview", robots: { index: false, follow: false } };

/** The public post template, fed from the saved row (draft or not). Admin only: the admin layout checks the permission. */
export default async function GuidePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("content.manage");
  const { id } = await params;
  const [g, business] = await Promise.all([db.guide.findUnique({ where: { id }, include: { cover: true } }), getBusiness()]);
  if (!g) notFound();
  const guide: PublicGuide = {
    id: g.id,
    slug: g.slug,
    title: g.title,
    excerpt: g.excerpt,
    body: g.body,
    tags: g.tags,
    authorName: g.authorName || "(author not set)",
    authorRole: g.authorRole,
    publishedAt: g.publishedAt ?? new Date(),
    updatedAt: g.updatedAt,
    seoTitle: g.seoTitle,
    seoDescription: g.seoDescription,
    faq: faqSchema.catch([]).parse(g.faq),
    cover: g.cover && mediaVisible(g.cover) ? { ...g.cover } : null,
    readingMinutes: readingMinutes(g.body),
  };
  return (
    <div className="-mx-4 bg-cream sm:-mx-6">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-warning px-4 py-2 text-sm text-cream" role="status">
        <span>Draft preview: {g.status === "PUBLISHED" ? "this guide is published." : "visitors cannot see this yet."} Only signed-in admins can open this page.</span>
        <Link href={`/admin/content/guides/${g.id}`} className="underline underline-offset-4">Back to editor</Link>
      </div>
      <GuidePost guide={guide} related={relatedGuides(await visibleGuides(), guide)} publisherName={business.name} structuredData={false} />
    </div>
  );
}
