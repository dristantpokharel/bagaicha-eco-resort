import { HOME } from "@/config/site-copy";
import type { HomepageSlots } from "@/lib/content/queries";
import { LeafSprig } from "../decor";
import { PillarList } from "../pillar-list";
import { Reveal } from "../reveal";
import { Kicker } from "../typography";

/** Stay / Dine / Explore / Celebrate. */
export function Pillars({ slots }: { slots: HomepageSlots }) {
  const pillars = HOME.pillars.map((p) => ({ ...p, image: slots[p.slot]?.[0] ?? null }));
  return (
    <section id="pillars" aria-labelledby="pillars-heading" className="relative overflow-hidden py-section-sm md:py-section">
      <LeafSprig className="pointer-events-none absolute -top-6 -left-8 w-28 rotate-12 opacity-90 md:w-40" />
      <div className="container-page">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:gap-20">
          <Kicker words={HOME.intro.kicker} />
          <div>
            <h2 id="pillars-heading" className="sr-only">
              Stay, dine, explore and celebrate
            </h2>
            <Reveal>
              <p className="max-w-2xl font-display text-[clamp(1.5rem,2.6vw,2.125rem)] leading-snug font-light text-ink-heading italic">
                {HOME.intro.body}
              </p>
            </Reveal>
          </div>
        </div>
        <div className="mt-14 md:mt-20">
          <PillarList pillars={pillars} />
        </div>
      </div>
    </section>
  );
}
