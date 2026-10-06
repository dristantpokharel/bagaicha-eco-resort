import type { Prisma } from "@/generated/prisma/client";

export type ActivityEntry = {
  /** Null for system actions (e.g. the seed script). */
  userId: string | null;
  /** Dotted verb, e.g. "user.created". */
  action: string;
  entityType: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
};

/** Write an activity log row inside the same transaction as the change it records. */
export function logActivity(tx: Prisma.TransactionClient, entry: ActivityEntry) {
  return tx.activityLog.create({ data: entry });
}
