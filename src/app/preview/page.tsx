import type { Metadata } from "next";
import Image, { getImageProps } from "next/image";
import { MapPin, Phone, Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { LeafSprig, SageBlob, Wave } from "@/components/site/decor";
import { Icon, WhatsAppIcon } from "@/components/site/icons";
import { IconRow } from "@/components/site/icon-row";
import { Photo } from "@/components/site/photo";
import { PillarList } from "@/components/site/pillar-list";
import { Placeholder } from "@/components/site/placeholder";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Kicker, SectionHeading } from "@/components/site/typography";
import {
  about,
  activities,
  bookingHref,
  business,
  events,
  hero,
  highlights,
  intro,
  location,
  nav,
  pillars,
  rooms,
} from "./content";

export const metadata: Metadata = {
  title: "Design preview",
  description: business.intro,
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return (
    <>
      <PreviewBanner />
      <SiteHeader name={business.name} nav={nav} bookingHref={bookingHref} />
      <main>
        <Hero />
        <IntroBand />
        <Pillars />
        <About />
        <Rooms />
        <Activities />
        <Events />
        <Location />
      </main>
      <SiteFooter {...business} nav={nav} bookingHref={bookingHref} />
    </>
  );
}

function PreviewBanner() {
  return (
    <p className="sr-only">
      Design preview for Phase 1.5. Not the live site; photos are served locally and some text is placeholder.
    </p>
  );
}

/* ─── Hero ─── */

function Hero() {
  const common = {
    alt: hero.alt,
    fill: true,
    sizes: "100vw",
    fetchPriority: "high" as const,
    loading: "eager" as const,
  };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: hero.desktop.src });
  const { props: mobileProps } = getImageProps({ ...common, src: hero.mobile.src });

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative h-svh min-h-[38rem] overflow-hidden text-cream"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
        <img {...mobileProps} alt={hero.alt} className="object-cover" />
      </picture>
      {/* Legibility scrims: header at the top, title at the bottom */}
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-forest/70 to-transparent" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-linear-to-t from-forest/90 via-forest/35 via-45% to-transparent"
        aria-hidden="true"
      />

      <div className="container-page relative flex h-full flex-col justify-end pb-28 md:pb-40">
        <p className="text-label animate-fade-up" aria-label="Stay, Dine, Celebrate, Explore">
          Stay <span aria-hidden="true">|</span> Dine <span aria-hidden="true">|</span> Celebrate{" "}
          <span aria-hidden="true">|</span> Explore
        </p>
        <h1 id="hero-heading" className="text-display mt-5 max-w-3xl animate-fade-up [animation-delay:150ms]">
          {business.name}
        </h1>
        <p className="text-heading-soft mt-3 animate-fade-up [animation-delay:300ms]">{business.tagline}</p>
        <div className="mt-9 flex flex-wrap gap-3 animate-fade-up [animation-delay:450ms]">
          <a href="#pillars" className={buttonClasses({ variant: "brand-light", size: "lg" })}>
            Explore Bagaicha
          </a>
          <a
            href={bookingHref}
            className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-cream" })}
          >
            Book Your Stay
          </a>
        </div>
      </div>
      <Wave className="absolute inset-x-0 -bottom-px" />
    </section>
  );
}

/* ─── Brochure cover strip: highlights + intro line ─── */

function IntroBand() {
  return (
    <>
      <section aria-labelledby="intro-heading" className="bg-forest text-cream">
        <div className="container-page pt-6 pb-4 md:pt-10">
          <Reveal>
            <IconRow items={highlights} tone="light" />
          </Reveal>
          <div className="mt-12 flex items-center justify-center gap-5 md:mt-14">
            <span className="rule-short hidden shrink-0 text-cream/60 sm:block" aria-hidden="true" />
            <h2 id="intro-heading" className="text-quote text-center">
              {business.intro}
            </h2>
            <span className="rule-short hidden shrink-0 text-cream/60 sm:block" aria-hidden="true" />
          </div>
        </div>
      </section>
      {/* Flipped wave closes the forest band into the cream page */}
      <Wave position="bottom" className="-mt-px" />
    </>
  );
}

