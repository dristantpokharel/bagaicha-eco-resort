import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import type { Business } from "@/lib/content/queries";
import { formatWhatsapp, instagramHandle, mailHref, telHref, whatsappHref } from "@/lib/content/contact";
import { Wave } from "./decor";
import { InstagramIcon, WhatsAppIcon } from "./icons";

type NavItem = { label: string; href: string };

/** Brochure footer: olive-on-forest wave, then the dark forest band with contact details. */
export function SiteFooter({ business, nav, bookingHref }: { business: Business; nav: readonly NavItem[]; bookingHref: string }) {
  const year = new Date().getFullYear();
  const linkClass =
    "inline-flex items-center gap-3 py-1 hover:text-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream";
  const [phone] = business.phones;
  const [email] = business.emails;

  return (
    <footer className="mt-auto">
      <Wave />
      <div className="bg-forest pb-10 text-cream">
        <div className="container-page grid gap-12 pt-8 md:grid-cols-[1.3fr_1fr_1fr] md:pt-4">
          <div>
            <span className="block size-20 rounded-full bg-cream p-1">
              <Image src="/logo-mark.png" alt="" width={80} height={80} className="size-full" />
            </span>
            <p className="mt-5 font-display text-3xl font-bold italic">{business.name}</p>
            {business.tagline && <p className="mt-1 font-display text-xl font-light italic text-sage">{business.tagline}</p>}
            <Link href={bookingHref} className={buttonClasses({ variant: "brand-light", size: "lg", className: "mt-8" })}>
              Book Your Stay
            </Link>
          </div>

          <div>
            <h2 className="text-label text-sage">Contact</h2>
            <address className="mt-4 flex flex-col gap-2 not-italic">
              {business.address && (
                <span className="inline-flex items-start gap-3 py-1">
                  <MapPin aria-hidden="true" size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                  {business.address}
                </span>
              )}
              {phone && (
                <a href={telHref(phone)} className={linkClass}>
                  <Phone aria-hidden="true" size={20} strokeWidth={1.5} />
                  {phone}
                </a>
              )}
              {business.whatsapp && (
                <a href={whatsappHref(business.whatsapp)} className={linkClass} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon size={20} />
                  WhatsApp {formatWhatsapp(business.whatsapp)}
                </a>
              )}
              {email && (
                <a href={mailHref(email)} className={`${linkClass} break-all`}>
                  <Mail aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0" />
                  {email}
                </a>
              )}
              {business.instagramUrl && (
                <a href={business.instagramUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                  <InstagramIcon size={20} />
                  {instagramHandle(business.instagramUrl)}
                </a>
              )}
            </address>
          </div>

          <nav aria-label="Footer">
            <h2 className="text-label text-sage">Explore</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="container-page mt-12">
          <p className="border-t border-cream/20 pt-6 text-sm text-sage">
            © {year} {business.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
