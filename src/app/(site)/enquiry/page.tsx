import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING } from "@/config/booking";
import { PublicShell } from "@/components/booking/public-shell";
import { EnquiryForm } from "@/components/booking/enquiry-form";
import { ENQUIRY_TYPE_LABELS } from "@/lib/booking/labels";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Send an enquiry",
    description: "Enquire about events, conferences, larger groups or a custom stay at Bagaicha Eco Resort in Bardiya, Nepal.",
    path: "/enquiry",
  });

export default async function EnquiryPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams;
  const requested = Array.isArray(type) ? type[0] : type;
  const defaultType = requested && requested in ENQUIRY_TYPE_LABELS ? requested : "STAY";

  return (
    <>
      <PageIntro
        id="enquiry-heading"
        strong="Send an"
        soft="enquiry"
        line="For events, conferences, larger groups or anything that doesn't fit a regular booking."
      >
        <p className="text-body mt-3 max-w-2xl">
          For a stay in one room, you can{" "}
          <Link href="/book" className="text-forest underline underline-offset-4">
            request a booking
          </Link>{" "}
          directly.
        </p>
      </PageIntro>
    <PublicShell>
      <div>
        <EnquiryForm defaultType={defaultType} defaultCountryCode={BOOKING.defaultCountryCode} />
      </div>
    </PublicShell>
    </>
  );
}
