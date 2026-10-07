export const SNAPSHOT_FIELDS = ["name", "email", "phone", "country"] as const;
export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];
export type ContactDetails = { name: string; email: string | null; phone: string | null; country: string | null };

/** The contact details stored on a reservation (what was submitted), in the guest's shape. */
export function snapshotOf(r: { guestName: string; guestEmail: string | null; guestPhone: string | null; guestCountry: string | null }): ContactDetails {
  return { name: r.guestName, email: r.guestEmail, phone: r.guestPhone, country: r.guestCountry };
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * Fields where the submitted details differ from the saved guest. A field left blank on the submission is not a
 * difference (a walk-in with no email shouldn't look like it contradicts the guest's saved email).
 */
export function snapshotDiff(snapshot: ContactDetails, guest: ContactDetails): SnapshotField[] {
  return SNAPSHOT_FIELDS.filter((f) => norm(snapshot[f]) !== "" && norm(snapshot[f]) !== norm(guest[f]));
}
