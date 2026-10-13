import type { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "@/lib/auth/permissions";
import { deriveReservationStatus } from "@/lib/booking/reservation-status";
import { ENQUIRY_STATUS_LABELS, RESERVATION_STATUS_LABELS } from "@/lib/booking/labels";
import { isLowStock, isOutOfStock } from "@/lib/inventory/stock";

import { SEARCH_MIN_CHARS, type SearchGroup, type SearchKind } from "./search-types";

export { SEARCH_MIN_CHARS, type ChipTone, type SearchGroup, type SearchHit, type SearchKind } from "./search-types";

const PER_GROUP = 5;
/** Phone digits are matched from this many digits up, so "98" doesn't match half the book. */
const MIN_PHONE_DIGITS = 3;

/** What each kind needs; the same permissions that guard its page. */
export const SEARCH_PERMISSIONS: Record<SearchKind, Permission> = {
  reservation: "bookings.manage",
  guest: "bookings.manage",
  enquiry: "enquiries.manage",
  inventory: "inventory.recordMovements",
};
const GROUP_LABELS: Record<SearchKind, string> = {
  reservation: "Bookings",
  guest: "Guests",
  enquiry: "Enquiries",
  inventory: "Inventory",
};
const ORDER: SearchKind[] = ["reservation", "guest", "enquiry", "inventory"];

/** The kinds this role may search. */
export function searchKindsFor(role: Role): SearchKind[] {
  return ORDER.filter((kind) => can(role, SEARCH_PERMISSIONS[kind]));
}

/** Trimmed, single-spaced, capped; null when too short to search. */
export function normaliseQuery(raw: string): string | null {
  const q = raw.replace(/\s+/g, " ").trim().slice(0, 100);
  return q.length >= SEARCH_MIN_CHARS ? q : null;
}

/** Digits to match against phone numbers, only when the query looks like a phone number. */
export function phoneDigits(q: string): string | null {
  if (!/^[\d\s+()-]+$/.test(q)) return null;
  const digits = q.replace(/\D/g, "");
  return digits.length >= MIN_PHONE_DIGITS ? digits : null;
}

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

type Db = Pick<typeof db, "reservation" | "guest" | "enquiry" | "inventoryItem">;

/**
 * Finds records for the quick-search box. Only searches the kinds the role has permission for, never
 * touches the activity log, and never keeps the query anywhere.
 */
export async function searchAdmin(client: Db, role: Role, raw: string): Promise<SearchGroup[]> {
  const q = normaliseQuery(raw);
  if (!q) return [];
  const kinds = new Set(searchKindsFor(role));
  const digits = phoneDigits(q);

  const [reservations, guests, enquiries, items] = await Promise.all([
    kinds.has("reservation")
      ? client.reservation.findMany({
          where: {
            OR: [
              { reference: contains(q) },
              { guestName: contains(q) },
              { guestEmail: contains(q) },
              ...(digits ? [{ guestPhone: { contains: digits } }] : []),
            ],
          },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
          select: {
            id: true,
            reference: true,
            guestName: true,
            guestPhone: true,
            checkIn: true,
            checkOut: true,
            bookings: { select: { status: true } },
          },
        })
      : [],
    kinds.has("guest")
      ? client.guest.findMany({
          where: { OR: [{ name: contains(q) }, { email: contains(q) }, ...(digits ? [{ phone: { contains: digits } }] : [])] },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
          select: { id: true, name: true, email: true, phone: true, _count: { select: { reservations: true } } },
        })
      : [],
    kinds.has("enquiry")
      ? client.enquiry.findMany({
          where: { OR: [{ name: contains(q) }, { email: contains(q) }, ...(digits ? [{ phone: { contains: digits } }] : [])] },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
          select: { id: true, name: true, email: true, phone: true, status: true },
        })
      : [],
    kinds.has("inventory")
      ? client.inventoryItem.findMany({
          where: { OR: [{ name: contains(q) }, { category: contains(q) }, { supplier: contains(q) }] },
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
          take: PER_GROUP,
          select: { id: true, name: true, category: true, isActive: true, quantity: true, lowStockThreshold: true },
        })
      : [],
  ]);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const groups: SearchGroup[] = [
    {
      kind: "reservation",
      label: GROUP_LABELS.reservation,
      hits: reservations.map((r) => {
        const status = deriveReservationStatus(r.bookings);
        return {
          kind: "reservation" as const,
          id: r.id,
          title: r.guestName,
          subtitle: `${r.reference} · ${iso(r.checkIn)} to ${iso(r.checkOut)}${r.guestPhone ? ` · ${r.guestPhone}` : ""}`,
          href: `/admin/bookings/${r.id}`,
          chip: {
            label: RESERVATION_STATUS_LABELS[status],
            tone: status === "PENDING" || status === "PARTIALLY_CONFIRMED" ? "pending" : status === "CANCELLED" ? "bad" : status === "COMPLETED" ? "neutral" : "good",
          },
        };
      }),
    },
    {
      kind: "guest",
      label: GROUP_LABELS.guest,
      hits: guests.map((g) => ({
        kind: "guest" as const,
        id: g.id,
        title: g.name,
        subtitle: [g.phone, g.email].filter(Boolean).join(" · ") || "No contact details",
        href: `/admin/guests/${g.id}`,
        chip: { label: `${g._count.reservations} ${g._count.reservations === 1 ? "stay" : "stays"}`, tone: "neutral" as const },
      })),
    },
    {
      kind: "enquiry",
      label: GROUP_LABELS.enquiry,
      hits: enquiries.map((e) => ({
        kind: "enquiry" as const,
        id: e.id,
        title: e.name,
        subtitle: [e.phone, e.email].filter(Boolean).join(" · "),
        href: `/admin/enquiries?status=${e.status}#enquiry-${e.id}`,
        chip: { label: ENQUIRY_STATUS_LABELS[e.status], tone: e.status === "NEW" ? ("pending" as const) : ("neutral" as const) },
      })),
    },
    {
      kind: "inventory",
      label: GROUP_LABELS.inventory,
      hits: items.map((i) => ({
        kind: "inventory" as const,
        id: i.id,
        title: i.name,
        subtitle: i.category,
        href: `/admin/inventory/${i.id}`,
        chip: !i.isActive
          ? { label: "Archived", tone: "neutral" as const }
          : isOutOfStock(i)
            ? { label: "Out of stock", tone: "bad" as const }
            : isLowStock(i)
              ? { label: "Low stock", tone: "pending" as const }
              : undefined,
      })),
    },
  ];
  return groups.filter((g) => g.hits.length > 0);
}
