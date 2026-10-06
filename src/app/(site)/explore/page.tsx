import { PAGES } from "@/config/site-copy";
import { getActivities, getHomepageSlots } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";
import { MediaPhoto } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { ExperienceList } from "@/components/site/sections/activities";

export const generateMetadata = () => pageMetadata({ title: PAGES.explore.title, description: PAGES.explore.description, path: "/explore" });

export default async function ExplorePage() {
  const [activities, slots] = await Promise.all([getActivities(), getHomepageSlots()]);
  const photo = slots.EXPLORE?.[0];
  const copy = PAGES.explore;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />
      <div className="container-page grid gap-8 pb-10 md:grid-cols-12 md:gap-16 md:pb-20">
        {photo && (
          <Reveal className="md:col-span-5">
            <div className="md:sticky md:top-28">
              <MediaPhoto media={photo} sizes="(min-width: 768px) 40vw, 100vw" preload className="aspect-[4/5]" />
            </div>
          </Reveal>
        )}
        <div className={photo ? "md:col-span-7" : "md:col-span-12"}>
          <ExperienceList activities={activities} />
          {activities.length === 0 && <p className="text-body">Experiences will be listed here soon.</p>}
        </div>
      </div>
    </>
  );
}
