import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { HOMEPAGE_SLOT_LABELS } from "@/lib/media";
import { loadPickerLibrary, pickerMediaSelect, placementKey, toPlacements } from "@/lib/media-queries";
import { PlacementManager } from "@/components/media/placement-manager";
import { HomepageSlotKey } from "@/generated/prisma/enums";

export const metadata = { title: "Homepage · Media" };

/** Slots the public site no longer shows. Their placements stay in the database; they are just not listed here. */
const RETIRED_SLOTS: readonly HomepageSlotKey[] = ["STAY", "EXPLORE"];

const SLOT_HINTS: Partial<Record<HomepageSlotKey, string>> = {
  HERO_DESKTOP: "Wide landscape photo for large screens.",
  HERO_MOBILE: "Photo cropped for phones; a portrait-friendly subject works best.",
  ABOUT: "Main photo first, then the smaller overlapping photos.",
  DINE: "The photo in the Dining band (the Dine page uses these too).",
  EVENTS: "The Events & gatherings collage on the homepage: the first photo leads, the Conference photo follows it, then the rest in this order (up to three). The Events page uses these too.",
  CONFERENCE: "Conferences & trainings photo on the Events page. Its first photo also sits second in the homepage Events collage.",
  LOCATION: "The illustrated map on the homepage and the Location page.",
  EXPLORE_HERO_DESKTOP: "Wide landscape photo at the top of the Explore page.",
  EXPLORE_HERO_MOBILE: "Portrait-friendly photo at the top of the Explore page on phones.",
};

export default async function HomepageMediaPage() {
  await requirePagePermission(ADMIN_SECTIONS.media.permission);
  const [library, slots] = await Promise.all([
    loadPickerLibrary(),
    db.homepageSlot.findMany({
      select: { id: true, slot: true, media: { select: pickerMediaSelect } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-charcoal-light">
        Photos for the homepage sections that still use them, in order. Rooms and Experiences photos come from Rooms and Content → Activities.
      </p>
      {Object.values(HomepageSlotKey).filter((slot) => !RETIRED_SLOTS.includes(slot)).map((slot) => {
        const placements = toPlacements(slots.filter((row) => row.slot === slot));
        return (
          <PlacementManager
            key={`${slot}:${placementKey(placements)}`}
            target={{ kind: "homepage", slot }}
            title={HOMEPAGE_SLOT_LABELS[slot]}
            description={SLOT_HINTS[slot]}
            placements={placements}
            library={library}
          />
        );
      })}
    </div>
  );
}
