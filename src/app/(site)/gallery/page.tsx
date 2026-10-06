import { PAGES } from "@/config/site-copy";
import { getGallery } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { Gallery } from "@/components/site/gallery";
import { PageIntro } from "@/components/site/page-intro";

export const generateMetadata = () => pageMetadata({ title: PAGES.gallery.title, description: PAGES.gallery.description, path: "/gallery" });

export default async function GalleryPage() {
  const items = await getGallery();
  const copy = PAGES.gallery;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />
      <div className="container-page pb-10 md:pb-20">
        <Gallery items={items} />
      </div>
    </>
  );
}
