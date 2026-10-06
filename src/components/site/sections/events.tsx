import Link from "next/link";
import { EVENT_ICONS, HOME, PAGES } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicEventType, PublicMedia } from "@/lib/content/queries";
import { IconRow } from "../icon-row";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";
import { Icon, type IconName } from "../icons";
import { Kicker, SectionHeading } from "../typography";

const CONFERENCE_ICONS: IconName[] = ["people", "presentation", "group", "team"];

export const isConference = (e: PublicEventType) => e.slug === "conferences-and-trainings";

/** Weddings & Events, the icon band, then Conferences & Trainings. */
export function EventsSection({
  events,
  eventPhoto,
  conferencePhoto,
  withCtas = false,
}: {
  events: PublicEventType[];
  eventPhoto?: PublicMedia;
  conferencePhoto?: PublicMedia;
  /** On /events: enquiry buttons for each half. */
  withCtas?: boolean;
}) {
  const copy = HOME.events;
  const celebrations = events.filter((e) => !isConference(e));
  const conference = events.find(isConference);
  const items = celebrations.map((e) => ({ icon: (EVENT_ICONS[e.slug] ?? "people") as IconName, label: e.name }));

  return (
    <section aria-labelledby="events-heading" className="pt-section-sm md:pt-section">
      <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-16">
        <Reveal className="flex flex-col gap-6 md:gap-10 md:col-span-5">
          <Kicker words={copy.kicker} />
          <SectionHeading id="events-heading" strong={copy.strong} soft={copy.soft} />
          <p className="text-body max-w-md">{copy.body}</p>
          {withCtas && (
            <Link href="/enquiry?type=EVENT" className={buttonClasses({ variant: "brand", size: "lg", className: "self-start" })}>
              Enquire about an event
            </Link>
          )}
        </Reveal>
        {eventPhoto && (
          <Reveal className="md:col-span-7" delay={150}>
            <MediaPhoto media={eventPhoto} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[4/5] md:aspect-[5/4]" />
          </Reveal>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-10 bg-sage py-8 md:mt-24 md:py-14">
          <div className="container-page">
            <IconRow items={items} />
          </div>
        </div>
      )}

      {conference && (
        <div className="container-page grid items-center gap-8 py-section-sm md:grid-cols-12 md:gap-16 md:py-section">
          {conferencePhoto && (
            <Reveal className="md:col-span-7">
              <MediaPhoto media={conferencePhoto} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[16/10]" />
            </Reveal>
          )}
          <Reveal className={conferencePhoto ? "md:col-span-5" : "md:col-span-12"} delay={150}>
            <SectionHeading as="h3" strong={conference.name.replace(" & ", " & ")} />
            <p className="text-body mt-6 max-w-md">{conference.summary ?? PAGES.events.conference}</p>
            {conference.highlights.length > 0 && (
              <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 text-icon">
                {conference.highlights.map((label, i) => (
                  <li key={label} className="flex items-center gap-3">
                    <Icon name={CONFERENCE_ICONS[i % CONFERENCE_ICONS.length]} size={28} />
                    <span className="text-label">{label}</span>
                  </li>
                ))}
              </ul>
            )}
            {withCtas && (
              <Link href="/enquiry?type=CONFERENCE" className={buttonClasses({ variant: "brand", size: "lg", className: "mt-8" })}>
                Enquire about a conference
              </Link>
            )}
          </Reveal>
        </div>
      )}
    </section>
  );
}
