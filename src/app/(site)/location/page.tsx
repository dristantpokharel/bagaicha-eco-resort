import { MapPin, Phone } from "lucide-react";
import { HOME, PAGES } from "@/config/site-copy";
import { getBusiness, getHomepageSlots, getNearby } from "@/lib/content/queries";
import { telHref } from "@/lib/content/contact";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";
import { MapBlock, NearbyList } from "@/components/site/sections/location";

export const generateMetadata = () => pageMetadata({ title: PAGES.location.title, description: PAGES.location.description, path: "/location" });

export default async function LocationPage() {
  const [business, nearby, slots] = await Promise.all([getBusiness(), getNearby(), getHomepageSlots()]);
  const [phone] = business.phones;
  const copy = PAGES.location;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={HOME.location.body}>
        <address className="mt-6 flex flex-col gap-3 not-italic sm:flex-row sm:flex-wrap sm:gap-x-10">
          {business.address && (
            <span className="flex items-start gap-3 font-label text-lg font-semibold text-ink-heading">
              <MapPin aria-hidden="true" strokeWidth={1.75} className="mt-0.5 shrink-0" />
              {business.address}
            </span>
          )}
          {phone && (
            <a href={telHref(phone)} className="flex items-center gap-3 font-label font-semibold text-ink-heading underline-offset-4 hover:underline">
              <Phone aria-hidden="true" strokeWidth={1.75} size={20} />
              {phone}
            </a>
          )}
        </address>
      </PageIntro>
      <div className="container-page grid gap-8 pb-10 lg:grid-cols-12 lg:gap-12 lg:pb-20">
        {nearby.length > 0 && (
          <section aria-labelledby="nearby-heading" className="lg:col-span-5">
            <h2 id="nearby-heading" className="text-title mb-4 text-ink-heading">
              Nearby
            </h2>
            <NearbyList nearby={nearby} />
          </section>
        )}
        <div className={nearby.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}>
          <MapBlock business={business} map={slots.LOCATION?.[0]} />
        </div>
      </div>
    </>
  );
}
