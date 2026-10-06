import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { HOMEPAGE_SLOT_LABELS } from "@/lib/media";
import { loadPickerLibrary, pickerMediaSelect, placementKey, toPlacements } from "@/lib/media-queries";
import { PlacementManager } from "@/components/media/placement-manager";
import { HomepageSlotKey } from "@/generated/prisma/enums";

export const metadata = { title: "Homepage · Media" };

const SLOT_HINTS: Partial<Record<HomepageSlotKey, string>> = {
  HERO_DESKTOP: "Wide landscape photo for large screens.",
  HERO_MOBILE: "Photo cropped for phones; a portrait-friendly subject works best.",
  ABOUT: "Main photo first, then the smaller overlapping photos.",
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
        Photos for each homepage section, in order. The public homepage starts using these in Phase 5.
      </p>
      {Object.values(HomepageSlotKey).map((slot) => {
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
