import { db } from "@/lib/db";
import { showPlaceholders } from "./placeholder";

/** Slug of the Policies row that holds the cancellation policy (the single source for its wording). */
export const CANCELLATION_POLICY_SLUG = "cancellation-policy";

/** Check-in/out times (BusinessInfo) and cancellation wording (Policies) shown on /book, in emails and the FAQ. */
export type StayTerms = {
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: string | null;
};

/** Reads straight from the database, so emails and server actions never see stale text. Pages use `getStayTerms`. */
export async function loadStayTerms(): Promise<StayTerms> {
  const [business, policy] = await Promise.all([
    db.businessInfo.findUnique({
      where: { id: 1 },
      select: { checkInTime: true, checkOutTime: true, placeholderFields: true },
    }),
    db.policy.findUnique({
      where: { slug: CANCELLATION_POLICY_SLUG },
      select: { body: true, isActive: true, placeholderFields: true },
    }),
  ]);
  const live = (flagged: string[] | undefined, field: string) => !flagged?.includes(field) || showPlaceholders;
  return {
    checkInTime: business && live(business.placeholderFields, "checkInTime") ? business.checkInTime : null,
    checkOutTime: business && live(business.placeholderFields, "checkOutTime") ? business.checkOutTime : null,
    cancellationPolicy: policy?.isActive && live(policy.placeholderFields, "body") ? policy.body : null,
  };
}
