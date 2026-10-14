import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { resolvePar } from "@/lib/housekeeping/par";
import { PageHeader } from "@/components/admin/page-header";
import { ParEditor, type ParItem } from "./par-editor";

export const metadata = { title: "Par list" };

export default async function ParListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  await requirePagePermission("inventory.managePar");
  const [{ id }, { room: roomParam }] = await Promise.all([params, searchParams]);

  const roomType = await db.roomType.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      rooms: { where: { isActive: true }, select: { id: true, name: true, _count: { select: { parOverrides: true } } }, orderBy: { name: "asc" } },
      parLines: { select: { itemId: true, quantity: true } },
    },
  });
  if (!roomType) notFound();

  const items: ParItem[] = await db.inventoryItem.findMany({
    where: { OR: [{ isActive: true }, { id: { in: roomType.parLines.map((l) => l.itemId) } }] },
    select: { id: true, name: true, unit: true, isConsumable: true },
    orderBy: { name: "asc" },
  });

  const room = roomParam ? roomType.rooms.find((r) => r.id === roomParam) : undefined;
  const overrides = room ? await db.roomParOverride.findMany({ where: { roomId: room.id }, select: { itemId: true, quantity: true } }) : [];
  const typeQuantities = Object.fromEntries(roomType.parLines.map((l) => [l.itemId, l.quantity.toString()]));
  const effective = room ? Object.fromEntries([...resolvePar(roomType.parLines, overrides)].map(([k, v]) => [k, v.toString()])) : typeQuantities;

  return (
    <>
      <Link href={`/admin/rooms/${roomType.id}`} className="mb-3 inline-block text-sm text-forest underline-offset-2 hover:underline">
        ← {roomType.name}
      </Link>
      <PageHeader
        title={room ? `Par list: ${room.name}` : `Par list: ${roomType.name}`}
        description={
          room
            ? `What ${room.name} should hold. Changes here apply to this room only; the rest of the ${roomType.name} rooms keep the type's list.`
            : `What every ${roomType.name} room should hold. Housekeeping uses it for the prep checklist.`
        }
      />

      <div className="max-w-2xl space-y-8">
        <nav aria-label="Par list for" className="flex flex-wrap gap-2">
          {[{ id: "", name: `All ${roomType.name} rooms`, overrides: 0 }, ...roomType.rooms.map((r) => ({ id: r.id, name: r.name, overrides: r._count.parOverrides }))].map((entry) => {
            const active = (room?.id ?? "") === entry.id;
            return (
              <Link
                key={entry.id || "type"}
                href={entry.id ? `/admin/rooms/${roomType.id}/par?room=${entry.id}` : `/admin/rooms/${roomType.id}/par`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm ${active ? "border-forest bg-forest text-cream" : "border-charcoal/25 bg-white text-charcoal"}`}
              >
                {entry.name}
                {entry.overrides > 0 && <span className="ml-1.5 text-xs opacity-80">· custom</span>}
              </Link>
            );
          })}
        </nav>

        <section className="rounded-lg border border-forest/10 bg-white p-4 sm:p-6">
          <ParEditor
            key={room?.id ?? roomType.id}
            scope={room ? { roomId: room.id } : { roomTypeId: roomType.id }}
            items={items}
            initial={effective}
            typeQuantities={room ? typeQuantities : undefined}
          />
        </section>
      </div>
    </>
  );
}
