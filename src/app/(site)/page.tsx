import type { Metadata } from "next";
import { getActivities, getBusiness, getEventTypes, getHomepageSlots, getNearby, getRoomTypes } from "@/lib/content/queries";
import { ActivitiesSection } from "@/components/site/sections/activities";
import { About } from "@/components/site/sections/about";
import { EventsSection } from "@/components/site/sections/events";
import { Hero } from "@/components/site/sections/hero";
import { IntroBand } from "@/components/site/sections/intro-band";
import { LocationSection } from "@/components/site/sections/location";
import { Pillars } from "@/components/site/sections/pillars";
import { RoomsTeaser } from "@/components/site/sections/rooms-teaser";

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusiness();
  return {
    title: { absolute: business.tagline ? `${business.name} · ${business.tagline}` : business.name },
    description: business.intro ?? undefined,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const [business, slots, rooms, activities, events, nearby] = await Promise.all([
    getBusiness(),
    getHomepageSlots(),
    getRoomTypes(),
    getActivities(),
    getEventTypes(),
    getNearby(),
  ]);

  return (
    <>
      <Hero name={business.name} tagline={business.tagline} desktop={slots.HERO_DESKTOP?.[0]} mobile={slots.HERO_MOBILE?.[0]} />
      <IntroBand intro={business.intro} />
      <Pillars slots={slots} />
      <About photos={slots.ABOUT ?? []} />
      <RoomsTeaser rooms={rooms} />
      <ActivitiesSection activities={activities} photo={slots.EXPLORE?.[0]} />
      <EventsSection events={events} eventPhoto={slots.EVENTS?.[0]} conferencePhoto={slots.CONFERENCE?.[0]} />
      <LocationSection business={business} nearby={nearby} map={slots.LOCATION?.[0]} />
    </>
  );
}
