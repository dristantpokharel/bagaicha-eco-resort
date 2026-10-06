import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";

export default async function BookingsLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission(ADMIN_SECTIONS.bookings.permission);
  return children;
}
