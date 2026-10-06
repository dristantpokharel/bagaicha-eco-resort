import { Plus } from "lucide-react";
import { PAGES } from "@/config/site-copy";
import { getFaqs } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";
import { Paragraphs } from "@/components/site/sections/content-text";

export const generateMetadata = () => pageMetadata({ title: PAGES.faq.title, description: PAGES.faq.description, path: "/faq" });

export default async function FaqPage() {
  const faqs = await getFaqs();
  const copy = PAGES.faq;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />
      <div className="container-page max-w-3xl pb-10 md:pb-20 lg:mx-0 lg:ml-[max(0px,calc((100%-80rem)/2))]">
        {faqs.length === 0 ? (
          <p className="text-body">Questions and answers will be added here soon.</p>
        ) : (
          <div className="border-t border-ink/20">
            {faqs.map((f) => (
              <details key={f.id} className="group border-b border-ink/20">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
                  <h2 className="font-display text-xl font-bold text-ink-heading italic">{f.question}</h2>
                  <Plus aria-hidden="true" strokeWidth={1.5} className="shrink-0 text-icon transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <div className="pb-6">
                  <Paragraphs text={f.answer} flagged={f.placeholderFields.includes("answer")} />
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
