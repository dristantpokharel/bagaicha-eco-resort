import { BOOKING_HREF, FOOTER_NAV, NAV } from "@/config/site-copy";
import { getBusiness, getHomepageSlots, getRoomTypes } from "@/lib/content/queries";
import { RouteBreadcrumbData } from "@/components/site/breadcrumbs";
import { LodgingJsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { StagingBanner } from "@/components/site/staging-banner";
import { WhatsAppButton } from "@/components/site/whatsapp-button";

/** Public site frame: skip link, header, page, footer and the WhatsApp shortcut. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [business, rooms, slots] = await Promise.all([getBusiness(), getRoomTypes(), getHomepageSlots()]);
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 bg-cream px-4 py-3 font-label text-sm text-forest focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <LodgingJsonLd business={business} rooms={rooms} image={slots.HERO_DESKTOP?.[0] ?? slots.HERO_MOBILE?.[0]} />
      <RouteBreadcrumbData />
      <SiteHeader name={business.name} nav={NAV} bookingHref={BOOKING_HREF} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter business={business} nav={FOOTER_NAV} bookingHref={BOOKING_HREF} />
      <WhatsAppButton number={business.whatsapp} />
      <StagingBanner />
    </>
  );
}
