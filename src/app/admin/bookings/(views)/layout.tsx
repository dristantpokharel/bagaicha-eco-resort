import Link from "next/link";
import { can, requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav } from "@/components/admin/sub-nav";
import { buttonClasses } from "@/components/ui/button";

export default async function BookingViewsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePagePermission(ADMIN_SECTIONS.bookings.permission);
  const links = [
    { href: "/admin/bookings", label: "List" },
    { href: "/admin/bookings/calendar", label: "Calendar" },
    ...(can(user.role, "rooms.blockDates") ? [{ href: "/admin/bookings/blocks", label: "Room blocks" }] : []),
  ];
  return (
    <>
      <PageHeader
        title="Bookings"
        description="Requests from the website and bookings entered by staff."
        actions={
          <Link href="/admin/bookings/new" className={buttonClasses()}>
            New booking
          </Link>
        }
      />
      <SubNav label="Booking views" links={links} />
      {children}
    </>
  );
}
