import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { PageHeader } from "@/components/admin/page-header";
import { RoomTypeForm } from "../room-type-form";

export const metadata = { title: "New room type" };

export default async function NewRoomTypePage() {
  await requirePagePermission(ADMIN_SECTIONS.rooms.permission);
  return (
    <>
      <Link href="/admin/rooms" className="mb-3 inline-block text-sm text-forest underline-offset-2 hover:underline">
        ← All room types
      </Link>
      <PageHeader title="New room type" description="You can add rooms and photos after saving." />
      <section className="rounded-lg border border-forest/10 bg-white p-6">
        <RoomTypeForm />
      </section>
    </>
  );
}
