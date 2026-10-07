import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatStayDate } from "@/lib/booking/dates";
import { ContactPhone } from "@/components/admin/contact-phone";
import { PageHeader } from "@/components/admin/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export const metadata = { title: "Guests" };

const PAGE_SIZE = 25;

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(ADMIN_SECTIONS.guests.permission);
  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().slice(0, 100);
  const pageParam = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const digits = q.replace(/\D/g, "");
  const where: Prisma.GuestWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};

  const [guests, total] = await Promise.all([
    db.guest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        country: true,
        _count: { select: { reservations: true } },
        reservations: { orderBy: { checkIn: "desc" }, take: 1, select: { checkIn: true } },
      },
    }),
    db.guest.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/admin/guests?${qs}` : "/admin/guests";
  };

  return (
    <>
      <PageHeader title="Guests" description="Everyone who has booked or requested a stay, with their stay history." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-forest/10 bg-white p-4">
        <div className="w-full max-w-md">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Name, email or phone" maxLength={100} />
        </div>
        <Button type="submit">Search</Button>
        {q && (
          <Link href="/admin/guests" className={buttonClasses({ variant: "secondary" })}>
            Clear
          </Link>
        )}
      </form>

      <p className="mb-3 text-sm text-charcoal-light" aria-live="polite">
        {total} guest{total === 1 ? "" : "s"}
        {q ? " found" : ""}.
      </p>

      {guests.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          {q ? "No guests match your search." : "No guests yet. They appear when someone books."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white p-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-forest/10 text-xs tracking-wide text-charcoal-light uppercase">
              <tr>
                {["Guest", "Phone", "Email", "Bookings", "Latest stay"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {guests.map((g) => (
                <tr key={g.id} className="align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/guests/${g.id}`} className="font-medium text-forest underline-offset-2 hover:underline">
                      {g.name}
                    </Link>
                    {g.country && <div className="text-xs text-charcoal-light">{g.country}</div>}
                  </td>
                  <td className="py-3 pr-4">{g.phone ? <ContactPhone phone={g.phone} /> : "—"}</td>
                  <td className="py-3 pr-4 break-all">{g.email ?? "—"}</td>
                  <td className="py-3 pr-4">{g._count.reservations}</td>
                  <td className="py-3 whitespace-nowrap">{g.reservations[0] ? formatStayDate(g.reservations[0].checkIn) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-charcoal-light">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
