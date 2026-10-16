import Link from "next/link";
import { MapPin } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import type { PublicActivity } from "@/lib/content/queries";
import { showPlaceholders } from "@/lib/content/placeholder";
import { Placeholder } from "../placeholder";
import { ActivityPhotos } from "../activity-photos";
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
