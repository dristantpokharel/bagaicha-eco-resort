"use server";

import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { buildSchema, COLLECTIONS, isCollectionKey, type CollectionKey } from "@/lib/content/collections";
import { remainingPlaceholders } from "@/lib/content/placeholder";
import { revalidatePublicSite } from "@/lib/content/revalidate";
import { slugify } from "@/app/admin/rooms/schemas";
import { revalidatePath } from "next/cache";

/** Minimal shape shared by the Prisma delegates this action touches. */
type Row = Record<string, unknown> & { id?: string; placeholderFields?: string[] };
type Delegate = {
  findUnique(args: { where: Record<string, unknown> }): Promise<Row | null>;
  create(args: { data: Record<string, unknown> }): Promise<Row & { id: string }>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Row & { id: string }>;
};

function delegate(tx: Prisma.TransactionClient, key: CollectionKey): Delegate {
  const map: Record<CollectionKey, unknown> = {
    business: tx.businessInfo,
    activities: tx.activity,
    diningSections: tx.diningSection,
    diningItems: tx.diningItem,
    eventTypes: tx.eventType,
    faqs: tx.faq,
    policies: tx.policy,
    nearby: tx.nearbyDestination,
  };
  return map[key] as Delegate;
}

const ENTITY: Record<CollectionKey, string> = {
  business: "BusinessInfo",
  activities: "Activity",
  diningSections: "DiningSection",
  diningItems: "DiningItem",
  eventTypes: "EventType",
  faqs: "Faq",
  policies: "Policy",
  nearby: "NearbyDestination",
};

/**
 * Create or update one content row (or the single business row). Admin and up only.
 * A placeholder flag is cleared when its field is edited.
 */
export async function saveContentItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("content.manage");
    const key = formData.get("collection");
    if (!isCollectionKey(key)) throw new ActionError("Unknown content type.");
    const collection = COLLECTIONS[key];
    const input = parseForm(buildSchema(collection), formData) as Record<string, unknown>;
    const id = String(formData.get("id") ?? "").trim();

    if (key === "business") {
      const whatsapp = input.whatsapp as string | null;
      if (whatsapp) {
        const digits = whatsapp.replace(/\D/g, "");
        if (digits.length < 8 || digits.length > 15)
          throw new ActionError("Please fix the highlighted fields.", { whatsapp: "Enter the number with its country code." });
        input.whatsapp = digits;
      }
    }
    if (collection.slugFrom) {
      const slug = String(input.slug || slugify(String(input[collection.slugFrom] ?? "")));
      if (!slug) throw new ActionError("Please fix the highlighted fields.", { slug: "Could not make a URL slug." });
      input.slug = slug;
    }

    try {
      const label = await db.$transaction(async (tx) => {
        const model = delegate(tx, key);
        const where = collection.singleton ? { id: 1 } : { id };
        const previous = collection.singleton ? await model.findUnique({ where }) : id ? await model.findUnique({ where }) : null;
        if (id && !previous) throw new ActionError("That item no longer exists.");

        // "I've reviewed this" clears every flag, even when the text is kept as it is.
        const reviewed = formData.get("markReviewed") === "on";
        const data = {
          ...input,
          placeholderFields: reviewed ? [] : remainingPlaceholders(previous, input, previous?.placeholderFields ?? []),
        };
        const saved = previous ? await model.update({ where, data }) : await model.create({ data });
        await logActivity(tx, {
          userId: actor.id,
          action: previous ? "content.updated" : "content.created",
          entityType: ENTITY[key],
          entityId: String(saved.id),
          details: { collection: key, title: String(input[collection.titleField] ?? "") },
        });
        return String(input[collection.titleField] ?? collection.singular);
      });
      revalidatePublicSite();
      revalidatePath("/admin/content", "layout");
      revalidatePath("/admin");
      return { ok: true, message: `${label} saved.` };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ActionError("That URL slug is already used.", { slug: "Already in use." });
      throw error;
    }
  });
}
