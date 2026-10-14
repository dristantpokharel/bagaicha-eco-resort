import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { BOARD_FILTERS, filterBoard, parseBoardFilter, type BoardRoom } from "@/lib/housekeeping/board";
import { loadBoard } from "@/lib/housekeeping/queries";
import { PageHeader } from "@/components/admin/page-header";
import { RoomStatusBadge } from "@/components/admin/room-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { StatusControl } from "./status-control";

export const metadata = { title: "Housekeeping" };

export default async function HousekeepingPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePagePermission("housekeeping.work");
  const filter = parseBoardFilter((await searchParams).filter);
  const all = await loadBoard(db);
  const rooms = filterBoard(all, filter);
  const count = (f: (typeof BOARD_FILTERS)[number]["value"]) => filterBoard(all, f).length;

  return (
    <>
      <PageHeader title="Housekeeping" description="Every room, its status, and what needs doing today." />

      <nav aria-label="Filter rooms" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {BOARD_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/housekeeping" : `/admin/housekeeping?filter=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-md border px-3 text-sm ${
              filter === f.value ? "border-forest bg-forest text-cream" : "border-charcoal/25 bg-white text-charcoal"
            }`}
          >
            {f.label}
            {f.value !== "all" && <span className="ml-1.5 text-xs opacity-80">{count(f.value)}</span>}
          </Link>
        ))}
      </nav>

      {rooms.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          {filter === "all" ? "No rooms yet." : "No rooms match this filter."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </ul>
      )}
    </>
  );
}

function RoomCard({ room }: { room: BoardRoom }) {
  return (
    <li className="space-y-2 rounded-lg border border-forest/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-forest">{room.name}</h2>
          <p className="text-xs text-charcoal-light">{room.roomTypeName}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RoomStatusBadge status={room.status} />
          {room.preppedShort && <span className="text-xs font-medium text-warning">Short on stock</span>}
        </div>
      </div>

      {room.status === "OUT_OF_ORDER" && room.statusNote && <p className="text-sm text-error">{room.statusNote}</p>}
      {room.blockedToday && <p className="text-xs text-charcoal-light">Dates are blocked on the calendar today.</p>}

      {(room.departureToday || room.arrivalToday) && (
        <dl className="space-y-0.5 text-sm">
          {room.departureToday && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-charcoal-light">Leaves today</dt>
              <dd>{room.departureToday.guestName}</dd>
            </div>
          )}
          {room.arrivalToday && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-charcoal-light">Arrives today</dt>
              <dd>{room.arrivalToday.guestName}</dd>
            </div>
          )}
        </dl>
      )}
      {room.sameDay && <p className="text-xs font-medium text-warning">Same-day turnaround: inspect first, then prepare.</p>}
      {room.arrivalToday && room.status === "OUT_OF_ORDER" && (
        <p className="text-sm font-medium text-error">A guest arrives today but this room is out of order.</p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {room.todo === "INSPECT" && (
          <Link href={`/admin/housekeeping/rooms/${room.id}/inspect`} className={buttonClasses({ className: "min-h-11" })}>
            Inspect
          </Link>
        )}
        {room.todo === "PREP" && (
          <Link href={`/admin/housekeeping/rooms/${room.id}/prep`} className={buttonClasses({ className: "min-h-11" })}>
            Prep
          </Link>
        )}
        <StatusControl roomId={room.id} roomName={room.name} current={room.status} />
      </div>
    </li>
  );
}
