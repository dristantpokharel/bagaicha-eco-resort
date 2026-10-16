import type { Metadata } from "next";
import { getActivities, getBusiness, getHomepageSlots, getNearby, getRoomTypes } from "@/lib/content/queries";
import { About } from "@/components/site/sections/about";
import { ExperiencesBand } from "@/components/site/sections/experiences-band";
import { Hero } from "@/components/site/sections/hero";
import { LocationSection } from "@/components/site/sections/location";
import { LodgingJsonLd } from "@/components/site/json-ld";
import { RoomsBand } from "@/components/site/sections/rooms-teaser";
import { DiningBand, EventsBand } from "@/components/site/sections/slim-bands";

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusiness();
  return {
    title: { absolute: business.tagline ? `${business.name} · ${business.tagline}` : business.name },
    description: business.intro ?? undefined,
    alternates: { canonical: "/" },
  };
}

/** Hero, About, Rooms, Experiences, Dining, Events & gatherings, Location. Every line comes from the database. */
export default async function HomePage() {
  const [business, slots, rooms, activities, nearby] = await Promise.all([
    getBusiness(),
    getHomepageSlots(),
    getRoomTypes(),
    getActivities(),
    getNearby(),
  ]);

  return (
    <>
      <LodgingJsonLd business={business} image={slots.HERO_DESKTOP?.[0]} />
      <Hero name={business.name} tagline={business.tagline} desktop={slots.HERO_DESKTOP?.[0]} mobile={slots.HERO_MOBILE?.[0]} />
      <About text={business.homeAbout} photos={slots.ABOUT ?? []} />
      <RoomsBand rooms={rooms} />
      <ExperiencesBand activities={activities} />
      <DiningBand line={business.homeDiningLine} photo={slots.DINE?.[0]} />
      <EventsBand line={business.homeEventsLine} photo={slots.EVENTS?.[0] ?? slots.CONFERENCE?.[0]} />
      <LocationSection business={business} nearby={nearby} map={slots.LOCATION?.[0]} />
    </>
  );
}
