import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ActionError } from "@/lib/actions";
import { loadPrepChecklist } from "@/lib/housekeeping/service";
import { formatStayDate } from "@/lib/booking/dates";
import { PageHeader } from "@/components/admin/page-header";
import { RoomStatusBadge } from "@/components/admin/room-status-badge";
import { PrepForm } from "./prep-form";

export const metadata = { title: "Prepare room" };

export default async function PrepPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("housekeeping.work");
  const { id } = await params;
  const checklist = await loadPrepChecklist(db, id).catch((error) => {
    if (error instanceof ActionError) return null;
    throw error;
  });
  if (!checklist) notFound();
  const { room, booking, lines, blocked } = checklist;

  return (
    <>
      <Link href="/admin/housekeeping" className="mb-3 inline-block text-sm text-forest underline-offset-2 hover:underline">
        ← Rooms
      </Link>
      <PageHeader
        title={`Prepare ${room.name}`}
        description={
          booking
            ? `${room.roomTypeName} · next guest: ${booking.guestName} (${booking.reference}), arriving ${formatStayDate(booking.checkIn)}`
            : `${room.roomTypeName} · no arrival booked`
        }
      />
      <div className="mb-4">
        <RoomStatusBadge status={room.status} />
      </div>
      <div className="max-w-2xl">
        <PrepForm key={`${room.id}:${room.dirtyCycle}`} roomId={room.id} cycle={room.dirtyCycle} lines={lines} blocked={blocked} />
      </div>
    </>
  );
}
