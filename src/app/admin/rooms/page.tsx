import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatNpr } from "@/lib/money";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Rooms" };

export default async function RoomsPage() {
  await requirePagePermission(ADMIN_SECTIONS.rooms.permission);

  const roomTypes = await db.roomType.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      basePriceNpr: true,
      maxGuests: true,
      isActive: true,
      rooms: { select: { isActive: true } },
      _count: { select: { media: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Rooms"
        description="Room types guests can request, their prices, photos and the physical rooms behind them."
        actions={
          <Link href="/admin/rooms/new" className={buttonClasses()}>
            New room type
          </Link>
        }
      />

      {roomTypes.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          No room types yet. Create the first one to start adding rooms and photos.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-forest/10 bg-white p-6">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-forest/10 text-xs tracking-wide text-charcoal-light uppercase">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Room type
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Price / night
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Guests
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Rooms
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Photos
                </th>
                <th scope="col" className="py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {roomTypes.map((rt) => {
                const activeRooms = rt.rooms.filter((r) => r.isActive).length;
                return (
                  <tr key={rt.id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/rooms/${rt.id}`}
                        className="font-medium text-forest underline-offset-2 hover:underline"
                      >
                        {rt.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{formatNpr(rt.basePriceNpr)}</td>
                    <td className="py-3 pr-4">Up to {rt.maxGuests}</td>
                    <td className="py-3 pr-4">
                      {activeRooms}
                      {rt.rooms.length > activeRooms && (
                        <span className="text-charcoal-light"> (+{rt.rooms.length - activeRooms} archived)</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{rt._count.media || <span className="text-warning">None</span>}</td>
                    <td className="py-3">
                      <span className={rt.isActive ? "text-success" : "text-charcoal-light"}>
                        {rt.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
