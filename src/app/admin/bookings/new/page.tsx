import Link from "next/link";
import { BOOKING } from "@/config/booking";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/booking/dates";
import { loadStayTerms } from "@/lib/content/stay-terms";
import { PageHeader } from "@/components/admin/page-header";
import { NewBookingForm } from "./new-booking-form";

export const metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (key: string) => (Array.isArray(sp[key]) ? sp[key][0] : sp[key]) ?? "";
  const { childUnderAge } = await loadStayTerms();
  const roomTypes = await db.roomType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      maxGuests: true,
      maxAdults: true,
      maxChildren: true,
      rooms: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });

  // From the tape chart: ?room=…&checkIn=…&checkOut=…. Anything that isn't a real active room or date is ignored.
  const roomId = one("room");
  const prefillType = roomTypes.find((rt) => rt.rooms.some((r) => r.id === roomId));
  const checkIn = parseDateOnly(one("checkIn")) ? one("checkIn") : "";
  const checkOut = parseDateOnly(one("checkOut")) ? one("checkOut") : "";
  const initial = { roomTypeId: prefillType?.id, roomId: prefillType ? roomId : undefined, checkIn, checkOut };

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/bookings" className="text-forest underline underline-offset-4">
          ← All bookings
        </Link>
      </p>
      <PageHeader title="New booking" description="For phone calls and walk-ins. Add as many rooms as the guest needs. Each room's price is worked out from its type's current rates." />
      {roomTypes.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-6 text-sm text-charcoal-light">
          There are no active room types yet. Add one under Rooms first.
        </p>
      ) : (
        <NewBookingForm
          roomTypes={roomTypes}
          defaultCountryCode={BOOKING.defaultCountryCode}
          childUnderAge={childUnderAge}
          initial={initial}
        />
      )}
    </>
  );
}
