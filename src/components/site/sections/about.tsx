import { HOME } from "@/config/site-copy";
import type { PublicMedia } from "@/lib/content/queries";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";
import { SectionHeading } from "../typography";

/** About: two or three sentences (BusinessInfo) beside the layered photo collage. */
export function About({ text, photos }: { text: string | null; photos: PublicMedia[] }) {
  const [main, second, third] = photos;
  return (
    <section aria-labelledby="about-heading" className="relative overflow-hidden py-section-sm md:py-section">
      <div className="container-page grid items-center gap-y-16 md:grid-cols-12 md:gap-x-10">
        {main && (
          <Reveal className="relative mb-10 md:col-span-7 md:mb-0">
            <MediaPhoto media={main} sizes="(min-width: 768px) 55vw, 90vw" className="aspect-[4/3] w-[88%]" />
            {second && (
              <div className="absolute right-0 -bottom-12 w-[42%] outline-8 outline-cream md:-bottom-16">
                <MediaPhoto media={second} sizes="(min-width: 768px) 25vw, 45vw" className="aspect-[4/5]" />
              </div>
            )}
            {third && (
              <div className="absolute -top-10 right-[4%] hidden w-[26%] outline-8 outline-cream md:block">
                <MediaPhoto media={third} sizes="18vw" className="aspect-square" />
              </div>
            )}
          </Reveal>
        )}
        <Reveal className={main ? "md:col-span-5" : "md:col-span-12"} delay={150}>
          <SectionHeading id="about-heading" strong={HOME.about.strong} soft={HOME.about.soft} />
          {text && <p className="text-body mt-6 max-w-md">{text}</p>}
        </Reveal>
      </div>
    </section>
  );
}
