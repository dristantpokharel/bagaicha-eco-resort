import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { BOOKING_HREF, PAGES } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import { formatWhatsapp, instagramHandle, mailHref, telHref, whatsappHref } from "@/lib/content/contact";
import { getBusiness } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { Icon, InstagramIcon, WhatsAppIcon } from "@/components/site/icons";
import { PageIntro } from "@/components/site/page-intro";

export const generateMetadata = () => pageMetadata({ title: PAGES.contact.title, description: PAGES.contact.description, path: "/contact" });

const linkClass = "inline-flex min-h-11 items-center gap-3 text-ink-heading underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-sage p-6">
      <h2 className="text-label text-ink-muted">{title}</h2>
      <div className="mt-3 flex flex-col items-start gap-1">{children}</div>
    </section>
  );
}

export default async function ContactPage() {
  const b = await getBusiness();
  const copy = PAGES.contact;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />
      <div className="container-page grid gap-4 pb-10 md:grid-cols-2 md:gap-6 md:pb-20">
        {b.phones.length > 0 && (
          <Block title="Call">
            {b.phones.map((p) => (
              <a key={p} href={telHref(p)} className={linkClass}>
                <Phone aria-hidden="true" size={20} strokeWidth={1.5} />
                {p}
              </a>
            ))}
          </Block>
        )}
        {b.whatsapp && (
          <Block title="WhatsApp">
            <a href={whatsappHref(b.whatsapp)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <WhatsAppIcon size={20} />
              {formatWhatsapp(b.whatsapp)}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Block>
        )}
        {b.emails.length > 0 && (
          <Block title="Email">
            {b.emails.map((e) => (
              <a key={e} href={mailHref(e)} className={`${linkClass} break-all`}>
                <Mail aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0" />
                {e}
              </a>
            ))}
          </Block>
        )}
        {(b.instagramUrl || b.facebookUrl) && (
          <Block title="Follow">
            {b.instagramUrl && (
              <a href={b.instagramUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <InstagramIcon size={20} />
                {instagramHandle(b.instagramUrl)}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            {b.facebookUrl && (
              <a href={b.facebookUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <Icon name="people" size={20} />
                Facebook
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </Block>
        )}
        {b.address && (
          <Block title="Visit">
            <address className="flex items-start gap-3 not-italic text-ink-heading">
              <MapPin aria-hidden="true" size={20} strokeWidth={1.5} className="mt-1 shrink-0" />
              {b.address}
            </address>
            <Link href="/location" className={linkClass}>
              Directions and nearby places
            </Link>
          </Block>
        )}
        <section className="bg-forest p-6 text-cream md:col-span-2">
          <h2 className="font-display text-2xl font-bold italic">Planning a stay or an event?</h2>
          <p className="mt-2 max-w-xl">Send a booking request for a room, or an enquiry for events, conferences and larger groups.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={BOOKING_HREF} className={buttonClasses({ variant: "brand-light", size: "lg" })}>
              Book Your Stay
            </Link>
            <Link href="/enquiry" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-cream" })}>
              Send an enquiry
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
