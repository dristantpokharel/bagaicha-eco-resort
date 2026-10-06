import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Wave } from "./decor";
import { InstagramIcon, WhatsAppIcon } from "./icons";

type Link = { display: string; href: string };

export type FooterProps = {
  name: string;
  tagline: string;
  address: string;
  phone: Link;
  whatsapp: Link;
  email: Link;
  instagram: Link;
  nav: readonly { label: string; href: string }[];
  bookingHref: string;
};

/** Brochure footer: olive-on-forest wave, then the dark forest band with contact details. */
export function SiteFooter(props: FooterProps) {
  const { name, tagline, address, phone, whatsapp, email, instagram, nav, bookingHref } = props;
  const year = new Date().getFullYear();
  const linkClass =
    "inline-flex items-center gap-3 py-1 hover:text-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream";

  return (
    <footer id="contact" className="mt-auto">
      <Wave />
      <div className="bg-forest pb-10 text-cream">
        <div className="container-page grid gap-12 pt-8 md:grid-cols-[1.3fr_1fr_1fr] md:pt-4">
          <div>
            <span className="block size-20 rounded-full bg-cream p-1">
              <Image src="/logo-mark.png" alt="" width={80} height={80} className="size-full" />
            </span>
            <p className="mt-5 font-display text-3xl font-bold italic">{name}</p>
            <p className="mt-1 font-display text-xl font-light italic text-sage">{tagline}</p>
            <a href={bookingHref} className={buttonClasses({ variant: "brand-light", size: "lg", className: "mt-8" })}>
              Book Your Stay
            </a>
          </div>

          <div>
            <h2 className="text-label text-sage">Contact</h2>
            <address className="mt-4 flex flex-col gap-2 not-italic">
              <span className="inline-flex items-start gap-3 py-1">
                <MapPin aria-hidden="true" size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {address}
              </span>
              <a href={phone.href} className={linkClass}>
                <Phone aria-hidden="true" size={20} strokeWidth={1.5} />
                {phone.display}
              </a>
              <a href={whatsapp.href} className={linkClass} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={20} />
                WhatsApp {whatsapp.display}
              </a>
              <a href={email.href} className={`${linkClass} break-all`}>
                <Mail aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0" />
                {email.display}
              </a>
              <a href={instagram.href} className={linkClass} target="_blank" rel="noopener noreferrer">
                <InstagramIcon size={20} />
                {instagram.display}
              </a>
            </address>
          </div>

          <nav aria-label="Footer">
            <h2 className="text-label text-sage">Explore</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {nav.map((item) => (
                <li key={item.href + item.label}>
                  <a href={item.href} className={linkClass}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="container-page mt-12">
          <p className="border-t border-cream/20 pt-6 text-sm text-sage">
            © {year} {name}
          </p>
        </div>
      </div>
    </footer>
  );
}
