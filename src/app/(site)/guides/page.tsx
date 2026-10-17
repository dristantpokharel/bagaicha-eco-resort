import Link from "next/link";
import type { Metadata } from "next";
import { PAGES } from "@/config/site-copy";
import { pageMetadata } from "@/lib/seo";
import { tagsOf, visibleGuides } from "@/lib/guides/queries";
import { PageIntro } from "@/components/site/page-intro";
import { GuideCard } from "@/components/guides/guide-parts";

type Props = { searchParams: Promise<{ tag?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tag } = await searchParams;
  const meta = await pageMetadata({ title: PAGES.guides.title, description: PAGES.guides.description, path: "/guides" });
  // A filtered list is a view of the same content: keep the canonical on /guides and out of the index.
  return tag ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function GuidesPage({ searchParams }: Props) {
  const { tag } = await searchParams;
  const all = await visibleGuides();
  const tags = tagsOf(all);
  const guides = tag ? all.filter((g) => g.tags.includes(tag)) : all;
  const copy = PAGES.guides;
  const chip = (active: boolean) =>
    `px-3 py-1.5 font-label text-xs tracking-wider uppercase ${active ? "bg-forest text-cream" : "bg-sage text-ink-heading hover:bg-sage-hover"}`;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />
      <div className="container-page pb-16">
        {tags.length > 0 && (
          <nav aria-label="Filter by tag" className="mb-10">
            <ul className="flex flex-wrap gap-2">
              <li><Link href="/guides" aria-current={!tag ? "page" : undefined} className={chip(!tag)}>All</Link></li>
              {tags.map((t) => (
                <li key={t}><Link href={`/guides?tag=${encodeURIComponent(t)}`} aria-current={tag === t ? "page" : undefined} className={chip(tag === t)}>{t}</Link></li>
              ))}
            </ul>
          </nav>
        )}
        {guides.length > 0 ? (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => <GuideCard key={g.id} guide={g} />)}
          </div>
        ) : (
          <p className="text-body">{tag ? "No guides with that tag yet." : "Our guides will be here soon."}</p>
        )}
      </div>
    </>
  );
}
