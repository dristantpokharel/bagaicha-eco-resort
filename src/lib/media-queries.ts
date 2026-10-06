import "server-only";
import { db } from "@/lib/db";
import type { Placement, PickerMedia } from "@/components/media/placement-manager";

export const pickerMediaSelect = {
  id: true,
  url: true,
  altText: true,
  altNeedsReview: true,
  width: true,
  height: true,
  blurDataUrl: true,
  originalFilename: true,
} as const;

/** Every library image, newest first, for the "Add images" picker. */
export function loadPickerLibrary(): Promise<PickerMedia[]> {
  return db.media.findMany({ select: pickerMediaSelect, orderBy: { createdAt: "desc" } });
}

/** Turns placement rows into the shape PlacementManager expects. */
export function toPlacements(rows: { id: string; media: PickerMedia }[]): Placement[] {
  return rows.map((row) => ({ placementId: row.id, media: row.media }));
}

/** Remount key: changes whenever the server-side order or membership changes. */
export function placementKey(placements: Placement[]) {
  return placements.map((p) => `${p.placementId}:${p.media.altNeedsReview}:${p.media.altText}`).join("|") || "empty";
}
