import { BOOKING_HREF, FOOTER_NAV, NAV } from "@/config/site-copy";
import { getBusiness } from "@/lib/content/queries";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { WhatsAppButton } from "@/components/site/whatsapp-button";

/** Public site frame: skip link, header, page, footer and the WhatsApp shortcut. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const business = await getBusiness();
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 bg-cream px-4 py-3 font-label text-sm text-forest focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader name={business.name} nav={NAV} bookingHref={BOOKING_HREF} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter business={business} nav={FOOTER_NAV} bookingHref={BOOKING_HREF} />
      <WhatsAppButton number={business.whatsapp} />
    </>
  );
}
