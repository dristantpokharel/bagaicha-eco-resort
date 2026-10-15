"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { RESORT_TIMEZONE } from "@/lib/dates";
import { remainingPlaceholders } from "@/lib/content/placeholder";
import { revalidatePublicSite } from "@/lib/content/revalidate";
import { guideInputSchema } from "@/lib/guides/schemas";
import { publishProblems } from "@/lib/guides/visibility";

/** Fields whose placeholder flag is cleared once their text changes. */
const TRACKED = ["title", "excerpt", "body", "faq", "seoTitle", "seoDescription", "authorName"] as const;

/**
 * Create or update a guide. Admin and up only. Publishing needs a complete guide with no
 * placeholder text left; a draft can be saved at any stage.
 */
export async function saveGuide(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const actor = await requirePermission("content.manage");
    const input = parseForm(guideInputSchema, formData);

    const previous = input.id ? await db.guide.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !previous) throw new ActionError("That guide no longer exists.");
    if (previous?.status === "PUBLISHED" && previous.slug !== input.slug)
      throw new ActionError("Please fix the highlighted fields.", { slug: "The URL of a published guide cannot change." });

    if (input.coverMediaId && !(await db.media.findUnique({ where: { id: input.coverMediaId }, select: { id: true } })))
      throw new ActionError("Please fix the highlighted fields.", { coverMediaId: "That image no longer exists." });

    const reviewed = input.markReviewed === "on";
    const next = { title: input.title, excerpt: input.excerpt, body: input.body, faq: input.faq, seoTitle: input.seoTitle, seoDescription: input.seoDescription, authorName: input.authorName };
    const placeholderFields = reviewed
      ? []
      : remainingPlaceholders(
          previous as Record<string, unknown> | null,
          next,
          (previous?.placeholderFields ?? []).filter((f) => (TRACKED as readonly string[]).includes(f)),
        );

    let publishedAt: Date | null = input.publishedAt ? fromZonedTime(`${input.publishedAt}T00:00:00`, RESORT_TIMEZONE) : null;
    if (input.status === "PUBLISHED") {
      const problems = publishProblems({ ...input, placeholderFields });
      if (problems.length) throw new ActionError(`Not ready to publish. ${problems.join(" ")}`);
      publishedAt ??= previous?.publishedAt ?? new Date();
    }

    const data = {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      body: input.body,
      coverMediaId: input.coverMediaId,
      tags: input.tags,
      authorName: input.authorName,
      authorRole: input.authorRole,
      status: input.status,
      publishedAt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      faq: input.faq as Prisma.InputJsonValue,
      placeholderFields,
    };

    try {
      await db.$transaction(async (tx) => {
        const saved = previous ? await tx.guide.update({ where: { id: previous.id }, data }) : await tx.guide.create({ data });
        createdId = previous ? null : saved.id;
        await logActivity(tx, {
          userId: actor.id,
          action: !previous ? "guide.created" : previous.status !== input.status ? (input.status === "PUBLISHED" ? "guide.published" : "guide.unpublished") : "guide.updated",
          entityType: "Guide",
          entityId: saved.id,
          details: { title: input.title },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ActionError("That URL slug is already used.", { slug: "Already in use." });
      throw error;
    }
    revalidatePublicSite();
    revalidatePath("/admin/content/guides", "layout");
    return { ok: true, message: input.status === "PUBLISHED" ? "Saved. This guide is published." : "Draft saved." };
  });
  if (result.ok && createdId) redirect(`/admin/content/guides/${createdId}`);
  return result;
}
