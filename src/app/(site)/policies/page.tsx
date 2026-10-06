import { PAGES } from "@/config/site-copy";
import { getPolicies } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";
import { Paragraphs } from "@/components/site/sections/content-text";

export const generateMetadata = () => pageMetadata({ title: PAGES.policies.title, description: PAGES.policies.description, path: "/policies" });

export default async function PoliciesPage() {
  const policies = await getPolicies();
  const copy = PAGES.policies;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />
      <div className="container-page pb-10 md:pb-20">
        {policies.length === 0 && <p className="text-body">Our policies will be published here soon.</p>}
        {policies.length > 1 && (
          <nav aria-label="Policies" className="mb-8">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {policies.map((p) => (
                <li key={p.id}>
                  <a href={`#${p.slug}`} className="inline-flex min-h-11 items-center text-ink-heading underline underline-offset-4">
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {policies.map((p) => (
          <section key={p.id} id={p.slug} aria-labelledby={`${p.slug}-heading`} className="grid gap-4 border-t border-ink/20 py-8 md:grid-cols-12 md:gap-12">
            <h2 id={`${p.slug}-heading`} className="font-display text-2xl font-bold text-ink-heading italic md:col-span-4">
              {p.title}
            </h2>
            <div className="max-w-prose md:col-span-8">
              <Paragraphs text={p.body} flagged={p.placeholderFields.includes("body")} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
