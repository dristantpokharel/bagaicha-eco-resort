import Link from "next/link";
import { MapPin } from "lucide-react";
import { HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicActivity, PublicMedia } from "@/lib/content/queries";
import { showPlaceholders } from "@/lib/content/placeholder";
import { Icon } from "../icons";
import { MediaPhoto } from "../photo";
import { Placeholder } from "../placeholder";
import { ActivityPhotos } from "../activity-photos";
import { Reveal } from "../reveal";
import { Kicker, SectionHeading } from "../typography";
import { ContentText } from "./content-text";

/** "~5 km · 10–15 mins" from the linked nearby destination. Never typed on the activity. */
function distanceText(a: PublicActivity) {
  const d = a.destination;
  if (!d) return null;
  const parts = [d.distance, d.travelTime].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** One experience, always open: photos on one side and text on the other (stacked on phones). */
export function ExperiencePanel({ activity, flip = false }: { activity: PublicActivity; flip?: boolean }) {
  const flagged = (f: string) => activity.placeholderFields.includes(f);
  const distance = distanceText(activity);
  const hasPhotos = activity.photos.length > 0;
  const showPhotos = hasPhotos || showPlaceholders;
  const canArrange = activity.group !== "AT_BAGAICHA";

  return (
    <article id={activity.slug} className="grid scroll-mt-28 gap-5 border-b border-ink/20 py-8 md:grid-cols-12 md:items-center md:gap-10">
      <div className={`space-y-4 ${showPhotos ? "md:col-span-7" : "md:col-span-12"} ${flip ? "md:order-2" : ""}`}>
        <div>
          {activity.category && <p className="text-label text-leaf">{activity.category}</p>}
          <h3 className="mt-1 font-display text-[clamp(1.375rem,2.4vw,2rem)] leading-tight font-bold text-ink-heading italic">{activity.title}</h3>
        </div>
        <ContentText text={activity.description} flagged={flagged("overview")} />
        {canArrange && distance && (
          <p className="inline-flex items-center gap-1.5 bg-sage px-3 py-1.5 text-sm text-ink-heading">
            <MapPin aria-hidden="true" size={16} strokeWidth={1.75} />
            {activity.destination?.placeholder ? <Placeholder>{distance}</Placeholder> : distance}
            <span className="sr-only"> from Bagaicha</span>
          </p>
        )}
        {canArrange && (
          <div>
            <Link href={`/enquiry?type=STAY&about=${encodeURIComponent(activity.slug)}`} className={buttonClasses({ variant: "brand", size: "lg" })}>
              Ask us to arrange
              <span className="sr-only">: {activity.title}</span>
            </Link>
          </div>
        )}
      </div>

      {showPhotos && (
        <div className={`md:col-span-5 ${flip ? "md:order-1" : ""}`}>
          {hasPhotos ? (
            <ActivityPhotos photos={activity.photos} title={activity.title} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center border border-dashed border-warning bg-cream p-4 text-center">
              <Placeholder>Photo needed for {activity.title}</Placeholder>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** The activity list: every experience open and compact, alternating sides on desktop. */
export function ExperienceList({ activities }: { activities: PublicActivity[] }) {
  return (
    <div className="border-t border-ink/20">
      {activities.map((a, i) => (
        <ExperiencePanel key={a.id} activity={a} flip={i % 2 === 1} />
      ))}
    </div>
  );
}

/** Home activities band: photo + label beside the list. Shows only what is at the resort. */
export function ActivitiesSection({ activities, photo }: { activities: PublicActivity[]; photo?: PublicMedia }) {
  const copy = HOME.explore;
  const here = activities.filter((a) => a.group === "AT_BAGAICHA");
  const caption = activities.find((a) => a.slug === "chill-pool")?.title;
  return (
    <section aria-labelledby="explore-heading" className="py-section-sm md:py-section">
      <div className="container-page grid gap-8 md:grid-cols-12 md:gap-16">
        {photo && (
          <div className="md:col-span-5">
            <div className="md:sticky md:top-28">
              <MediaPhoto media={photo} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/5]" />
              {caption && (
                <div className="flex items-center gap-5 bg-sage px-6 py-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-icon text-icon">
                    <Icon name="waves" size={24} />
                  </span>
                  <p className="text-title text-ink-heading">{caption}</p>
                </div>
              )}
            </div>
          </div>
        )}
        <div className={photo ? "md:col-span-7" : "md:col-span-12"}>
          <Reveal className="flex flex-col gap-6 md:gap-10">
            <Kicker words={copy.kicker} />
            <SectionHeading id="explore-heading" strong={copy.strong} soft={copy.soft} />
            <p className="text-body max-w-md">{copy.line}</p>
          </Reveal>
          <div className="mt-8 md:mt-12">
            <ExperienceList activities={here} />
          </div>
          <Link href="/explore" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "mt-8 text-ink-heading" })}>
            See all experiences
          </Link>
        </div>
      </div>
    </section>
  );
}
