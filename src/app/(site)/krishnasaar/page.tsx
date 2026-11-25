import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BOOKING_HREF, KRISHNASAAR } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import { getKrishnasaar, type PublicKrishnasaar } from "@/lib/krishnasaar/queries";
import { pageMetadata } from "@/lib/seo";
import { faqPageJsonLd, touristAttractionJsonLd } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { MediaPhoto } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/typography";
import { PageIntro } from "@/components/site/page-intro";
import { Paragraphs } from "@/components/site/sections/content-text";
import { NearbyList } from "@/components/site/sections/location";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getKrishnasaar();
  if (!page) return {};
  return pageMetadata({ title: page.title, description: page.intro ?? KRISHNASAAR.fallbackDescription, path: KRISHNASAAR.path });
}

type TextKey = "whatItIs" | "history" | "wildlife" | "bestTime" | "gettingThere" | "whatToBring";

function TextSection({ id, heading, page, field, children }: { id: string; heading: string; page: PublicKrishnasaar; field: TextKey; children?: React.ReactNode }) {
  const text = page[field];
  if (!text && !children) return null;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="grid gap-6 border-t border-ink/20 py-8 md:grid-cols-12 md:gap-12 md:py-12">
      <div className="md:col-span-4">
        <SectionHeading as="h2" id={`${id}-heading`} strong={heading} />
      </div>
      <div className="space-y-4 md:col-span-8">
        {text && <Paragraphs text={text} flagged={page.flagged.includes(field)} flagLabel="Verify" />}
        {children}
      </div>
    </section>
  );
}

export default async function KrishnasaarPage() {
  const page = await getKrishnasaar();
  // Hidden in production until the title, intro and "what it is" have been reviewed.
  if (!page) notFound();
  const s = KRISHNASAAR.sections;
  const how = page.destination && [page.destination.distance, page.destination.travelTime].filter(Boolean).join(" · ");

  return (
    <>
      <Breadcrumbs items={[{ name: "Explore", path: "/explore" }, { name: page.title, path: KRISHNASAAR.path }]} />
      <JsonLd data={touristAttractionJsonLd(page)} />
      <JsonLd data={faqPageJsonLd(page.faqs)} />

      <PageIntro strong={page.title} line={page.intro ?? undefined} />

      {page.cover && (
        <div className="container-page">
          <Reveal>
            <MediaPhoto media={page.cover} sizes="(min-width: 1024px) 80vw, 100vw" preload className="aspect-[16/9]" />
          </Reveal>
        </div>
      )}

      <div className="container-page py-6 md:py-10">
        <TextSection id="what-it-is" heading={s.whatItIs} page={page} field="whatItIs" />
        <TextSection id="history" heading={s.history} page={page} field="history" />
        <TextSection id="wildlife" heading={s.wildlife} page={page} field="wildlife">
          {page.bestTime && <Paragraphs text={page.bestTime} flagged={page.flagged.includes("bestTime")} flagLabel="Verify" />}
        </TextSection>
        <TextSection id="getting-there" heading={s.gettingThere} page={page} field="gettingThere">
          {page.destination && how && (
            <p className="text-body font-medium">
              {page.destination.name}: {how}
            </p>
          )}
        </TextSection>
        <TextSection id="what-to-bring" heading={s.whatToBring} page={page} field="whatToBring" />

        {page.gallery.length > 0 && (
          <section id="photos" aria-labelledby="photos-heading" className="border-t border-ink/20 py-8 md:py-12">
            <SectionHeading as="h2" id="photos-heading" strong={s.gallery} />
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              {page.gallery.map((m) => (
                <li key={m.url}>
                  <MediaPhoto media={m} sizes="(min-width: 768px) 30vw, 50vw" className="aspect-[4/3]" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {page.nearby.length > 0 && (
          <section id="nearby" aria-labelledby="nearby-heading" className="grid gap-6 border-t border-ink/20 py-8 md:grid-cols-12 md:gap-12 md:py-12">
            <div className="md:col-span-4">
              <SectionHeading as="h2" id="nearby-heading" strong={s.nearby} />
            </div>
            <div className="md:col-span-8">
              <NearbyList nearby={page.nearby} />
              <p className="mt-4 text-body">
                More ideas for your stay on our <Link href="/explore" className="underline underline-offset-4">Explore page</Link> and the{" "}
                <Link href="/location" className="underline underline-offset-4">location page</Link>.
              </p>
            </div>
          </section>
        )}

        {page.faqs.length > 0 && (
          <section id="faq" aria-labelledby="faq-heading" className="grid gap-6 border-t border-ink/20 py-8 md:grid-cols-12 md:gap-12 md:py-12">
            <div className="md:col-span-4">
              <SectionHeading as="h2" id="faq-heading" strong={s.faq} />
            </div>
            <dl className="space-y-6 md:col-span-8">
              {page.faqs.map((f) => (
                <div key={f.id}>
                  <dt className="font-display text-xl font-bold text-ink-heading italic">{f.question}</dt>
                  <dd className="mt-2">
                    <Paragraphs text={f.answer} flagged={f.flagged} flagLabel="Verify" />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {page.guides.length > 0 && (
          <section id="guides" aria-labelledby="guides-heading" className="border-t border-ink/20 py-8 md:py-12">
            <SectionHeading as="h2" id="guides-heading" strong={s.guides} />
            <ul className="mt-6 space-y-3">
              {page.guides.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="font-display text-xl font-bold text-ink-heading italic underline-offset-4 hover:underline">
                    {g.title}
                  </Link>
                  {g.excerpt && <p className="mt-1 text-sm text-ink">{g.excerpt}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section aria-labelledby="krishnasaar-cta" className="bg-forest py-10 text-cream md:py-16">
        <div className="container-page text-center">
          <h2 id="krishnasaar-cta" className="text-heading-strong">
            {KRISHNASAAR.cta.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-body font-medium text-cream">{KRISHNASAAR.cta.line}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/enquiry?type=STAY" className={buttonClasses({ variant: "brand-light", size: "lg" })}>
              {KRISHNASAAR.cta.plan}
            </Link>
            <Link href={BOOKING_HREF} className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-cream" })}>
              {KRISHNASAAR.cta.book}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
