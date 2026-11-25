import Link from "next/link";
import { KRISHNASAAR } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicMedia } from "@/lib/content/queries";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";

/** Slim homepage feature: photo, the page title and a two-line intro, and a link. Rendered only when /krishnasaar is live. */
export function KrishnasaarBand({ title, intro, photo }: { title: string; intro: string | null; photo: PublicMedia | null }) {
  return (
    <section aria-labelledby="krishnasaar-band-heading" className="bg-sage py-section-sm md:py-14">
      <div className="container-page grid items-center gap-6 md:grid-cols-12 md:gap-12">
        {photo && (
          <Reveal className="md:col-span-5">
            <MediaPhoto media={photo} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[16/10]" />
          </Reveal>
        )}
        <Reveal className={`flex flex-col items-start gap-4 ${photo ? "md:col-span-7" : "md:col-span-12"}`} delay={120}>
          <h2 id="krishnasaar-band-heading" className="text-heading-strong text-ink-heading">
            {title}
          </h2>
          {intro && <p className="line-clamp-2 max-w-xl font-display text-xl font-light text-ink-heading italic md:text-2xl">{intro}</p>}
          <Link href={KRISHNASAAR.path} className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-ink-heading" })}>
            {KRISHNASAAR.band.cta}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
