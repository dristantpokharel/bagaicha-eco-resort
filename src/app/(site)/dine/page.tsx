import Link from "next/link";
import { BOOKING_HREF, PAGES } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import { formatNpr } from "@/lib/money";
import { getDining, getHomepageSlots } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";
import { MediaPhoto } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/typography";
import { ContentText } from "@/components/site/sections/content-text";

export const generateMetadata = () => pageMetadata({ title: PAGES.dine.title, description: PAGES.dine.description, path: "/dine" });

export default async function DinePage() {
  const [sections, slots] = await Promise.all([getDining(), getHomepageSlots()]);
  const [lead, second] = slots.DINE ?? [];
  const copy = PAGES.dine;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />

      {lead && (
        <div className="container-page grid gap-3 md:grid-cols-12 md:gap-4">
          <Reveal className={second ? "md:col-span-7" : "md:col-span-12"}>
            <MediaPhoto media={lead} sizes="(min-width: 768px) 58vw, 100vw" preload className="aspect-[4/3]" />
          </Reveal>
          {second && (
            <Reveal className="md:col-span-5" delay={150}>
              <MediaPhoto media={second} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3] md:h-full md:aspect-auto" />
            </Reveal>
          )}
        </div>
      )}

      <div className="container-page py-10 md:py-16">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`dining-${section.id}`} className="grid gap-6 border-t border-ink/20 py-8 md:grid-cols-12 md:gap-12 md:py-12">
            <div className="md:col-span-4">
              <SectionHeading as="h2" id={`dining-${section.id}`} strong={section.title} />
            </div>
            <div className="space-y-6 md:col-span-8">
              <ContentText text={section.description} flagged={section.placeholderFields.includes("description")} />
              {section.items.length > 0 && (
                <ul className="divide-y divide-ink/15 border-y border-ink/15">
                  {section.items.map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-6 py-4">
                      <div>
                        <p className="font-display text-xl font-bold text-ink-heading italic">{item.name}</p>
                        {item.description && <p className="mt-1 text-sm text-ink">{item.description}</p>}
                      </div>
                      {item.priceNpr != null && <p className="shrink-0 text-ink">{formatNpr(item.priceNpr)}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}

        <div className="mt-6 flex flex-wrap gap-3 border-t border-ink/20 pt-8">
          <Link href={BOOKING_HREF} className={buttonClasses({ variant: "brand", size: "lg" })}>
            Book Your Stay
          </Link>
          <Link href="/enquiry" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-ink-heading" })}>
            Ask about dining
          </Link>
        </div>
      </div>
    </>
  );
}
