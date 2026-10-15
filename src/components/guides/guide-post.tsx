import Link from "next/link";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { MediaPhoto } from "@/components/site/photo";
import { SectionHeading } from "@/components/site/typography";
import { blogPostingJsonLd, faqPageJsonLd } from "@/lib/structured-data";
import type { PublicGuide } from "@/lib/guides/queries";
import { GuideMarkdown } from "./guide-markdown";
import { formatGuideDate, GuideCard, GuideCtas } from "./guide-parts";

/** One guide page. The public route and the admin preview both render this. */
export function GuidePost({ guide, related, publisherName, structuredData = true }: { guide: PublicGuide; related: PublicGuide[]; publisherName: string; structuredData?: boolean }) {
  return (
    <>
      {structuredData && (
        <>
          <JsonLd data={blogPostingJsonLd(guide, { name: publisherName })} />
          <JsonLd data={faqPageJsonLd(guide.faq)} />
        </>
      )}
      <Breadcrumbs items={[{ name: "Guides", path: "/guides" }, { name: guide.title, path: `/guides/${guide.slug}` }]} />
      <article>
        <header className="container-page pt-8 pb-8 md:pt-12">
          <SectionHeading as="h1" strong={guide.title} />
          <p className="mt-6 font-label text-xs tracking-widest text-ink-muted uppercase">
            By {guide.authorName}
            {guide.authorRole ? `, ${guide.authorRole}` : ""} · <time dateTime={guide.publishedAt.toISOString()}>{formatGuideDate(guide.publishedAt)}</time> · {guide.readingMinutes} min read
          </p>
          {guide.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
              {guide.tags.map((t) => (
                <li key={t}>
                  <Link href={`/guides?tag=${encodeURIComponent(t)}`} className="bg-sage px-2.5 py-1 font-label text-xs tracking-wider text-ink-heading uppercase hover:bg-sage-hover">{t}</Link>
                </li>
              ))}
            </ul>
          )}
        </header>
        {guide.cover && (
          <div className="container-page">
            <MediaPhoto media={guide.cover} sizes="(min-width: 1280px) 1200px, 100vw" preload className="aspect-[16/9]" />
          </div>
        )}
        <div className="container-page mt-8 max-w-3xl">
          <GuideCtas tone="inline" />
          <GuideMarkdown source={guide.body} />
          {guide.faq.length > 0 && (
            <section aria-labelledby="guide-faq-heading" className="mt-12">
              <h2 id="guide-faq-heading" className="text-heading-strong mb-4 text-ink-heading">Questions</h2>
              <div className="divide-y divide-ink/15 border-y border-ink/15">
                {guide.faq.map((f) => (
                  <details key={f.question} className="group py-4">
                    <summary className="cursor-pointer font-label text-sm font-medium tracking-wider text-ink-heading uppercase focus-visible:outline-2 focus-visible:outline-forest">{f.question}</summary>
                    <p className="text-body mt-3 whitespace-pre-line">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
      <div className="container-page mt-12 max-w-3xl">
        <GuideCtas />
      </div>
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="container-page mt-16 pb-16">
          <h2 id="related-heading" className="text-heading-strong mb-6 text-ink-heading">More guides</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((g) => <GuideCard key={g.id} guide={g} />)}
          </div>
        </section>
      )}
    </>
  );
}
