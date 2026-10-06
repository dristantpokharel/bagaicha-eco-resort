import { HOME } from "@/config/site-copy";
import { IconRow } from "../icon-row";
import { Reveal } from "../reveal";
import { Wave } from "../decor";

/** Brochure cover strip: highlights + the intro line from BusinessInfo. */
export function IntroBand({ intro }: { intro: string | null }) {
  return (
    <>
      <section aria-labelledby="intro-heading" className="bg-forest text-cream">
        <div className="container-page pt-6 pb-4 md:pt-10">
          <Reveal>
            <IconRow items={HOME.highlights} tone="light" />
          </Reveal>
          {intro && (
            <div className="mt-12 flex items-center justify-center gap-5 md:mt-14">
              <span className="rule-short hidden shrink-0 text-cream/60 sm:block" aria-hidden="true" />
              <h2 id="intro-heading" className="text-quote text-center">
                {intro}
              </h2>
              <span className="rule-short hidden shrink-0 text-cream/60 sm:block" aria-hidden="true" />
            </div>
          )}
        </div>
      </section>
      <Wave position="bottom" className="-mt-px" />
    </>
  );
}
