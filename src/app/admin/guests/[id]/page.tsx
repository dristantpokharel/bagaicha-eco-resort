import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatStayDate, nightsBetween } from "@/lib/booking/dates";
import { formatNpr } from "@/lib/money";
import { ContactPhone } from "@/components/admin/contact-phone";
import { PageHeader } from "@/components/admin/page-header";
import { ReservationStatusBadge } from "@/components/admin/status-badge";
import { summariseRooms } from "@/lib/booking/multi-room";
import { deriveReservationStatus } from "@/lib/booking/reservation-status";
import { GuestForm } from "./guest-form";

export const metadata = { title: "Guest" };

export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission(ADMIN_SECTIONS.guests.permission);
  const { id } = await params;

  const guest = await db.guest.findUnique({
    where: { id },
    include: {
      reservations: {
        orderBy: { checkIn: "desc" },
        select: {
          id: true,
          reference: true,
          checkIn: true,
          checkOut: true,
          totalPriceNpr: true,
          bookings: { select: { status: true, roomType: { select: { name: true } }, room: { select: { name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        },
      },
    },
  });
  if (!guest) notFound();

  const stays = guest.reservations.filter((r) => r.bookings.some((b) => b.status === "CHECKED_IN" || b.status === "CHECKED_OUT")).length;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/guests" className="text-forest underline underline-offset-4">
          ← All guests
        </Link>
      </p>
      <PageHeader
        title={guest.name}
        description={`${guest.reservations.length} booking${guest.reservations.length === 1 ? "" : "s"}, ${stays} completed or current stay${stays === 1 ? "" : "s"}`}
        actions={guest.phone ? <ContactPhone phone={guest.phone} /> : undefined}
      />

      <div className="space-y-6">
        <section className="rounded-lg border border-forest/10 bg-white p-5">
          <h2 className="mb-3 font-display text-lg text-forest">Details</h2>
          <GuestForm
            key={guest.updatedAt.toISOString()}
            guest={{
              id: guest.id,
              name: guest.name,
              phone: guest.phone ?? "",
              email: guest.email ?? "",
              country: guest.country ?? "",
              notes: guest.notes ?? "",
            }}
          />
        </section>

        <section className="rounded-lg border border-forest/10 bg-white p-5">
          <h2 className="mb-3 font-display text-lg text-forest">Stay history</h2>
          {guest.reservations.length === 0 ? (
            <p className="text-sm text-charcoal-light">No bookings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-forest/10 text-xs tracking-wide text-charcoal-light uppercase">
                  <tr>
                    {["Booking", "Stay", "Rooms", "Total", "Status"].map((h) => (
                      <th key={h} scope="col" className="py-2 pr-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/10">
                  {guest.reservations.map((r) => {
                    const nights = nightsBetween(r.checkIn, r.checkOut);
                    const assigned = r.bookings.flatMap((b) => (b.room ? [b.room.name] : []));
                    return (
                      <tr key={r.id}>
                        <td className="py-3 pr-4">
                          <Link href={`/admin/bookings/${r.id}`} className="font-medium text-forest underline-offset-2 hover:underline">
                            {r.reference}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {formatStayDate(r.checkIn)}
                          <div className="text-xs text-charcoal-light">
                            {nights} night{nights === 1 ? "" : "s"}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {summariseRooms(r.bookings.map((b) => b.roomType.name))}
                          <div className="text-xs text-charcoal-light">{assigned.length > 0 ? `Rooms ${assigned.join(", ")}` : "Not assigned"}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">{formatNpr(r.totalPriceNpr)}</td>
                        <td className="py-3">
                          <ReservationStatusBadge status={deriveReservationStatus(r.bookings)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
