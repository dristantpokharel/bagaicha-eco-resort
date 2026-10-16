import Link from "next/link";
import { HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicMedia } from "@/lib/content/queries";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";

/** Slim photo + line band shared by Dining and Events & gatherings (one layout, one set of styles). */
function SlimBand({
  id,
  title,
  line,
  photo,
  tone,
  flip = false,
  children,
}: {
  id: string;
  title: string;
  line: string | null;
  photo?: PublicMedia;
  tone: "sage" | "cream";
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`py-section-sm md:py-14 ${tone === "sage" ? "bg-sage" : ""}`}>
      <div className="container-page grid items-center gap-6 md:grid-cols-12 md:gap-12">
        {photo && (
          <Reveal className={`md:col-span-5 ${flip ? "md:order-2" : ""}`}>
            <MediaPhoto media={photo} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[16/10]" />
          </Reveal>
        )}
        <Reveal className={`flex flex-col items-start gap-4 ${photo ? "md:col-span-7" : "md:col-span-12"} ${flip ? "md:order-1" : ""}`} delay={120}>
          <h2 id={id} className="text-heading-strong text-ink-heading">
            {title}
          </h2>
          {line && <p className="max-w-xl font-display text-xl font-light text-ink-heading italic md:text-2xl">{line}</p>}
          {children}
        </Reveal>
      </div>
    </section>
  );
}

export function DiningBand({ line, photo }: { line: string | null; photo?: PublicMedia }) {
  return (
    <SlimBand id="dining-heading" title={HOME.dining.title} line={line} photo={photo} tone="sage">
      <Link href="/dine" className={buttonClasses({ variant: "brand", size: "lg" })}>
        Explore dining
      </Link>
    </SlimBand>
  );
}

export function EventsBand({ line, photo }: { line: string | null; photo?: PublicMedia }) {
  return (
    <SlimBand id="gatherings-heading" title={HOME.gatherings.title} line={line} photo={photo} tone="cream" flip>
      <Link href="/enquiry?type=EVENT" className={buttonClasses({ variant: "brand", size: "lg" })}>
        Enquire
        <span className="sr-only"> about an event</span>
      </Link>
    </SlimBand>
  );
}
