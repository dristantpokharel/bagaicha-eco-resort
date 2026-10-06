import type { Prisma } from "@/generated/prisma/client";

export type GuestInput = {
  name: string;
  /** Lowercased already. */
  email?: string | null;
  /** Normalized (see normalizePhone). */
  phone?: string | null;
  country?: string | null;
};

/**
 * Finds the guest by email, then by phone, or creates one. An existing guest
 * is never overwritten (a public form must not be able to edit someone's
 * record); only empty fields are filled in.
 */
export async function findOrCreateGuest(tx: Prisma.TransactionClient, input: GuestInput) {
  const email = input.email || null;
  const phone = input.phone || null;

  const existing =
    (email ? await tx.guest.findFirst({ where: { email }, orderBy: { createdAt: "asc" } }) : null) ??
    (phone ? await tx.guest.findFirst({ where: { phone }, orderBy: { createdAt: "asc" } }) : null);

  if (!existing) {
    return tx.guest.create({ data: { name: input.name, email, phone, country: input.country || null } });
  }

  const fill: Prisma.GuestUpdateInput = {};
  if (!existing.email && email) fill.email = email;
  if (!existing.phone && phone) fill.phone = phone;
  if (!existing.country && input.country) fill.country = input.country;
  return Object.keys(fill).length ? tx.guest.update({ where: { id: existing.id }, data: fill }) : existing;
}
