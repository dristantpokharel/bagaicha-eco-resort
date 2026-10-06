import "server-only";
import { db } from "@/lib/db";
import { COLLECTIONS, type CollectionKey } from "@/lib/content/collections";
import type { ContentRow, Option } from "./content-form";

type Raw = Record<string, unknown> & { id?: string | number; placeholderFields?: string[]; sortOrder?: number; isActive?: boolean };

/** A database row as the strings the form inputs show. */
export function toContentRow(key: CollectionKey, raw: Raw): ContentRow {
  const values: Record<string, string> = {};
  for (const f of COLLECTIONS[key].fields) {
    const v = raw[f.name];
    values[f.name] = Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v);
  }
  if (typeof raw.slug === "string") values.slug = raw.slug;
  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    values,
    placeholderFields: raw.placeholderFields ?? [],
    sortOrder: raw.sortOrder ?? 0,
    isActive: raw.isActive ?? true,
  };
}

export async function loadMediaOptions(): Promise<Option[]> {
  const media = await db.media.findMany({
    select: { id: true, altText: true, originalFilename: true },
    orderBy: { originalFilename: "asc" },
  });
  return media.map((m) => ({ value: m.id, label: m.originalFilename ?? (m.altText || m.id) }));
}
