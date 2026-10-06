import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicActivity, PublicMedia } from "@/lib/content/queries";
import { showPlaceholders } from "@/lib/content/placeholder";
import { Icon } from "../icons";
import { MediaPhoto } from "../photo";
import { Placeholder } from "../placeholder";
import { Reveal } from "../reveal";
import { Kicker, SectionHeading } from "../typography";
import { ContentText } from "./content-text";

const label = "text-label mb-1 text-ink-muted";

function Chip({ children, flagged = false }: { children: React.ReactNode; flagged?: boolean }) {
  return flagged ? (
    <li>
      <Placeholder>{children}</Placeholder>
    </li>
  ) : (
    <li className="bg-sage px-3 py-1.5 font-label text-[0.6875rem] font-medium tracking-wider text-ink-heading uppercase">{children}</li>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-ink/20 bg-cream p-3">
      <p className={label}>{title}</p>
      <div className="text-ink">{children}</div>
    </div>
  );
}

/** "~5 km · 10–15 mins" from the linked nearby destination. Never typed on the activity. */
function distanceText(a: PublicActivity) {
  const d = a.destination;
  if (!d) return null;
  const parts = [d.distance, d.travelTime].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** One expandable experience: a native disclosure, so it works without JavaScript and by keyboard. */
export function ExperiencePanel({ activity, defaultOpen = false }: { activity: PublicActivity; defaultOpen?: boolean }) {
  const flagged = (f: string) => activity.placeholderFields.includes(f);
  const distance = distanceText(activity);
  const [main, ...more] = activity.photos;
  const canArrange = activity.group !== "AT_BAGAICHA";
  const hasBody =
    !!(activity.overview || activity.duration || activity.season || activity.bestTime || activity.whatToExpect || activity.howWeHelp || activity.tip || distance) ||
    activity.bestFor.length > 0 ||
    activity.highlights.length > 0 ||
    activity.photos.length > 0;

  const head = (
    <span className="min-w-0">
      {activity.category && <span className="text-label block text-leaf">{activity.category}</span>}
      <span className="mt-1 block font-display text-[clamp(1.375rem,2.4vw,2rem)] leading-tight font-bold text-ink-heading italic">
        {activity.title}
      </span>
      {activity.summary && (
        <span className="mt-1 block max-w-prose text-sm text-ink">
          {flagged("summary") ? <Placeholder>{activity.summary}</Placeholder> : activity.summary}
        </span>
      )}
    </span>
  );

  if (!hasBody) return <div id={activity.slug} className="min-h-16 border-b border-ink/20 py-5">{head}</div>;

  return (
    <details id={activity.slug} open={defaultOpen} className="group border-b border-ink/20">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
        {head}
        <span className="flex shrink-0 items-center gap-3">
          {distance && (
            <span className="hidden items-center gap-1.5 text-sm text-ink-heading sm:inline-flex">
              <MapPin aria-hidden="true" size={16} strokeWidth={1.75} />
              {activity.destination?.placeholder ? <span className="text-warning">distance: placeholder</span> : distance}
            </span>
          )}
          <Plus aria-hidden="true" strokeWidth={1.5} className="text-icon transition-transform duration-300 group-open:rotate-45" />
        </span>
      </summary>

      <div className="grid gap-6 pb-8 md:grid-cols-12 md:gap-8">
        {(main || showPlaceholders) && (
          <div className="md:col-span-5">
            {main ? (
              <MediaPhoto media={main} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3]" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center border border-dashed border-warning bg-cream p-4 text-center">
                <Placeholder>Photo needed for {activity.title}</Placeholder>
              </div>
            )}
            {more.length > 0 && (
              <ul className="mt-3 grid grid-cols-3 gap-3">
                {more.map((m) => (
                  <li key={m.url}>
                    <MediaPhoto media={m} sizes="(min-width: 768px) 14vw, 30vw" className="aspect-square" compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={`space-y-5 ${main || showPlaceholders ? "md:col-span-7" : "md:col-span-12"}`}>
          <ContentText text={activity.overview} flagged={flagged("overview")} />

          {(activity.duration || activity.season || activity.bestTime || distance) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {distance && (
                <Tile title={`From Bagaicha${activity.destination ? `: ${activity.destination.name}` : ""}`}>
                  {activity.destination?.placeholder ? <Placeholder>{distance}</Placeholder> : distance}
                </Tile>
              )}
              {activity.duration && (
                <Tile title="Duration">
                  <ContentText text={activity.duration} flagged={flagged("duration")} className="" />
                </Tile>
              )}
              {activity.season && (
                <Tile title="Best season">
                  <ContentText text={activity.season} flagged={flagged("season")} className="" />
                </Tile>
              )}
              {activity.bestTime && (
                <Tile title="Best time">
                  <ContentText text={activity.bestTime} flagged={flagged("bestTime")} className="" />
                </Tile>
              )}
            </div>
          )}

          {activity.bestFor.length > 0 && (
            <div>
              <p className={label}>Best for</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {activity.bestFor.map((b) => (
                  <Chip key={b} flagged={flagged("bestFor")}>
                    {b}
                  </Chip>
                ))}
              </ul>
            </div>
          )}

          {activity.highlights.length > 0 && (
            <div>
              <p className={label}>What you might see</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {activity.highlights.map((h) => (
                  <Chip key={h} flagged={flagged("highlights")}>
                    {h}
                  </Chip>
                ))}
              </ul>
            </div>
          )}

          {activity.whatToExpect && (
            <div>
              <p className={label}>What to expect</p>
              <ContentText text={activity.whatToExpect} flagged={flagged("whatToExpect")} />
            </div>
          )}

          {activity.howWeHelp && (
            <div>
              <p className={label}>How we help</p>
              <ContentText text={activity.howWeHelp} flagged={flagged("howWeHelp")} />
            </div>
          )}

          {activity.tip && (
            <div className="border-l-2 border-leaf pl-3">
              <p className={label}>Tip</p>
              <ContentText text={activity.tip} flagged={flagged("tip")} className="text-body italic" />
            </div>
          )}

          {canArrange && (
            <Link
              href={`/enquiry?type=STAY&about=${encodeURIComponent(activity.slug)}`}
              className={buttonClasses({ variant: "brand", size: "lg" })}
            >
              Ask us to arrange
              <span className="sr-only">: {activity.title}</span>
            </Link>
          )}
        </div>
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

/** Home activities band: photo + label beside the accordion. Shows only what is at the resort. */
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
