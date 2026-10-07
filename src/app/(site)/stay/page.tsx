import Link from "next/link";
import { PAGES } from "@/config/site-copy";
import { getRoomTypes, getStayTerms } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";
import { RoomSection } from "@/components/site/sections/room-section";

export const generateMetadata = () => pageMetadata({ title: PAGES.stay.title, description: PAGES.stay.description, path: "/stay" });

export default async function StayPage() {
  const [rooms, { childUnderAge }] = await Promise.all([getRoomTypes(), getStayTerms()]);
  const copy = PAGES.stay;
  return (
    <>
      <PageIntro strong={copy.heading.strong} soft={copy.heading.soft} line={copy.line} />
      <div className="divide-y divide-ink/15">
        {rooms.map((room, i) => (
          <RoomSection key={room.id} room={room} childUnderAge={childUnderAge} flip={i % 2 === 1} />
        ))}
      </div>
      {rooms.length === 0 && <p className="container-page pb-16 text-body">Our rooms will be listed here soon.</p>}
      <p className="container-page py-10 text-ink">
        Staying with a larger group, or for an event?{" "}
        <Link href="/enquiry" className="text-forest underline underline-offset-4">
          Send us an enquiry
        </Link>
        .
      </p>
    </>
  );
}
