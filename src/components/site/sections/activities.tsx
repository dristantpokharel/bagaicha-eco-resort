import { HOME } from "@/config/site-copy";
import type { PublicActivity, PublicMedia } from "@/lib/content/queries";
import { Plus } from "lucide-react";
import { Icon } from "../icons";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";
import { Kicker, SectionHeading } from "../typography";
import { ContentText } from "./content-text";

const DETAILS = [
  { field: "overview", label: null },
  { field: "duration", label: "Duration" },
  { field: "bestTime", label: "Best time" },
  { field: "whatToExpect", label: "What to expect" },
] as const;

/** One expandable experience: a native disclosure, so it works without JavaScript and by keyboard. */
export function ExperiencePanel({ activity, defaultOpen = false }: { activity: PublicActivity; defaultOpen?: boolean }) {
  const flagged = (f: string) => activity.placeholderFields.includes(f);
  const hasBody = !!activity.summary || DETAILS.some((d) => activity[d.field]);
  const title = (
    <span className="font-display text-[clamp(1.5rem,2.5vw,2rem)] font-bold text-ink-heading italic">{activity.title}</span>
  );
  if (!hasBody) {
    return <div className="flex min-h-16 items-center border-b border-ink/20 py-5">{title}</div>;
  }
  return (
    <details id={activity.slug} open={defaultOpen} className="group border-b border-ink/20">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
        {title}
        <Plus aria-hidden="true" strokeWidth={1.5} className="shrink-0 text-icon transition-transform duration-300 group-open:rotate-45" />
      </summary>
      <div className="flex flex-col items-start gap-4 pb-6">
        <ContentText text={activity.summary} flagged={flagged("summary")} />
        {DETAILS.map(({ field, label }) =>
          activity[field] ? (
            <div key={field}>
              {label && <p className="text-label mb-1 text-ink-muted">{label}</p>}
              <ContentText text={activity[field]} flagged={flagged(field)} />
            </div>
          ) : null,
        )}
      </div>
    </details>
  );
}

/** The activity list as an accordion. */
export function ExperienceList({ activities }: { activities: PublicActivity[] }) {
  return (
    <div className="border-t border-ink/20">
      {activities.map((a) => (
        <ExperiencePanel key={a.id} activity={a} />
      ))}
    </div>
  );
}

/** Home activities band: photo + label beside the accordion. */
export function ActivitiesSection({ activities, photo }: { activities: PublicActivity[]; photo?: PublicMedia }) {
  const copy = HOME.explore;
  const caption = activities.find((a) => a.slug === "chill-pool")?.title;
  return (
    <section aria-labelledby="explore-heading" className="py-section-sm md:py-section">
      <div className="container-page grid gap-12 md:grid-cols-12 md:gap-16">
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
          <Reveal className="flex flex-col gap-10">
            <Kicker words={copy.kicker} />
            <SectionHeading id="explore-heading" strong={copy.strong} soft={copy.soft} />
            <p className="text-body max-w-md">{copy.line}</p>
          </Reveal>
          <div className="mt-12">
            <ExperienceList activities={activities} />
          </div>
        </div>
      </div>
    </section>
  );
}
