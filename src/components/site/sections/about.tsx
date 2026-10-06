import { HOME } from "@/config/site-copy";
import type { PublicMedia } from "@/lib/content/queries";
import { LeafSprig, SageBlob } from "../decor";
import { IconRow } from "../icon-row";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";
import { SectionHeading } from "../typography";

/** Layered-photo About: one large photo with two smaller ones overlapping it. */
export function About({ photos }: { photos: PublicMedia[] }) {
  const [main, second, third] = photos;
  return (
    <section aria-labelledby="about-heading" className="relative overflow-hidden pb-section-sm md:pb-section">
      <div className="container-page grid items-center gap-y-24 md:grid-cols-12 md:gap-x-10">
        <Reveal className="relative md:col-span-7">
          {main && <MediaPhoto media={main} sizes="(min-width: 768px) 55vw, 90vw" className="aspect-[4/3] w-[88%]" />}
          {second && (
            <div className="absolute right-0 -bottom-16 w-[42%] outline-8 outline-cream md:-bottom-20">
              <MediaPhoto media={second} sizes="(min-width: 768px) 25vw, 45vw" className="aspect-[4/5]" />
            </div>
          )}
          {third && (
            <div className="absolute -top-10 right-[4%] hidden w-[26%] outline-8 outline-cream md:block">
              <MediaPhoto media={third} sizes="18vw" className="aspect-square" />
            </div>
          )}
        </Reveal>
        <Reveal className="md:col-span-5" delay={150}>
          <SectionHeading id="about-heading" strong={HOME.about.strong} soft={HOME.about.soft} />
          <p className="text-body mt-6 max-w-md">{HOME.about.body}</p>
        </Reveal>
      </div>

      <div className="relative mt-16 py-20 md:mt-20 md:py-28">
        <SageBlob className="pointer-events-none absolute inset-y-0 -right-40 h-full w-[34rem] md:-right-24 md:w-[44rem]" />
        <LeafSprig className="pointer-events-none absolute -top-10 right-2 w-24 -scale-x-100 md:right-[8%] md:w-32" />
        <div className="container-page relative">
          <Reveal>
            <blockquote className="text-quote ml-auto max-w-xl text-ink-heading md:mr-[6%]">
              <p>{HOME.about.quote}</p>
              <span className="rule-short mt-6" aria-hidden="true" />
            </blockquote>
          </Reveal>
        </div>
      </div>

      <div className="container-page relative mt-12 md:mt-16">
        <Reveal>
          <IconRow items={HOME.about.amenities} />
        </Reveal>
      </div>
    </section>
  );
}
