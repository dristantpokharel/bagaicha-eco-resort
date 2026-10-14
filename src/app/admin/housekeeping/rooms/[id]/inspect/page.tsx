import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { ActionError } from "@/lib/actions";
import { loadInspectionChecklist } from "@/lib/housekeeping/service";
import { PageHeader } from "@/components/admin/page-header";
import { RoomStatusBadge } from "@/components/admin/room-status-badge";
import { InspectForm } from "./inspect-form";
import { SkipInspection } from "./skip-inspection";

export const metadata = { title: "Inspect room" };

export default async function InspectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("housekeeping.work");
  const { id } = await params;
  const checklist = await loadInspectionChecklist(db, id).catch((error) => {
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
        title={`Inspect ${room.name}`}
        description={booking ? `${room.roomTypeName} · after ${booking.guestName} (${booking.reference}). Count what is in the room.` : room.roomTypeName}
      />
      <div className="mb-4">
        <RoomStatusBadge status={room.status} />
      </div>
      <div className="max-w-2xl">
        <InspectForm key={`${room.id}:${room.dirtyCycle}`} roomId={room.id} cycle={room.dirtyCycle} lines={lines} blocked={blocked} />
        {!blocked && can(user.role, "housekeeping.skipInspection") && <SkipInspection key={`skip:${room.dirtyCycle}`} roomId={room.id} cycle={room.dirtyCycle} />}
      </div>
    </>
  );
}
