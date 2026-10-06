import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime, todayInResort } from "@/lib/dates";
import { formatStayDate } from "@/lib/booking/dates";
import { buttonClasses } from "@/components/ui/button";
import { CreateBlockForm, RemoveBlockButton } from "./block-forms";

export const metadata = { title: "Room blocks" };

export default async function BlocksPage({ searchParams }: { searchParams: Promise<{ past?: string | string[] }> }) {
  await requirePagePermission("rooms.blockDates");
  const sp = await searchParams;
  const showPast = (Array.isArray(sp.past) ? sp.past[0] : sp.past) === "1";
  const today = todayInResort();

  const [rooms, blocks] = await Promise.all([
    db.room.findMany({
      where: { isActive: true },
      orderBy: [{ roomType: { sortOrder: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, roomType: { select: { name: true } } },
    }),
    db.roomBlock.findMany({
      where: showPast ? {} : { endDate: { gt: today } },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
        createdAt: true,
        room: { select: { name: true, roomType: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-forest/10 bg-white p-5" aria-labelledby="block-heading">
        <h2 id="block-heading" className="mb-1 font-display text-lg text-forest">
          Block a room
        </h2>
        <p className="mb-4 text-sm text-charcoal-light">
          A blocked room can&apos;t be booked or confirmed for those nights. Existing confirmed bookings must be moved first.
        </p>
        {rooms.length === 0 ? (
          <p className="text-sm text-charcoal-light">There are no active rooms yet. Add rooms under Rooms first.</p>
        ) : (
          <CreateBlockForm rooms={rooms.map((r) => ({ id: r.id, label: `${r.roomType.name}: ${r.name}` }))} />
        )}
      </section>

      <section aria-labelledby="blocks-list-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="blocks-list-heading" className="font-display text-lg text-forest">
            {showPast ? "All blocks" : "Current and upcoming blocks"}
          </h2>
          <Link
            href={showPast ? "/admin/bookings/blocks" : "/admin/bookings/blocks?past=1"}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {showPast ? "Hide past blocks" : "Show past blocks"}
          </Link>
        </div>
        {blocks.length === 0 ? (
          <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-6 text-sm text-charcoal-light">No blocks.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white p-4">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-forest/10 text-xs tracking-wide text-charcoal-light uppercase">
                <tr>
                  {["Room", "Blocked", "Reason", "Added", ""].map((h, i) => (
                    <th key={i} scope="col" className="py-2 pr-4 font-medium">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {blocks.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="py-3 pr-4">
                      {b.room.name}
                      <div className="text-xs text-charcoal-light">{b.room.roomType.name}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatStayDate(b.startDate)}
                      <div className="text-xs text-charcoal-light">free again {formatStayDate(b.endDate)}</div>
                    </td>
                    <td className="py-3 pr-4">{b.reason}</td>
                    <td className="py-3 pr-4 text-xs whitespace-nowrap text-charcoal-light">
                      {formatDateTime(b.createdAt)}
                      <div>{b.createdBy.name}</div>
                    </td>
                    <td className="py-3">
                      <RemoveBlockButton blockId={b.id} label={`${b.room.name}, ${b.reason}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
