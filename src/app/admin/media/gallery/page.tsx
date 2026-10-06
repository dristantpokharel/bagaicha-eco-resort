import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { GALLERY_LABELS } from "@/lib/media";
import { loadPickerLibrary, pickerMediaSelect, placementKey, toPlacements } from "@/lib/media-queries";
import { PlacementManager } from "@/components/media/placement-manager";
import { GalleryCategory } from "@/generated/prisma/enums";

export const metadata = { title: "Gallery · Media" };

export default async function GalleryPage() {
  await requirePagePermission(ADMIN_SECTIONS.media.permission);
  const [library, items] = await Promise.all([
    loadPickerLibrary(),
    db.galleryItem.findMany({
      select: { id: true, category: true, media: { select: pickerMediaSelect } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-charcoal-light">
        Choose which photos appear in each gallery category and in what order. A photo can be in more than one category.
      </p>
      {Object.values(GalleryCategory).map((category) => {
        const placements = toPlacements(items.filter((item) => item.category === category));
        return (
          <PlacementManager
            key={placementKey(placements)}
            target={{ kind: "gallery", category }}
            title={GALLERY_LABELS[category]}
            placements={placements}
            library={library}
          />
        );
      })}
    </div>
  );
}