/* ─── Stay / Dine / Explore / Celebrate ─── */

function Pillars() {
  return (
    <section
      id="pillars"
      aria-labelledby="pillars-heading"
      className="relative overflow-hidden py-section-sm md:py-section"
    >
      <LeafSprig className="pointer-events-none absolute -top-6 -left-8 w-28 rotate-12 opacity-90 md:w-40" />
      <div className="container-page">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:gap-20">
          <Kicker words={intro.kicker} />
          <div>
            <h2 id="pillars-heading" className="sr-only">
              Stay, dine, explore and celebrate
            </h2>
            <Reveal>
              <p className="max-w-2xl font-display text-[clamp(1.5rem,2.6vw,2.125rem)] leading-snug font-light text-ink-heading italic">
                {intro.body}
              </p>
            </Reveal>
          </div>
        </div>
        <div className="mt-14 md:mt-20">
          <PillarList pillars={pillars} />
        </div>
      </div>
    </section>
  );
}

/* ─── Layered-photo About ─── */

function About() {
  return (
    <section aria-labelledby="about-heading" className="relative overflow-hidden pb-section-sm md:pb-section">
      <div className="container-page grid items-center gap-y-24 md:grid-cols-12 md:gap-x-10">
        <Reveal className="relative md:col-span-7">
          <Photo
            src={about.images.main.src}
            alt={about.images.main.alt}
            sizes="(min-width: 768px) 55vw, 90vw"
            className="aspect-[4/3] w-[88%]"
          />
          <div className="absolute right-0 -bottom-16 w-[42%] outline-8 outline-cream md:-bottom-20">
            <Photo
              src={about.images.second.src}
              alt={about.images.second.alt}
              sizes="(min-width: 768px) 25vw, 45vw"
              className="aspect-[4/5]"
            />
          </div>
          <div className="absolute -top-10 right-[4%] hidden w-[26%] outline-8 outline-cream md:block">
            <Photo
              src={about.images.third.src}
              alt={about.images.third.alt}
              sizes="(min-width: 768px) 18vw, 30vw"
              className="aspect-square"
            />
          </div>
        </Reveal>
        <Reveal className="md:col-span-5" delay={150}>
          <SectionHeading id="about-heading" strong={about.strong} soft={about.soft} />
          <p className="text-body mt-6 max-w-md">{about.body}</p>
        </Reveal>
      </div>

      <div className="relative mt-16 py-20 md:mt-20 md:py-28">
        <SageBlob className="pointer-events-none absolute inset-y-0 -right-40 h-full w-[34rem] md:-right-24 md:w-[44rem]" />
        <LeafSprig className="pointer-events-none absolute -top-10 right-2 w-24 -scale-x-100 md:right-[8%] md:w-32" />
        <div className="container-page relative">
          <Reveal>
            <blockquote className="text-quote ml-auto max-w-xl text-ink-heading md:mr-[6%]">
              <p>{about.quote}</p>
              <span className="rule-short mt-6" aria-hidden="true" />
            </blockquote>
          </Reveal>
        </div>
      </div>

      <div className="container-page relative mt-12 md:mt-16">
        <Reveal>
          <IconRow items={about.amenities} />
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Rooms teaser ─── */

function Rooms() {
  return (
    <section id="stay" aria-labelledby="stay-heading" className="bg-cream-dark py-section-sm md:py-section">
      <div className="container-page">
        <div className="grid gap-12 md:grid-cols-12 md:gap-10">
          <Reveal className="flex flex-col gap-10 md:col-span-4">
            <Kicker words={rooms.kicker} />
            <SectionHeading
              id="stay-heading"
              lead={rooms.headingLead}
              accent={rooms.headingAccent}
              soft={rooms.headingSoft}
            />
            <div>
              <p className="text-body">{rooms.line}</p>
              <Placeholder className="mt-5">{rooms.placeholder}</Placeholder>
            </div>
            <a href={bookingHref} className={buttonClasses({ variant: "brand", size: "lg", className: "self-start" })}>
              Book Your Stay
            </a>
          </Reveal>
          <Reveal className="md:col-span-8" delay={150}>
            {/* Overlay sits over the photo corner on desktop, overlapping its bottom edge on phones */}
            <div className="relative">
              <Photo
                src={rooms.main.src}
                alt={rooms.main.alt}
                sizes="(min-width: 768px) 60vw, 100vw"
                className="aspect-[4/3]"
              />
              <div className="relative -mt-12 ml-auto max-w-[17rem] rounded-tl-organic bg-forest px-7 pt-8 pb-6 text-right text-cream md:absolute md:right-0 md:bottom-0 md:mt-0 md:max-w-xs">
                <Icon name="bed" size={36} className="ml-auto" />
                <p className="mt-3 font-label text-xl tracking-[0.2em] uppercase">{rooms.overlay.title}</p>
                <p className="mt-2 text-sm leading-relaxed md:text-base">{rooms.overlay.body}</p>
              </div>
            </div>
          </Reveal>
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-3 md:mt-4 md:gap-4">
          {rooms.details.map((d, i) => (
            <li key={d.src}>
              <Reveal delay={i * 120}>
                <Photo src={d.src} alt={d.alt} sizes="33vw" className="aspect-square md:aspect-[4/3]" />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─── Activities ─── */

function Activities() {
  return (
    <section id="explore" aria-labelledby="explore-heading" className="py-section-sm md:py-section">
      <div className="container-page grid gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <Photo
              src={activities.image.src}
              alt={activities.image.alt}
              sizes="(min-width: 768px) 40vw, 100vw"
              className="aspect-[4/5]"
            />
            <div className="flex items-center gap-5 bg-sage px-6 py-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-icon text-icon">
                <Icon name="waves" size={24} />
              </span>
              <p className="text-title text-ink-heading">Chill Pool</p>
            </div>
          </div>
        </div>
        <div className="md:col-span-7">
          <Reveal className="flex flex-col gap-10">
            <Kicker words={activities.kicker} />
            <SectionHeading id="explore-heading" strong={activities.strong} soft={activities.soft} />
            <p className="text-body max-w-md">{activities.line}</p>
          </Reveal>
          <div className="mt-12 border-t border-ink/20">
            {activities.items.map((item) => (
              <details key={item.name} className="group border-b border-ink/20">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-[clamp(1.5rem,2.5vw,2rem)] font-bold text-ink-heading italic">
                    {item.name}
                  </span>
                  <Plus
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="shrink-0 text-icon transition-transform duration-300 group-open:rotate-45"
                  />
                </summary>
                <div className="flex flex-col items-start gap-3 pb-6">
                  {item.body ? <p className="text-body">{item.body}</p> : null}
                  {item.placeholder ? <Placeholder>{item.placeholder}</Placeholder> : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Weddings & Events, Conferences ─── */

function Events() {
  const c = events.conferences;
  return (
    <section id="events" aria-labelledby="events-heading" className="pt-section-sm md:pt-section">
      <div className="container-page grid items-center gap-12 md:grid-cols-12 md:gap-16">
        <Reveal className="flex flex-col gap-10 md:col-span-5">
          <Kicker words={events.kicker} />
          <SectionHeading id="events-heading" strong={events.strong} soft={events.soft} />
          <p className="text-body max-w-md">{events.body}</p>
        </Reveal>
        <Reveal className="md:col-span-7" delay={150}>
          <Photo
            src={events.image.src}
            alt={events.image.alt}
            sizes="(min-width: 768px) 55vw, 100vw"
            className="aspect-[4/5] md:aspect-[5/4]"
          >
            <Placeholder className="absolute top-3 left-3 right-3 sm:right-auto">
              {events.image.placeholder}
            </Placeholder>
          </Photo>
        </Reveal>
      </div>

      <div className="mt-16 bg-sage py-12 md:mt-24 md:py-14">
        <div className="container-page">
          <IconRow items={events.types} />
        </div>
      </div>

      <div className="container-page grid items-center gap-12 py-section-sm md:grid-cols-12 md:gap-16 md:py-section">
        <Reveal className="md:col-span-7">
          <Photo
            src={c.image.src}
            alt={c.image.alt}
            sizes="(min-width: 768px) 55vw, 100vw"
            className="aspect-[16/10]"
          />
        </Reveal>
        <Reveal className="md:col-span-5" delay={150}>
          <SectionHeading as="h3" strong={c.strong} />
          <p className="text-body mt-6 max-w-md">{c.body}</p>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 text-icon">
            {c.uses.map((u) => (
              <li key={u.label} className="flex items-center gap-3">
                <Icon name={u.icon} size={28} />
                <span className="text-label">{u.label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Location ─── */

function Location() {
  return (
    <section
      id="location"
      aria-labelledby="location-heading"
      className="relative overflow-hidden bg-cream-dark py-section-sm md:py-section"
    >
      <LeafSprig className="pointer-events-none absolute -top-4 -right-8 w-28 -scale-x-100 md:w-36" />
      <div className="container-page">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
          <h2
            id="location-heading"
            className="self-start rounded-full bg-sage px-7 py-3 whitespace-nowrap font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-ink-heading italic"
          >
            Our Location
          </h2>
          <address className="flex flex-col gap-4 not-italic sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10">
            <span className="flex items-start gap-3 font-label text-lg font-semibold text-ink-heading">
              <MapPin aria-hidden="true" strokeWidth={1.75} className="mt-0.5 shrink-0" />
              {business.address}
            </span>
            <a
              href={business.phone.href}
              className="flex items-center gap-3 font-label font-semibold text-ink-heading underline-offset-4 hover:underline"
            >
              <Phone aria-hidden="true" strokeWidth={1.75} size={20} />
              {business.phone.display}
            </a>
            <a
              href={business.whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "brand", size: "lg", className: "self-start" })}
            >
              <WhatsAppIcon size={18} />
              Chat on WhatsApp
            </a>
          </address>
        </div>

        <p className="text-body mt-10 max-w-3xl">{location.body}</p>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <ul className="flex flex-col gap-3 lg:col-span-5">
            {location.nearby.map((n) => (
              <li key={n.name} className="flex items-center gap-4 bg-sage px-4 py-4 md:gap-5 md:px-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-forest-dark text-cream md:size-14">
                  <Icon name={n.icon} size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-label text-sm font-medium tracking-wider text-ink-heading uppercase">{n.name}</p>
                  <p className="mt-1 text-sm text-ink">
                    {n.distance} · {n.time}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="lg:col-span-7">
            <a
              href={business.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
            >
              <Image
                src={location.map.src}
                alt={location.map.alt}
                width={1536}
                height={1024}
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="h-auto w-full"
              />
              <span className="mt-2 inline-block text-label text-ink-heading underline-offset-4 group-hover:underline">
                Open in Google Maps
              </span>
            </a>
            <div className="mt-4 flex flex-col gap-5 bg-cream p-5 sm:flex-row sm:items-center">
              <Image
                src={location.qr.src}
                alt={location.qr.alt}
                width={112}
                height={112}
                className="size-28 shrink-0"
              />
              <div className="flex flex-col items-start gap-3">
                <p className="text-body">Scan for directions on Google Maps, or open them on this device.</p>
                <a
                  href={business.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ variant: "brand", size: "lg" })}
                >
                  Get Directions
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
