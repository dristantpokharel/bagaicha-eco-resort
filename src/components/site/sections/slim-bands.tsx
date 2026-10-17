import Link from "next/link";
import { HOME } from "@/config/site-copy";
import { buttonClasses } from "@/components/ui/button";
import type { PublicMedia } from "@/lib/content/queries";
import { MAX_COLLAGE } from "@/lib/content/collage";
import { MediaPhoto } from "../photo";
import { Reveal } from "../reveal";

/**
 * One to three photos. One: a single frame. Two or three: a large photo with the others beside or
 * below it (phones: large on top, the rest in a 2-up row). Only photos that exist get a frame.
 */
function Collage({ photos }: { photos: PublicMedia[] }) {
  const shown = photos.slice(0, MAX_COLLAGE);
  const [main, ...rest] = shown;
  if (!main) return null;
  if (rest.length === 0) return <MediaPhoto media={main} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[16/10]" />;
  const two = rest.length === 1;
  return (
    <div className={`grid grid-cols-2 gap-3 md:gap-4 ${two ? "md:grid-cols-3" : "md:grid-cols-3 md:grid-rows-2"}`}>
      <MediaPhoto
        media={main}
        sizes="(min-width: 768px) 45vw, 100vw"
        className={two ? "aspect-[4/5] md:col-span-2 md:aspect-[4/3]" : "col-span-2 aspect-[16/10] md:row-span-2 md:aspect-auto md:h-full md:min-h-0"}
      />
      {rest.map((p) => (
        <MediaPhoto
          key={p.url}
          media={p}
          sizes="(min-width: 768px) 20vw, 50vw"
          compact
          className={two ? "aspect-[4/5] md:aspect-auto md:h-full" : "aspect-[4/3]"}
        />
      ))}
    </div>
  );
}

/** Slim photo + line band shared by Dining and Events & gatherings (one layout, one set of styles). */
function SlimBand({
  id,
  title,
  line,
  photos,
  tone,
  flip = false,
  children,
}: {
  id: string;
  title: string;
  line: string | null;
  photos: PublicMedia[];
  tone: "sage" | "cream";
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`py-section-sm md:py-14 ${tone === "sage" ? "bg-sage" : ""}`}>
      <div className="container-page grid items-center gap-6 md:grid-cols-12 md:gap-12">
        {photos.length > 0 && (
          <Reveal className={photos.length > 1 ? `md:col-span-7 ${flip ? "md:order-2" : ""}` : `md:col-span-5 ${flip ? "md:order-2" : ""}`}>
            <Collage photos={photos} />
          </Reveal>
        )}
        <Reveal className={`flex flex-col items-start gap-4 ${photos.length > 1 ? "md:col-span-5" : photos.length === 1 ? "md:col-span-7" : "md:col-span-12"} ${flip ? "md:order-1" : ""}`} delay={120}>
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
    <SlimBand id="dining-heading" title={HOME.dining.title} line={line} photos={photo ? [photo] : []} tone="sage">
      <Link href="/dine" className={buttonClasses({ variant: "brand", size: "lg" })}>
        Explore dining
      </Link>
    </SlimBand>
  );
}

export function EventsBand({ line, photos }: { line: string | null; photos: PublicMedia[] }) {
  return (
    <SlimBand id="gatherings-heading" title={HOME.gatherings.title} line={line} photos={photos} tone="cream" flip>
      <Link href="/enquiry?type=EVENT" className={buttonClasses({ variant: "brand", size: "lg" })}>
        Enquire
        <span className="sr-only"> about an event</span>
      </Link>
    </SlimBand>
  );
}
