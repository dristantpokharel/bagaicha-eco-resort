import type { Metadata } from "next";
import { BOOKING } from "@/config/booking";
import { PublicShell } from "@/components/booking/public-shell";
import { EnquiryForm } from "@/components/booking/enquiry-form";
import { ENQUIRY_TYPE_LABELS } from "@/lib/booking/labels";

export const metadata: Metadata = {
  title: "Enquiry",
  alternates: { canonical: "/enquiry" },
};

export default async function EnquiryPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams;
  const requested = Array.isArray(type) ? type[0] : type;
  const defaultType = requested && requested in ENQUIRY_TYPE_LABELS ? requested : "STAY";

  return (
    <PublicShell>
      <h1 className="font-display text-3xl font-bold italic text-ink-heading sm:text-4xl">Send an enquiry</h1>
      <p className="mt-2 max-w-prose text-ink">
        For events, conferences, larger groups or anything that doesn&apos;t fit a regular booking. For a stay in one
        room, you can{" "}
        <a href="/book" className="text-forest underline underline-offset-4">
          request a booking
        </a>{" "}
        directly.
      </p>
      <div className="mt-8">
        <EnquiryForm defaultType={defaultType} defaultCountryCode={BOOKING.defaultCountryCode} />
      </div>
    </PublicShell>
  );
}
