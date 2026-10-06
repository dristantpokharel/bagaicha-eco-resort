import Link from "next/link";
import { BOOKING_HREF, PAGES } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import { getActivities, getHomepageSlots, type ActivityGroupKey } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/typography";
import { ExperienceList } from "@/components/site/sections/activities";
import { ExploreHero } from "@/components/site/sections/explore-hero";
import { MapPin } from "lucide-react";

export const generateMetadata = () => pageMetadata({ title: PAGES.explore.title, description: PAGES.explore.description, path: "/explore" });

const GROUP_ORDER: ActivityGroupKey[] = ["AT_BAGAICHA", "CLOSE_BY", "DAY_TRIP"];
const GROUP_ID: Record<ActivityGroupKey, string> = { AT_BAGAICHA: "at-bagaicha", CLOSE_BY: "close-by", DAY_TRIP: "day-trips" };

export default async function ExplorePage() {
  const [activities, slots] = await Promise.all([getActivities(), getHomepageSlots()]);
  const copy = PAGES.explore;
  const blackbuck = activities.find((a) => a.slug === "krishnasaar-blackbuck-visit");
  const blackbuckDistance = blackbuck?.destination && [blackbuck.destination.distance, blackbuck.destination.travelTime].filter(Boolean).join(" · ");

  return (
    <>
      <ExploreHero
        strong={copy.heading.strong}
        soft={copy.heading.soft}
        line={copy.line}
        desktop={slots.EXPLORE_HERO_DESKTOP?.[0]}
        mobile={slots.EXPLORE_HERO_MOBILE?.[0]}
      />

      {GROUP_ORDER.map((group) => {
        const items = activities.filter((a) => a.group === group);
        if (items.length === 0) return null;
        const g = copy.groups[group];
        const id = GROUP_ID[group];
        return (
          <section key={group} id={id} aria-labelledby={`${id}-heading`} className="py-8 md:py-16">
            <div className="container-page grid gap-6 md:grid-cols-12 md:gap-12">
              <Reveal className="md:col-span-4">
                <div className="md:sticky md:top-28">
                  <SectionHeading id={`${id}-heading`} strong={g.heading} />
                  <p className="text-body mt-5 max-w-xs">{g.line}</p>
                </div>
              </Reveal>
              <div className="md:col-span-8">
                {group === "CLOSE_BY" && blackbuck?.overview && (
                  <aside aria-label="About the blackbuck" className="mb-8 flex flex-col gap-4 bg-sage p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
                    <div>
                      <p className="text-label text-ink-muted">Nepal’s only blackbuck habitat</p>
                      <p className="mt-2 max-w-prose text-ink-heading">{blackbuck.overview}</p>
                      {blackbuckDistance && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-heading">
                          <MapPin aria-hidden="true" size={16} strokeWidth={1.75} />
                          {blackbuckDistance} from Bagaicha
                        </p>
                      )}
                    </div>
                    <Link href="#krishnasaar-blackbuck-visit" className={buttonClasses({ variant: "brand", size: "lg", className: "shrink-0" })}>
                      Read more
                    </Link>
                  </aside>
                )}
                <ExperienceList activities={items} />
              </div>
            </div>
          </section>
        );
      })}

      {activities.length === 0 && <p className="container-page py-16 text-body">Experiences will be listed here soon.</p>}

      <section aria-labelledby="planning-heading" className="bg-forest py-10 text-cream md:py-16">
        <div className="container-page text-center">
          <h2 id="planning-heading" className="text-heading-strong">
            {copy.planning.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-body font-medium text-cream">{copy.planning.line}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/enquiry?type=STAY" className={buttonClasses({ variant: "brand-light", size: "lg" })}>
              Plan my stay
            </Link>
            <Link href={BOOKING_HREF} className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-cream" })}>
              Request a booking
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
