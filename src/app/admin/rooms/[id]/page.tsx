import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadStayTerms } from "@/lib/content/stay-terms";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { loadPickerLibrary, pickerMediaSelect, placementKey, toPlacements } from "@/lib/media-queries";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/admin/page-header";
import { FormMessage } from "@/components/ui/form";
import { PlacementManager } from "@/components/media/placement-manager";
import { RoomTypeForm } from "../room-type-form";
import { RoomsManager } from "../rooms-manager";
import { RoomTypeStatus } from "../room-type-status";

export const metadata = { title: "Edit room type" };

export default async function EditRoomTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requirePagePermission(ADMIN_SECTIONS.rooms.permission);
  const [{ id }, { created }] = await Promise.all([params, searchParams]);

  const roomType = await db.roomType.findUnique({
    where: { id },
    include: {
      rooms: { select: { id: true, name: true, isActive: true }, orderBy: [{ isActive: "desc" }, { name: "asc" }] },
      media: { select: { id: true, media: { select: pickerMediaSelect } }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!roomType) notFound();

  // Photos need media.manage too (same roles today, but keep the rule explicit).
  const canManageMedia = can(user.role, "media.manage");
  const { childUnderAge } = await loadStayTerms();
  const library = canManageMedia ? await loadPickerLibrary() : [];
  const placements = toPlacements(roomType.media);

  return (
    <>
      <Link href="/admin/rooms" className="mb-3 inline-block text-sm text-forest underline-offset-2 hover:underline">
        ← All room types
      </Link>
      <PageHeader
        title={roomType.name}
        description={roomType.isActive ? "Active · guests can request this room type" : "Archived · hidden from guests"}
      />
      {created && (
        <div className="mb-6">
          <FormMessage type="success">Room type created. Add its rooms and photos below.</FormMessage>
        </div>
      )}

      <div className="space-y-8">
        <section aria-labelledby="details-heading" className="rounded-lg border border-forest/10 bg-white p-6">
          <h2 id="details-heading" className="mb-4 font-display text-lg text-forest">
            Details
          </h2>
          <RoomTypeForm
            childUnderAge={childUnderAge}
            key={roomType.updatedAt.toISOString()}
            roomType={{
              id: roomType.id,
              name: roomType.name,
              slug: roomType.slug,
              description: roomType.description,
              basePriceNpr: roomType.basePriceNpr,
              childPricePerNightNpr: roomType.childPricePerNightNpr,
              maxGuests: roomType.maxGuests,
              amenities: roomType.amenities,
              sortOrder: roomType.sortOrder,
            }}
          />
        </section>

        <section aria-labelledby="rooms-heading" className="rounded-lg border border-forest/10 bg-white p-6">
          <h2 id="rooms-heading" className="mb-4 font-display text-lg text-forest">
            Rooms
          </h2>
          <RoomsManager roomTypeId={roomType.id} rooms={roomType.rooms} />
        </section>

        {canManageMedia && (
          <PlacementManager
            key={placementKey(placements)}
            target={{ kind: "roomType", roomTypeId: roomType.id }}
            title="Photos"
            description="The first photo is the main one. Upload new photos in Media → Library."
            placements={placements}
            library={library}
          />
        )}

        <section aria-labelledby="status-heading" className="rounded-lg border border-forest/10 bg-white p-6">
          <h2 id="status-heading" className="mb-2 font-display text-lg text-forest">
            Status
          </h2>
          <RoomTypeStatus id={roomType.id} name={roomType.name} isActive={roomType.isActive} />
        </section>
      </div>
    </>
  );
}
