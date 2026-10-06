import { PAGES } from "@/config/site-copy";
import { getEventTypes, getHomepageSlots } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { EventsSection } from "@/components/site/sections/events";

export const generateMetadata = () => pageMetadata({ title: PAGES.events.title, description: PAGES.events.description, path: "/events" });

/** The events section carries the page heading (h2 there), so this page adds a visually hidden h1. */
export default async function EventsPage() {
  const [events, slots] = await Promise.all([getEventTypes(), getHomepageSlots()]);
  return (
    <>
      <h1 className="sr-only">{PAGES.events.title}: weddings, celebrations, conferences and trainings</h1>
      <div className="pt-6 md:pt-10">
        <EventsSection events={events} eventPhoto={slots.EVENTS?.[0]} conferencePhoto={slots.CONFERENCE?.[0]} withCtas />
      </div>
    </>
  );
}
