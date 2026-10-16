import Link from "next/link";
import { HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicActivity } from "@/lib/content/queries";
import { showPlaceholders } from "@/lib/content/placeholder";
import { MediaPhoto } from "../photo";
import { Placeholder } from "../placeholder";
import { Reveal } from "../reveal";
import { SectionHeading } from "../typography";

const TILES = 4;

/** Home experiences: up to four "At Bagaicha" activities as photo tiles (name only), then a link to /explore. */
export function ExperiencesBand({ activities }: { activities: PublicActivity[] }) {
  const here = activities.filter((a) => a.group === "AT_BAGAICHA");
  // Tiles with a photo first; in development a missing photo shows a marked placeholder instead.
  const tiles = [...here.filter((a) => a.cover), ...(showPlaceholders ? here.filter((a) => !a.cover) : [])].slice(0, TILES);
  if (tiles.length === 0) return null;
  const copy = HOME.explore;
  return (
    <section aria-labelledby="explore-heading" className="py-section-sm md:py-section">
      <div className="container-page">
        <Reveal>
          <SectionHeading id="explore-heading" strong={copy.strong} soft={copy.soft} />
        </Reveal>
        <ul className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:gap-5 lg:grid-cols-4">
          {tiles.map((a, i) => (
            <li key={a.id}>
              <Reveal delay={i * 100}>
                <Link href={`/explore#${a.slug}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
                  {a.cover ? (
                    <MediaPhoto media={a.cover} sizes="(min-width: 1024px) 22vw, 50vw" className="aspect-[4/5]" imgClassName="transition-transform duration-700 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center border border-dashed border-warning bg-cream p-3 text-center">
                      <Placeholder>Photo needed</Placeholder>
                    </div>
                  )}
                  <p className="mt-3 font-label text-sm font-semibold tracking-wider text-ink-heading uppercase">{a.title}</p>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
        <Link href="/explore" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "mt-8 text-ink-heading" })}>
          See all experiences
        </Link>
      </div>
    </section>
  );
}
