import { revalidatePath, revalidateTag } from "next/cache";

/** Tag on every cached read of public content (see queries.ts). */
export const CONTENT_TAG = "site-content";

/** Call after any admin change that the public site shows (content, rooms, media placements). */
export function revalidatePublicSite() {
  revalidateTag(CONTENT_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
