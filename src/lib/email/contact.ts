import { SITE } from "@/config/site";
import { db } from "@/lib/db";
import { showPlaceholders } from "@/lib/content/placeholder";
import type { EmailContact } from "./footer";

/**
 * Contact footer facts, read straight from Business info (never stale in an email). Fields still
 * flagged as placeholders are left out in production. The website is NEXT_PUBLIC_SITE_URL.
 */
export async function loadEmailContact(): Promise<EmailContact> {
  const row = await db.businessInfo.findUnique({ where: { id: 1 } });
  const live = (field: string) => !row?.placeholderFields.includes(field) || showPlaceholders;
  return {
    name: row?.name || SITE.name,
    address: row?.address && live("address") ? row.address : null,
    phone: live("phones") ? (row?.phones[0] ?? null) : null,
    whatsapp: row?.whatsapp && live("whatsapp") ? row.whatsapp : null,
    email: live("emails") ? (row?.emails[0] ?? null) : null,
    websiteUrl: SITE.url.origin,
    mapsUrl: row?.googleMapsUrl && live("googleMapsUrl") ? row.googleMapsUrl : null,
  };
}
